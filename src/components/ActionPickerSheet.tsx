import { ArrowDownCircle, Handshake, Repeat } from 'lucide-react';
import { BottomSheetShell } from './BottomSheetShell';

interface ActionPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: () => void;
  onTransfer: () => void;
  onDebt: () => void;
}

export function ActionPickerSheet({
  isOpen,
  onClose,
  onAddExpense,
  onTransfer,
  onDebt,
}: ActionPickerSheetProps) {
  return (
    <BottomSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Catatan"
      ariaLabel="Pilih jenis catatan"
      heightClass="h-auto max-h-[80vh]"
    >
      <div className="px-3 py-4 space-y-3">
        <button
          type="button"
          onClick={onAddExpense}
          className="w-full rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4 text-left transition-colors hover:border-[var(--accent)]/60"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-500/10 p-2 text-red-500">
              <ArrowDownCircle size={20} />
            </div>
            <div>
              <h3 className="font-bold">Tambah Pengeluaran</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Catat transaksi biasa.</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onTransfer}
          className="w-full rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4 text-left transition-colors hover:border-[var(--accent)]/60"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
              <Repeat size={20} />
            </div>
            <div>
              <h3 className="font-bold">Transfer Wallet</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Pindahkan saldo antar wallet.</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onDebt}
          className="w-full rounded-[16px] border border-[var(--border)] bg-[var(--bg)] p-4 text-left transition-colors hover:border-[var(--accent)]/60"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-500">
              <Handshake size={20} />
            </div>
            <div>
              <h3 className="font-bold">Catat Utang / Piutang</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Pinjaman masuk atau keluar.</p>
            </div>
          </div>
        </button>
      </div>
    </BottomSheetShell>
  );
}
