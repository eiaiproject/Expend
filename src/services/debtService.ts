import { db, Debt, DebtPayment, type Transaction } from '../db/db';
import { getBalanceDelta } from '../utils/balanceUtils';

export interface DebtSummary {
  totalPayable: number;
  totalReceivable: number;
  activePayable: number;
  activeReceivable: number;
  overdueCount: number;
}

/**
 * Get all debts with optional filters
 */
export async function getDebts(
  type?: Debt['type'],
  status?: Debt['status']
): Promise<Debt[]> {
  let collection = db.debts.orderBy('createdAt');

  if (type && status) {
    return collection
      .filter(d => d.type === type && d.status === status)
      .reverse()
      .toArray();
  }
  if (type) {
    return collection.filter(d => d.type === type).reverse().toArray();
  }
  if (status) {
    return collection.filter(d => d.status === status).reverse().toArray();
  }
  return collection.reverse().toArray();
}

/**
 * Get a single debt by ID
 */
export async function getDebtById(id: number): Promise<Debt | undefined> {
  return db.debts.get(id);
}

/**
 * Create a new debt
 * @param description - Pre-translated description for the initial transaction
 */
export async function createDebt(
  data: Omit<Debt, 'id' | 'createdAt' | 'status' | 'remainingAmount'>,
  description?: string
): Promise<number> {
  const now = new Date().toISOString();
  const newDebt: Omit<Debt, 'id'> = {
    ...data,
    createdAt: now,
    status: 'pending',
    remainingAmount: data.amount,
  };
  const id = await db.debts.add(newDebt);

  // Create initial transaction if wallet is linked
  if (data.walletId && id) {
    const dateStr = now.split('T')[0] ?? now;
    await createInitialDebtTransaction({ ...newDebt, id }, data.amount, dateStr, description);
  }

  return id ?? 0;
}

/**
 * Update a debt
 */
export async function updateDebt(id: number, data: Partial<Debt>): Promise<void> {
  await db.debts.update(id, data);
}

/**
 * Delete a debt and its payments.
 * Atomically rolls back wallet balance for the initial transaction.
 * @param initialTxDescription - Pre-translated description to find the initial transaction
 */
export async function deleteDebt(id: number, initialTxDescription?: string): Promise<void> {
  const debt = await db.debts.get(id);

  // Delete the initial transaction and rollback wallet balance atomically
  if (debt?.walletId) {
    // Try to find by provided description first, then fallback to contact name search
    let initialTx = initialTxDescription
      ? await db.transactions
          .where('description')
          .equals(initialTxDescription)
          .and(tx => tx.walletId === debt.walletId)
          .first()
      : null;
    
    // Fallback: search by contact name in description
    if (!initialTx) {
      initialTx = await db.transactions
        .where('walletId')
        .equals(debt.walletId)
        .and(tx => tx.description.includes(debt.contactName))
        .and(tx => tx.type === (debt.type === 'payable' ? 'balance_adjustment' : 'expense'))
        .first();
    }
    
    if (initialTx) {
      await db.transaction('rw', [db.transactions, db.wallets], async () => {
        // Rollback wallet balance
        const delta = getBalanceDelta(initialTx.type, initialTx.amount);
        const wallet = await db.wallets.get(debt.walletId!);
        if (wallet) {
          await db.wallets.update(debt.walletId!, {
            currentBalance: (wallet.currentBalance ?? wallet.initialBalance) - delta,
            lastUpdated: new Date().toISOString(),
          });
        }
        // Delete the transaction
        await db.transactions.delete(initialTx.id!);
      });
    }
  }

  await db.debt_payments.where('debtId').equals(id).delete();
  await db.debts.delete(id);
}

/**
 * Add a payment to a debt
 */
export async function addPayment(
  debtId: number,
  payment: Omit<DebtPayment, 'id' | 'debtId'>
): Promise<number> {
  const debt = await db.debts.get(debtId);
  if (!debt) throw new Error('Debt not found');

  const newRemaining = Math.max(0, debt.remainingAmount - payment.amount);
  const newStatus: Debt['status'] = newRemaining === 0 ? 'settled' : 'partial';

  await db.debts.update(debtId, {
    remainingAmount: newRemaining,
    status: newStatus,
  });

  const newPayment: Omit<DebtPayment, 'id'> = {
    ...payment,
    debtId,
  };
  const id = await db.debt_payments.add(newPayment);
  return id ?? 0;
}

/**
 * Get all payments for a debt
 */
export async function getPaymentsByDebt(debtId: number): Promise<DebtPayment[]> {
  return db.debt_payments.where('debtId').equals(debtId).reverse().sortBy('date');
}

/**
 * Delete a payment and update debt remaining
 */
export async function deletePayment(paymentId: number): Promise<void> {
  const payment = await db.debt_payments.get(paymentId);
  if (!payment) throw new Error('Payment not found');

  const debt = await db.debts.get(payment.debtId);
  if (!debt) throw new Error('Debt not found');

  const newRemaining = debt.remainingAmount + payment.amount;
  const newStatus: Debt['status'] = newRemaining === debt.amount ? 'pending' : 'partial';

  await db.debts.update(payment.debtId, {
    remainingAmount: newRemaining,
    status: newStatus,
  });

  await db.debt_payments.delete(paymentId);
}

