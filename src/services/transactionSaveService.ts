import { db, type Transaction } from '../db/db';
import { generateTransferGroupId } from '../utils/cryptoUtils';
import { getBalanceDelta } from '../utils/balanceUtils';
import { validateTransaction } from './domainValidation';

export interface SaveTransactionParams {
  amount: number;
  description: string;
  date: string;
  walletId: number;
  categoryId: number | null;
  notes: string;
  type: Transaction['type'];
}

export interface SaveTransferParams {
  amount: number;
  description: string;
  date: string;
  fromWalletId: number;
  toWalletId: number;
  notes: string;
}

/**
 * Validate transfer-specific constraints that aren't covered by validateTransaction.
 * Throws on invalid params.
 */
function validateTransferParams(params: SaveTransferParams): void {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error('Transfer amount must be greater than 0.');
  }
  if (params.amount > 1_000_000_000_000) {
    throw new Error('Transfer amount exceeds maximum allowed value.');
  }
  if (!params.description || params.description.trim().length === 0) {
    throw new Error('Transfer description must not be empty.');
  }
  if (!params.date || !/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    throw new Error('Transfer date must be YYYY-MM-DD format.');
  }
  if (!Number.isSafeInteger(params.fromWalletId) || params.fromWalletId <= 0) {
    throw new Error('Source wallet must be selected.');
  }
  if (!Number.isSafeInteger(params.toWalletId) || params.toWalletId <= 0) {
    throw new Error('Destination wallet must be selected.');
  }
  if (params.fromWalletId === params.toWalletId) {
    throw new Error('Cannot transfer to the same wallet.');
  }
}



/**
 * Save a single transaction (expense or balance_adjustment).
 * Handles both create and update atomically.
 * Also updates wallet currentBalance incrementally.
 */
export async function saveTransaction(
  params: SaveTransactionParams,
  existingId?: number
): Promise<void> {
  // Validate inputs at service boundary
  const txErrors = validateTransaction({
    type: params.type,
    amount: params.amount,
    description: params.description,
    date: params.date,
    walletId: params.walletId,
    categoryId: params.categoryId,
    notes: params.notes,
  });
  if (txErrors.length > 0) {
    throw new Error(txErrors.map(e => e.message).join('; '));
  }

  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    if (existingId) {
      // Get old transaction to compute balance delta
      const oldTx = await db.transactions.get(existingId);
      if (oldTx && oldTx.walletId === params.walletId) {
        // Same wallet: apply difference
        const oldDelta = getBalanceDelta(oldTx.type, oldTx.amount);
        const newDelta = getBalanceDelta(params.type, params.amount);
        const diff = newDelta - oldDelta;
        if (diff !== 0) {
          const wallet = await db.wallets.get(params.walletId);
          if (wallet) {
            await db.wallets.update(params.walletId, {
              currentBalance: (wallet.currentBalance ?? wallet.initialBalance) + diff,
              lastUpdated: new Date().toISOString(),
            });
          }
        }
      } else if (oldTx) {
        // Different wallet: revert old, apply new
        const oldDelta = getBalanceDelta(oldTx.type, oldTx.amount);
        const oldWallet = await db.wallets.get(oldTx.walletId);
        if (oldWallet) {
          await db.wallets.update(oldTx.walletId, {
            currentBalance: (oldWallet.currentBalance ?? oldWallet.initialBalance) - oldDelta,
            lastUpdated: new Date().toISOString(),
          });
        }
        const newDelta = getBalanceDelta(params.type, params.amount);
        const newWallet = await db.wallets.get(params.walletId);
        if (newWallet) {
          await db.wallets.update(params.walletId, {
            currentBalance: (newWallet.currentBalance ?? newWallet.initialBalance) + newDelta,
            lastUpdated: new Date().toISOString(),
          });
        }
      }
      await db.transactions.update(existingId, {
        amount: params.amount,
        description: params.description,
        date: params.date,
        walletId: params.walletId,
        categoryId: params.categoryId,
        notes: params.notes,
        type: params.type,
      });
    } else {
      // Create new transaction
      await db.transactions.add({
        amount: params.amount,
        description: params.description,
        date: params.date,
        walletId: params.walletId,
        categoryId: params.categoryId,
        notes: params.notes,
        type: params.type,
      });
      // Update wallet balance
      const delta = getBalanceDelta(params.type, params.amount);
      const wallet = await db.wallets.get(params.walletId);
      if (wallet) {
        await db.wallets.update(params.walletId, {
          currentBalance: (wallet.currentBalance ?? wallet.initialBalance) + delta,
          lastUpdated: new Date().toISOString(),
        });
      }
    }
  });
}

/**
 * Save a transfer pair (transfer_out + transfer_in) atomically.
 * Both transactions share the same transferGroupId.
 * Also updates both wallets' currentBalance.
 */
export async function saveTransfer(params: SaveTransferParams): Promise<void> {
  validateTransferParams(params);

  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    const transferGroupId = generateTransferGroupId();

    await db.transactions.add({
      amount: params.amount,
      description: `${params.description} (Out)`,
      date: params.date,
      walletId: params.fromWalletId,
      categoryId: null,
      notes: params.notes,
      type: 'transfer_out',
      transferGroupId,
    });

    await db.transactions.add({
      amount: params.amount,
      description: `${params.description} (In)`,
      date: params.date,
      walletId: params.toWalletId,
      categoryId: null,
      notes: params.notes,
      type: 'transfer_in',
      transferGroupId,
    });

    // Update source wallet (debit)
    const fromWallet = await db.wallets.get(params.fromWalletId);
    if (fromWallet) {
      await db.wallets.update(params.fromWalletId, {
        currentBalance: (fromWallet.currentBalance ?? fromWallet.initialBalance) - params.amount,
        lastUpdated: new Date().toISOString(),
      });
    }

    // Update destination wallet (credit)
    const toWallet = await db.wallets.get(params.toWalletId);
    if (toWallet) {
      await db.wallets.update(params.toWalletId, {
        currentBalance: (toWallet.currentBalance ?? toWallet.initialBalance) + params.amount,
        lastUpdated: new Date().toISOString(),
      });
    }
  });
}

/**
 * Delete a transaction and rollback wallet balance.
 * For transfers, deletes both paired transactions.
 */
export async function deleteTransaction(txId: number): Promise<void> {
  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    const tx = await db.transactions.get(txId);
    if (!tx) return;

    if (tx.type === 'transfer_out' || tx.type === 'transfer_in') {
      // Transfer: delete both sides
      const pair = await db.transactions
        .where('transferGroupId')
        .equals(tx.transferGroupId ?? '')
        .toArray();
      for (const p of pair) {
        const delta = getBalanceDelta(p.type, p.amount);
        const wallet = await db.wallets.get(p.walletId);
        if (wallet) {
          await db.wallets.update(p.walletId, {
            currentBalance: (wallet.currentBalance ?? wallet.initialBalance) - delta,
            lastUpdated: new Date().toISOString(),
          });
        }
        await db.transactions.delete(p.id!);
      }
    } else {
      // Single transaction
      const delta = getBalanceDelta(tx.type, tx.amount);
      const wallet = await db.wallets.get(tx.walletId);
      if (wallet) {
        await db.wallets.update(tx.walletId, {
          currentBalance: (wallet.currentBalance ?? wallet.initialBalance) - delta,
          lastUpdated: new Date().toISOString(),
        });
      }
      await db.transactions.delete(txId);
    }
  });
}
