import { WalletFormSheet } from './WalletFormSheet';

interface AddWalletSheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Add Wallet flow. Thin wrapper around the shared WalletFormSheet so the
 * add/edit variants share one implementation (CPD-clean).
 */
export function AddWalletSheet({ isOpen, onClose }: AddWalletSheetProps) {
  return <WalletFormSheet isOpen={isOpen} onClose={onClose} />;
}
