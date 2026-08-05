import { WalletFormSheet } from './WalletFormSheet';
import type { Wallet } from '../../db/db';

interface EditWalletSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly wallet: Wallet;
}

/**
 * Edit Wallet flow. Thin wrapper around the shared WalletFormSheet so the
 * add/edit variants share one implementation (CPD-clean).
 */
export function EditWalletSheet({ isOpen, onClose, wallet }: EditWalletSheetProps) {
  return <WalletFormSheet isOpen={isOpen} onClose={onClose} wallet={wallet} />;
}
