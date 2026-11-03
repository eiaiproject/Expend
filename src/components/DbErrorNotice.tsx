/**
 * Kegagalan baca IndexedDB tidak boleh berakhir sebagai skeleton tanpa akhir.
 * Notice ini memberi tahu pengguna bahwa data gagal dimuat dan menyediakan
 * satu tindakan yang jelas: buka ulang database lalu render ulang query.
 */
export function DbErrorNotice({
  message,
  retryLabel,
  onRetry,
}: {
  readonly message: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="text-xs px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] flex items-center gap-2"
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 min-h-12 px-3 rounded-[var(--radius-md)] bg-[var(--danger-fill)] text-[var(--danger-fill-ink)] text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        {retryLabel}
      </button>
    </div>
  );
}
