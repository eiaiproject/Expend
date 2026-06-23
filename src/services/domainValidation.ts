/**
 * Centralized domain validation utilities.
 *
 * These rules are enforced in services, imports, and UI consistently.
 * UI is not the only validator.
 */
import type { Transaction, Debt, DebtPayment, DebtType, DebtPaymentType } from '../db/db';

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate a transaction before saving.
 */
export function validateTransaction(tx: Partial<Transaction>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!tx.description || tx.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Description must not be empty.' });
  }
  if (tx.description && tx.description.length > 160) {
    errors.push({ field: 'description', message: 'Description must be at most 160 characters.' });
  }
  if (tx.amount == null || !Number.isFinite(tx.amount) || tx.amount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be greater than 0.' });
  }
  if (tx.amount != null && tx.amount > 1_000_000_000_000) {
    errors.push({ field: 'amount', message: 'Amount exceeds maximum allowed value.' });
  }
  if (!tx.date || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) {
    errors.push({ field: 'date', message: 'Date must be YYYY-MM-DD format.' });
  }
  if (tx.walletId == null || !Number.isSafeInteger(tx.walletId) || tx.walletId <= 0) {
    errors.push({ field: 'walletId', message: 'Wallet must be selected.' });
  }
  if (!tx.type) {
    errors.push({ field: 'type', message: 'Transaction type is required.' });
  }
  if (tx.type === 'expense' && (tx.categoryId == null || tx.categoryId === undefined)) {
    // Category is optional for expenses (uncategorized), but warn
    // Actually, let's allow null categoryId for expenses
  }
  if (tx.notes !== undefined && tx.notes !== null && tx.notes.length > 1000) {
    errors.push({ field: 'notes', message: 'Notes must be at most 1000 characters.' });
  }

  return errors;
}

/**
 * Validate a debt record before saving.
 */
export function validateDebt(debt: Partial<Debt>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!debt.personName || debt.personName.trim().length === 0) {
    errors.push({ field: 'personName', message: 'Person name is required.' });
  }
  if (debt.personName && debt.personName.length > 120) {
    errors.push({ field: 'personName', message: 'Person name must be at most 120 characters.' });
  }
  if (debt.principalAmount == null || !Number.isFinite(debt.principalAmount) || debt.principalAmount <= 0) {
    errors.push({ field: 'principalAmount', message: 'Principal amount must be greater than 0.' });
  }
  if (debt.remainingAmount !== undefined && debt.remainingAmount !== null) {
    if (!Number.isFinite(debt.remainingAmount) || debt.remainingAmount < 0) {
      errors.push({ field: 'remainingAmount', message: 'Remaining amount must be >= 0.' });
    }
    if (debt.principalAmount != null && debt.remainingAmount > debt.principalAmount) {
      errors.push({ field: 'remainingAmount', message: 'Remaining amount must be <= principal amount.' });
    }
  }
  if (debt.walletId == null || !Number.isSafeInteger(debt.walletId) || debt.walletId <= 0) {
    errors.push({ field: 'walletId', message: 'Wallet must be selected.' });
  }
  if (!debt.startDate) {
    errors.push({ field: 'startDate', message: 'Start date is required.' });
  }
  if (debt.type !== 'payable' && debt.type !== 'receivable') {
    errors.push({ field: 'type', message: 'Debt type must be payable or receivable.' });
  }

  return errors;
}

/**
 * Validate a debt payment before recording.
 */
export function validateDebtPayment(payment: {
  amount: number;
  debtId: string;
  walletId: number;
  date: string;
  type?: DebtPaymentType;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
    errors.push({ field: 'amount', message: 'Payment amount must be greater than 0.' });
  }
  if (!payment.debtId) {
    errors.push({ field: 'debtId', message: 'Debt ID is required.' });
  }
  if (!Number.isSafeInteger(payment.walletId) || payment.walletId <= 0) {
    errors.push({ field: 'walletId', message: 'Wallet must be selected.' });
  }
  if (!payment.date) {
    errors.push({ field: 'date', message: 'Payment date is required.' });
  }

  return errors;
}

/**
 * Check if a transaction type is valid.
 */
export function isValidTransactionType(type: string): type is Transaction['type'] {
  return ['expense', 'balance_adjustment', 'transfer_in', 'transfer_out'].includes(type);
}

/**
 * Check if a debt type is valid.
 */
export function isValidDebtType(type: string): type is DebtType {
  return type === 'payable' || type === 'receivable';
}

/**
 * Check if a debt status is valid.
 */
export function isValidDebtStatus(status: string): boolean {
  return ['open', 'partial', 'paid', 'overdue', 'written_off'].includes(status);
}

/**
 * Check if a debt payment type is valid.
 */
export function isValidDebtPaymentType(type: string): type is DebtPaymentType {
  return ['initial', 'repayment', 'adjustment', 'write_off'].includes(type);
}

/**
 * Check if a wallet name is valid.
 */
export function validateWalletName(name: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!name || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Wallet name is required.' });
  }
  if (name && name.length > 80) {
    errors.push({ field: 'name', message: 'Wallet name must be at most 80 characters.' });
  }
  return errors;
}

/**
 * Check if a category name is valid.
 */
export function validateCategoryName(name: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!name || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Category name is required.' });
  }
  if (name && name.length > 80) {
    errors.push({ field: 'name', message: 'Category name must be at most 80 characters.' });
  }
  return errors;
}

/**
 * Validate an import transaction amount.
 */
export function validateImportTransactionAmount(
  amount: unknown,
  type: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    errors.push({ field: 'amount', message: 'Amount must be a finite number.' });
    return errors;
  }
  if (amount <= 0) {
    errors.push({
      field: 'amount',
      message: `Transaction amount must be greater than 0 (got ${amount} for type ${type}).`,
    });
  }
  if (Math.abs(amount) > 1_000_000_000_000) {
    errors.push({ field: 'amount', message: 'Amount exceeds maximum allowed value.' });
  }
  return errors;
}