/**
 * Mark a debt as settled manually
 */
export async function settleDebt(debtId: number): Promise<void> {
  const debt = await db.debts.get(debtId);
  if (!debt) throw new Error('Debt not found');

  await db.debts.update(debtId, {
    remainingAmount: 0,
    status: 'settled',
  });
}

/**
 * Compute summary of all debts (read-only operation).
 * Note: Call checkOverdueDebts() separately if you need to update overdue statuses.
 */
export async function computeDebtSummary(): Promise<DebtSummary> {
  const allDebts = await db.debts.toArray();
  const today = new Date().toISOString().split('T')[0] ?? '';

  const summary: DebtSummary = {
    totalPayable: 0,
    totalReceivable: 0,
    activePayable: 0,
    activeReceivable: 0,
    overdueCount: 0,
  };

  for (const debt of allDebts) {
    // Count overdue (but don't update status here — that's a write operation)
    const isOverdue = debt.dueDate && debt.dueDate < today && debt.status !== 'settled';
    if (isOverdue) {
      summary.overdueCount++;
    }

    if (debt.type === 'payable') {
      summary.totalPayable += debt.amount;
      if (debt.status !== 'settled') {
        summary.activePayable += debt.remainingAmount;
      }
    } else {
      summary.totalReceivable += debt.amount;
      if (debt.status !== 'settled') {
        summary.activeReceivable += debt.remainingAmount;
      }
    }
  }

  return summary;
}

/**
 * Check and update overdue debts
 */
export async function checkOverdueDebts(): Promise<number> {
  const today = new Date().toISOString().split('T')[0] ?? '';
  const pendingDebts = await db.debts
    .where('status')
    .anyOf(['pending', 'partial'])
    .toArray();

  let overdueCount = 0;
  for (const debt of pendingDebts) {
    if (debt.dueDate && debt.dueDate < today) {
      await db.debts.update(debt.id!, { status: 'overdue' });
      overdueCount++;
    }
  }
  return overdueCount;
}



/**
 * Create initial transaction when debt is created
 * - Payable (utang): balance_adjustment (uang masuk)
 * - Receivable (piutang): expense (uang keluar)
 * Atomically updates wallet.currentBalance.
 *
 * @param description - Pre-translated description (e.g., "Loan received: Budi")
 * @param loanDescription - Pre-translated loan description (e.g., "Loan: Laptop purchase")
 */
export async function createInitialDebtTransaction(
  debt: Debt,
  amount: number,
  date: string,
  description?: string,
  loanDescription?: string
): Promise<number> {
  if (!debt.walletId) throw new Error('No wallet linked to this debt');

  const txType: Transaction['type'] = debt.type === 'payable' ? 'balance_adjustment' : 'expense';
  const txData: Omit<Transaction, 'id'> = {
    walletId: debt.walletId,
    categoryId: debt.categoryId ?? null,
    date: date,
    description: description ?? debt.contactName,
    type: txType,
    amount: amount,
    notes: loanDescription ?? debt.notes,
  };

  let txId = 0;
  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    txId = (await db.transactions.add(txData as Transaction)) as number;
    // Update wallet balance atomically
    const delta = getBalanceDelta(txType, amount);
    const wallet = await db.wallets.get(debt.walletId!);
    if (wallet) {
      await db.wallets.update(debt.walletId!, {
        currentBalance: (wallet.currentBalance ?? wallet.initialBalance) + delta,
        lastUpdated: new Date().toISOString(),
      });
    }
  });
  return txId;
}

/**
 * Create a transaction when recording a debt payment.
 * Atomically updates wallet.currentBalance.
 *
 * @param description - Pre-translated description (e.g., "Debt payment: Budi")
 * @param paymentNote - Pre-translated payment note (e.g., "Payment for: Laptop loan")
 */
export async function createPaymentTransaction(
  debt: Debt,
  paymentAmount: number,
  paymentDate: string,
  note?: string,
  description?: string,
  paymentNote?: string
): Promise<number> {
  if (!debt.walletId) throw new Error('No wallet linked to this debt');

  const txType: Transaction['type'] = debt.type === 'payable' ? 'expense' : 'balance_adjustment';
  const txData: Omit<Transaction, 'id'> = {
    walletId: debt.walletId,
    categoryId: debt.categoryId ?? null,
    date: paymentDate,
    description: description ?? debt.contactName,
    type: txType,
    amount: paymentAmount,
    notes: paymentNote ?? note,
  };

  let txId = 0;
  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    txId = (await db.transactions.add(txData as Transaction)) as number;
    // Update wallet balance atomically
    const delta = getBalanceDelta(txType, paymentAmount);
    const wallet = await db.wallets.get(debt.walletId!);
    if (wallet) {
      await db.wallets.update(debt.walletId!, {
        currentBalance: (wallet.currentBalance ?? wallet.initialBalance) + delta,
        lastUpdated: new Date().toISOString(),
      });
    }
  });
  return txId;
}
