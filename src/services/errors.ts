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

// ── Storage Error Taxonomy ─────────────────────────────────────

/**
 * Internal error codes for storage-related failures.
 * Each code maps to a user-facing title, explanation, and recovery action.
 */
export type StorageErrorCode =
  | 'IDB_UNAVAILABLE'
  | 'PRIVATE_BROWSING'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'MIGRATION_FAILED'
  | 'DB_TRANSACTION_ABORTED'
  | 'CORRUPTED_RECORDS'
  | 'UNSUPPORTED_BACKUP_VERSION'
  | 'INVALID_IMPORT_FILE'
  | 'SW_VERSION_MISMATCH'
  | 'UNKNOWN';

export interface StorageErrorInfo {
  /** Internal error code */
  code: StorageErrorCode;
  /** User-facing title translation key */
  titleKey: string;
  /** User-facing explanation translation key */
  messageKey: string;
  /** Recovery action translation key */
  recoveryKey: string;
  /** Whether safe technical details can be shown */
  allowTechDetails: boolean;
}

/**
 * All known storage error types with their user-facing metadata.
 * No sensitive financial content in diagnostic output.
 */
export const STORAGE_ERRORS: Record<StorageErrorCode, Omit<StorageErrorInfo, 'code'>> = {
  IDB_UNAVAILABLE: {
    titleKey: 'error.storage.idbUnavailableTitle',
    messageKey: 'error.storage.idbUnavailableMessage',
    recoveryKey: 'error.storage.idbUnavailableRecovery',
    allowTechDetails: false,
  },
  PRIVATE_BROWSING: {
    titleKey: 'error.storage.privateBrowsingTitle',
    messageKey: 'error.storage.privateBrowsingMessage',
    recoveryKey: 'error.storage.privateBrowsingRecovery',
    allowTechDetails: false,
  },
  STORAGE_QUOTA_EXCEEDED: {
    titleKey: 'error.storage.quotaExceededTitle',
    messageKey: 'error.storage.quotaExceededMessage',
    recoveryKey: 'error.storage.quotaExceededRecovery',
    allowTechDetails: true,
  },
  MIGRATION_FAILED: {
    titleKey: 'error.storage.migrationFailedTitle',
    messageKey: 'error.storage.migrationFailedMessage',
    recoveryKey: 'error.storage.migrationFailedRecovery',
    allowTechDetails: true,
  },
  DB_TRANSACTION_ABORTED: {
    titleKey: 'error.storage.transactionAbortedTitle',
    messageKey: 'error.storage.transactionAbortedMessage',
    recoveryKey: 'error.storage.transactionAbortedRecovery',
    allowTechDetails: false,
  },
  CORRUPTED_RECORDS: {
    titleKey: 'error.storage.corruptedRecordsTitle',
    messageKey: 'error.storage.corruptedRecordsMessage',
    recoveryKey: 'error.storage.corruptedRecordsRecovery',
    allowTechDetails: false,
  },
  UNSUPPORTED_BACKUP_VERSION: {
    titleKey: 'error.storage.unsupportedBackupVersionTitle',
    messageKey: 'error.storage.unsupportedBackupVersionMessage',
    recoveryKey: 'error.storage.unsupportedBackupVersionRecovery',
    allowTechDetails: true,
  },
  INVALID_IMPORT_FILE: {
    titleKey: 'error.storage.invalidImportFileTitle',
    messageKey: 'error.storage.invalidImportFileMessage',
    recoveryKey: 'error.storage.invalidImportFileRecovery',
    allowTechDetails: false,
  },
  SW_VERSION_MISMATCH: {
    titleKey: 'error.storage.swVersionMismatchTitle',
    messageKey: 'error.storage.swVersionMismatchMessage',
    recoveryKey: 'error.storage.swVersionMismatchRecovery',
    allowTechDetails: false,
  },
  UNKNOWN: {
    titleKey: 'error.storage.unknownTitle',
    messageKey: 'error.storage.unknownMessage',
    recoveryKey: 'error.storage.unknownRecovery',
    allowTechDetails: true,
  },
};

interface StorageErrorMatcher {
  code: StorageErrorCode;
  matches: (lower: string) => boolean;
}

/**
 * Lower-cased, stringified error text for pattern matching.
 * Avoids the default '[object Object]' stringification of plain objects.
 */
function errorMessageText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    try {
      const serialized = JSON.stringify(error);
      if (serialized) return serialized;
    } catch {
      // fall through to the generic fallback
    }
  }
  return 'Unknown error';
}

const STORAGE_ERROR_MATCHERS: StorageErrorMatcher[] = [
  { code: 'IDB_UNAVAILABLE', matches: (m) => m.includes('indexeddb') && (m.includes('unavailable') || m.includes('not available') || m.includes('not supported')) },
  { code: 'PRIVATE_BROWSING', matches: (m) => m.includes('private') && (m.includes('browsing') || m.includes('mode')) },
  { code: 'STORAGE_QUOTA_EXCEEDED', matches: (m) => m.includes('quota') || m.includes('exceeded') || m.includes('full') },
  { code: 'MIGRATION_FAILED', matches: (m) => m.includes('migration') && (m.includes('fail') || m.includes('version')) },
  { code: 'DB_TRANSACTION_ABORTED', matches: (m) => m.includes('abort') || (m.includes('transaction') && m.includes('fail')) },
  { code: 'CORRUPTED_RECORDS', matches: (m) => m.includes('corrupt') || m.includes('unreadable') || m.includes('integrity') },
  { code: 'UNSUPPORTED_BACKUP_VERSION', matches: (m) => m.includes('backup') && (m.includes('version') || m.includes('unsupported')) },
  { code: 'INVALID_IMPORT_FILE', matches: (m) => m.includes('import') && (m.includes('invalid') || m.includes('malformed')) },
  { code: 'SW_VERSION_MISMATCH', matches: (m) => m.includes('service worker') || m.includes('version mismatch') },
];

/**
 * Classify an error into a known StorageErrorCode.
 * Returns UNKNOWN if the error does not match any known pattern.
 */
export function classifyStorageError(error: unknown): StorageErrorCode {
  if (!error) return 'UNKNOWN';
  const lower = errorMessageText(error).toLowerCase();
  for (const { code, matches } of STORAGE_ERROR_MATCHERS) {
    if (matches(lower)) return code;
  }
  return 'UNKNOWN';
}

/**
 * Get the full StorageErrorInfo for a given error.
 * Classifies the error and returns the matching info, or UNKNOWN fallback.
 */
export function getStorageErrorInfo(error: unknown): StorageErrorInfo {
  const code = classifyStorageError(error);
  return {
    code,
    ...STORAGE_ERRORS[code],
  };
}

// ── Existing helpers ───────────────────────────────────────────

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
