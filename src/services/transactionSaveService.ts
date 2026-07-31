import { db, type Transaction } from '../db/db';
import { assertWalletBalanceCanApplyDelta, getBalanceDelta, getWalletBalance } from '../utils/balanceUtils';
import { INSUFFICIENT_WALLET_BALANCE_MESSAGE } from './errors';
import { incrementChangeCount } from './backupService';

export { INSUFFICIENT_WALLET_BALANCE_MESSAGE } from './errors';
const WALLET_NOT_FOUND_MESSAGE = 'Wallet not found.';

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

interface ValidationError {
  message: string;
}

function validateTransaction(tx: Partial<Transaction>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!tx.description || tx.description.trim().length === 0) {
    errors.push({ message: 'Description must not be empty.' });
  }
  if (tx.description && tx.description.length > 160) {
    errors.push({ message: 'Description must be at most 160 characters.' });
  }
  if (tx.amount == null || !Number.isFinite(tx.amount)) {
    errors.push({ message: 'Amount must be a finite number.' });
  } else if (tx.type === 'balance_adjustment') {
    if (tx.amount === 0) {
      errors.push({ message: 'Balance adjustment amount must not be zero.' });
    }
  } else if (tx.amount <= 0) {
    errors.push({ message: 'Amount must be greater than 0.' });
  }
  if (tx.amount != null && Math.abs(tx.amount) > 1_000_000_000_000) {
    errors.push({ message: 'Amount exceeds maximum allowed value.' });
  }
  if (!tx.date || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) {
    errors.push({ message: 'Date must be YYYY-MM-DD format.' });
  }
  if (tx.walletId == null || !Number.isSafeInteger(tx.walletId) || tx.walletId <= 0) {
    errors.push({ message: 'Wallet must be selected.' });
  }
  if (!tx.type) {
    errors.push({ message: 'Transaction type is required.' });
  }
  if (tx.notes !== undefined && tx.notes !== null && tx.notes.length > 1000) {
    errors.push({ message: 'Notes must be at most 1000 characters.' });
  }

  return errors;
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

  const updateSameWallet = async (oldTx: Transaction) => {
    const oldDelta = getBalanceDelta(oldTx.type, oldTx.amount);
    const newDelta = getBalanceDelta(params.type, params.amount);
    const diff = newDelta - oldDelta;
    if (diff !== 0) {
      const wallet = await db.wallets.get(params.walletId);
      if (!wallet) throw new Error(WALLET_NOT_FOUND_MESSAGE);
      assertWalletBalanceCanApplyDelta(wallet, diff, INSUFFICIENT_WALLET_BALANCE_MESSAGE);
      await db.wallets.update(params.walletId, {
        currentBalance: getWalletBalance(wallet) + diff,
        lastUpdated: new Date().toISOString(),
      });
    }
  };

  const updateDifferentWallet = async (oldTx: Transaction) => {
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
    if (!newWallet) throw new Error(WALLET_NOT_FOUND_MESSAGE);
    assertWalletBalanceCanApplyDelta(newWallet, newDelta, INSUFFICIENT_WALLET_BALANCE_MESSAGE);
    await db.wallets.update(params.walletId, {
      currentBalance: getWalletBalance(newWallet) + newDelta,
      lastUpdated: new Date().toISOString(),
    });
  };

  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    if (existingId) {
      const oldTx = await db.transactions.get(existingId);
      if (oldTx?.walletId === params.walletId) {
        await updateSameWallet(oldTx);
      } else if (oldTx) {
        await updateDifferentWallet(oldTx);
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
      const wallet = await db.wallets.get(params.walletId);
      if (!wallet) throw new Error(WALLET_NOT_FOUND_MESSAGE);
      const delta = getBalanceDelta(params.type, params.amount);
      assertWalletBalanceCanApplyDelta(wallet, delta, INSUFFICIENT_WALLET_BALANCE_MESSAGE);

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
      await db.wallets.update(params.walletId, {
        currentBalance: getWalletBalance(wallet) + delta,
        lastUpdated: new Date().toISOString(),
      });
    }
  });

  // Track the transaction mutation for backup metadata
  await incrementChangeCount(1);
}

/**
 * Save a transfer pair (transfer_out + transfer_in) atomically.
 * Both transactions share the same transferGroupId.
 * Also updates both wallets' currentBalance.
 */
