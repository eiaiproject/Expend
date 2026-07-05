export const INSUFFICIENT_WALLET_BALANCE_MESSAGE = 'Insufficient wallet balance. Update the wallet balance first.';

export const DEBT_ERROR_MESSAGES = {
  personNameRequired: 'Debt person name is required.',
  amountRequired: 'Debt amount must be greater than 0.',
  walletRequired: 'Select a wallet for this debt.',
  startDateRequired: 'Debt start date is required.',
  dueDateBeforeStartDate: 'Due date cannot be before the loan date.',
  walletNotFound: 'Wallet not found',
  debtNotFound: 'Debt record not found.',
  lockedAfterPayment: 'Amount or wallet cannot be changed after a payment exists.',
  paymentAmountRequired: 'Payment amount must be greater than 0.',
  paymentDateRequired: 'Payment date is required.',
  closedDebtPayment: 'Closed debt cannot receive another payment.',
  paymentExceedsRemaining: 'Payment amount cannot exceed the remaining balance.',
  writeOffOnlyReceivable: 'Write off is only available for receivables.',
} as const;

export const DEBT_PAYMENT_NOTE_KEYS = {
  loanReceived: 'Debt note loan received',
  loanGiven: 'Debt note loan given',
  markedPaidNoCashflow: 'Debt note marked paid without cashflow',
  writtenOffNoCashflow: 'Debt note receivable written off without cashflow',
} as const;

const APP_ERROR_KEYS = new Set<string>([
  INSUFFICIENT_WALLET_BALANCE_MESSAGE,
  ...Object.values(DEBT_ERROR_MESSAGES),
]);

const DEBT_PAYMENT_NOTE_KEY_SET = new Set<string>(Object.values(DEBT_PAYMENT_NOTE_KEYS));

const LEGACY_DEBT_PAYMENT_NOTE_KEYS: Record<string, string> = {
  'Uang pinjaman diterima': DEBT_PAYMENT_NOTE_KEYS.loanReceived,
  'Pinjaman diberikan': DEBT_PAYMENT_NOTE_KEYS.loanGiven,
  'Ditandai lunas tanpa perubahan saldo wallet': DEBT_PAYMENT_NOTE_KEYS.markedPaidNoCashflow,
  'Piutang diikhlaskan tanpa perubahan saldo wallet': DEBT_PAYMENT_NOTE_KEYS.writtenOffNoCashflow,
};

export function getKnownErrorMessage(error: unknown, t: (key: string) => string, fallbackKey: string): string {
  if (error instanceof Error && APP_ERROR_KEYS.has(error.message)) {
    return t(error.message);
  }
  return t(fallbackKey);
}

export function getDisplayDebtPaymentNote(note: string, t: (key: string) => string): string {
  const key = LEGACY_DEBT_PAYMENT_NOTE_KEYS[note] ?? (DEBT_PAYMENT_NOTE_KEY_SET.has(note) ? note : null);
  return key ? t(key) : note;
}