export async function saveTransfer(params: SaveTransferParams): Promise<void> {
  validateTransferParams(params);

  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    const transferGroupId = crypto.randomUUID();
    const fromWallet = await db.wallets.get(params.fromWalletId);
    const toWallet = await db.wallets.get(params.toWalletId);
    if (!fromWallet || !toWallet) throw new Error(WALLET_NOT_FOUND_MESSAGE);
    assertWalletBalanceCanApplyDelta(fromWallet, -params.amount, INSUFFICIENT_WALLET_BALANCE_MESSAGE);

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
    await db.wallets.update(params.fromWalletId, {
      currentBalance: getWalletBalance(fromWallet) - params.amount,
      lastUpdated: new Date().toISOString(),
    });

    // Update destination wallet (credit)
    await db.wallets.update(params.toWalletId, {
      currentBalance: getWalletBalance(toWallet) + params.amount,
      lastUpdated: new Date().toISOString(),
    });
  });

  // Track the transfer creation for backup metadata
  await incrementChangeCount(2);
}

export interface UpdateTransferParams extends SaveTransferParams {
  transferGroupId: string;
}

/**
 * Edit an existing transfer pair atomically (master.md 5.6).
 *
 * Steps:
 * 1. Locate both sides via the transfer group id.
 * 2. Validate that the pair is complete.
 * 3. Reverse the previous balance effects logically.
 * 4. Validate the proposed source/destination wallets.
 * 5. Validate sufficient balance after considering reversal.
 * 6. Update both records and apply the new balance effects.
 * 7. Commit atomically; Dexie rolls everything back on failure.
 *
 * Supports changes to amount, date, source wallet, destination wallet,
 * notes, and description. Prevents transfer to the same wallet.
 */
export async function updateTransfer(params: UpdateTransferParams): Promise<void> {
  // Reuse the same validations as transfer creation
  validateTransferParams({
    amount: params.amount,
    description: params.description,
    date: params.date,
    fromWalletId: params.fromWalletId,
    toWalletId: params.toWalletId,
    notes: params.notes,
  });

  await db.transaction('rw', [db.transactions, db.wallets], async () => {
    const pair = await db.transactions
      .where('transferGroupId')
      .equals(params.transferGroupId)
      .toArray();

    const outTx = pair.find((t) => t.type === 'transfer_out');
    const inTx = pair.find((t) => t.type === 'transfer_in');
    if (!outTx?.id || !inTx?.id) {
      throw new Error('Transfer pair is incomplete.');
    }

    const fromWallet = await db.wallets.get(params.fromWalletId);
    const toWallet = await db.wallets.get(params.toWalletId);
    if (!fromWallet || !toWallet) throw new Error(WALLET_NOT_FOUND_MESSAGE);

    // Aggregate balance deltas per wallet so that wallet swaps (old source
    // becoming new destination, etc.) are applied exactly once each.
    const deltasByWallet = new Map<number, number>();

    // 3. Reverse previous balance effects
    const addDelta = (walletId: number, delta: number) => {
      deltasByWallet.set(walletId, (deltasByWallet.get(walletId) ?? 0) + delta);
    };
    addDelta(outTx.walletId, outTx.amount);        // undo source debit
    addDelta(inTx.walletId, -inTx.amount);         // undo destination credit

    // 4. Proposed wallets exist (checked above)
    // 5. Validate sufficient balance after considering reversal
    addDelta(params.fromWalletId, -params.amount); // new source debit
    addDelta(params.toWalletId, params.amount);    // new destination credit

    const newSourceNetDelta = deltasByWallet.get(params.fromWalletId) ?? 0;
    assertWalletBalanceCanApplyDelta(
      fromWallet,
      newSourceNetDelta,
      INSUFFICIENT_WALLET_BALANCE_MESSAGE,
    );

    // 6. Update both records, preserving the canonical group id
    await db.transactions.update(outTx.id, {
      amount: params.amount,
      description: `${params.description} (Out)`,
      date: params.date,
      walletId: params.fromWalletId,
      notes: params.notes,
    });
    await db.transactions.update(inTx.id, {
      amount: params.amount,
      description: `${params.description} (In)`,
      date: params.date,
      walletId: params.toWalletId,
      notes: params.notes,
    });

    // Apply the new balance effects
    for (const [walletId, delta] of deltasByWallet.entries()) {
      const wallet = await db.wallets.get(walletId);
      if (wallet) {
        await db.wallets.update(walletId, {
          currentBalance: getWalletBalance(wallet) + delta,
          lastUpdated: new Date().toISOString(),
        });
      }
    }
  });

  // Track the transfer edit for backup metadata
  await incrementChangeCount(2);
}
