import { useEffect, useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { parseChatInput } from '../utils/chatParser';
import { parseReceiptText } from '../utils/receiptParser';
import { recognizeImage, isOcrReady } from '../utils/ocr';
import { fmtIDR } from '../utils/format';
import { Send, Check, Gallery, ChatRoundDots, Receipt, Camera, ChevronDown, X } from 'reicon-react';
import { Link } from 'react-router-dom';
import { InlineAlert } from '../components/InlineAlert';

type Pending = { description: string; amount: number; date: string; note?: string; source?: string };

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatView() {
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrAvailable, setOcrAvailable] = useState(isOcrReady());
  const [confirmBeforeSave] = useState(() => {
    const v = localStorage.getItem('confirmSave');
    return v === null ? true : v === 'true';
  });
  const confirmBeforeSaveRef = useRef(confirmBeforeSave);
  confirmBeforeSaveRef.current = confirmBeforeSave;
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messages = useLiveQuery(() => db.chatMessages.orderBy('createdAt').toArray(), []) ?? [];
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // Always scroll to bottom when messages change (new message, OCR, pending)
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
  }, [messages.length, pending, ocrProgress]);

  // Track scroll position for "back to latest" button
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    setShowScrollBtn(!isNearBottom && messages.length > 0);
  }, [messages.length]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [input]);

  // Auto-save when confirmBeforeSave is off
  useEffect(() => {
    if (pending && pending.amount > 0 && !confirmBeforeSaveRef.current) {
      saveNow(pending);
    }
  }, [pending]);

  // Handle share target
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('share')) return;
    (async () => {
      try {
        const cache = await caches.open('share-cache');
        const fileRes = await cache.match('shared-file');
        if (fileRes) {
          const blob = await fileRes.blob();
          const name = decodeURIComponent(fileRes.headers.get('x-file-name') || 'receipt.png');
          const type = fileRes.headers.get('content-type') || 'image/png';
          const file = new File([blob], name, { type });
          await handleFile(file);
          await cache.delete('shared-file');
        }
        const metaRes = await cache.match('shared-meta');
        if (metaRes) {
          const meta = await metaRes.json();
          const sharedText = [meta.text, meta.url].filter(Boolean).join(' ').trim();
          if (sharedText) {
            const parsed = parseChatInput(sharedText);
            if (parsed) {
              setPending({ description: parsed.description, amount: parsed.amount, date: new Date().toISOString().slice(0, 10) });
            } else if (!fileRes) {
              setInput(sharedText.slice(0, 80));
            }
          }
          await cache.delete('shared-meta');
        }
        window.history.replaceState({}, '', '/chat');
      } catch {}
    })();
  }, []);

  // Handle mode=upload from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'upload') {
      fileRef.current?.click();
      window.history.replaceState({}, '', '/chat');
    }
  }, []);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const now = new Date().toISOString();
    await db.chatMessages.add({ role: 'user', text, createdAt: now });
    const parsed = parseChatInput(text);
    if (!parsed) {
      await db.chatMessages.add({
        role: 'assistant',
        text: 'Nominal tidak terbaca. Contoh: "kopi 20rb" atau "50000 indomaret".',
        createdAt: new Date().toISOString(),
      });
      setIsSending(false);
      return;
    }
    const today = now.slice(0, 10);
    const p: Pending = { description: parsed.description, amount: parsed.amount, date: parsed.date || today, source: parsed.source };
    setPending(p);
    await db.chatMessages.add({
      role: 'assistant',
      text: `Siap dicatat: ${p.description} - ${fmtIDR(p.amount)}`,
      createdAt: new Date().toISOString(),
      parsed: p,
    });
    setIsSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/') || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setOcrError('Gunakan gambar JPG, PNG, atau WebP dengan ukuran maksimal 10 MB.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setOcrError('Ukuran gambar maksimal 10 MB. Coba kompres atau potong gambar.');
      return;
    }
    setOcrError(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setOcrProgress(0);
    try {
      const text = await recognizeImage(file, (n) => setOcrProgress(n));
      const parsed = parseReceiptText(text);
      if (!parsed) {
        setPending({ description: 'Transfer', amount: 0, date: new Date().toISOString().slice(0, 10) });
        setOcrError('Bukti tidak dapat dibaca. Coba gunakan foto yang lebih jelas atau masukkan transaksi secara manual.');
        await db.chatMessages.add({
          role: 'assistant',
          text: 'Foto kurang jelas. Silakan edit detail di bawah atau masukkan ulang.',
          createdAt: new Date().toISOString(),
        });
        return;
      }
      setPending({ description: parsed.description, amount: parsed.amount, date: parsed.date, note: parsed.note, source: parsed.source });
      await db.chatMessages.add({
        role: 'assistant',
        text: `Siap dicatat: ${parsed.description} - ${fmtIDR(parsed.amount)}`,
        createdAt: new Date().toISOString(),
        parsed: { description: parsed.description, amount: parsed.amount },
      });
    } catch {
      setOcrError('Gagal membaca bukti. Sambungkan internet sekali untuk mengunduh model OCR.');
    } finally {
      setOcrProgress(null);
      setOcrAvailable(isOcrReady());
      URL.revokeObjectURL(url);
      setPreviewUrl(null);
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  }

  async function saveNow(p: Pending) {
    if (!p.amount) return;
    try {
      const now = new Date().toISOString();
      const txId = (await db.transactions.add({
        description: p.description,
        amount: p.amount,
        date: p.date,
        createdAt: now,
        rawText: p.description,
        note: p.note || undefined,
        source: p.source || undefined,
      })) as number;
      await db.chatMessages.add({
        role: 'assistant',
        text: `Tercatat. ${p.description} - ${fmtIDR(p.amount)}`,
        createdAt: new Date().toISOString(),
        txId,
      });
      await db.chatMessages.add({
        role: 'assistant',
        text: '__LINK_RINGKASAN__',
        createdAt: new Date().toISOString(),
      });
      setPending(null);
      setOcrError(null);
    } catch {
      setOcrError('Gagal menyimpan transaksi. Coba lagi.');
    }
  }

  async function confirmSave() {
    if (!pending?.amount) return;
    await saveNow(pending);
  }

  return (
    <div
      className="flex flex-col h-full min-h-0"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
            <ChatRoundDots size={18} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight leading-tight">Catat pengeluaran</h1>
            <p className="text-xs text-[var(--text-secondary)] leading-tight mt-0.5">Ketik transaksi atau unggah bukti</p>
          </div>
          <div className="ml-auto hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bone)] text-[var(--text-secondary)] text-[12px] font-semibold border border-[var(--border)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
            <span>{ocrAvailable ? 'Siap diproses' : 'Memuat pemroses...'}</span>
          </div>
        </div>
      </div>

      {/* Empty state - outside of role="log" */}
      {messages.length === 0 && !pending && (
        <div className="flex-1 min-h-0 flex items-start pt-6">
          <div className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] border border-[var(--border)]/60 grid place-items-center shrink-0 shadow-sm">
                <Receipt size={18} className="text-[var(--accent)]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold tracking-tight leading-none">Mulai mencatat</p>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">Ketik deskripsi, nominal, dan sumber dana.</p>
                <div className="mt-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-[var(--border)]/60 bg-[var(--card)] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" aria-hidden />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" aria-hidden />
                    <span className="text-[11px] font-mono tracking-wide text-[var(--text-muted)] uppercase">Contoh</span>
                  </div>
                  <div className="px-3 py-2.5 space-y-1 font-mono text-[12px] leading-5 text-[var(--text-secondary)]">
                    <p>kopi <span className="text-[var(--accent)] font-medium">25rb</span> <span className="text-[var(--text-muted)]">dari BSI</span></p>
                    <p>bayar listrik <span className="text-[var(--accent)] font-medium">200rb</span> <span className="text-[var(--text-muted)]">via GoPay</span></p>
                    <p>belanja indomaret <span className="text-[var(--accent)] font-medium">50000</span></p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full min-h-12 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
              >
                <Gallery size={16} aria-hidden />
                Unggah bukti transaksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message log */}
      {(messages.length > 0 || pending || ocrProgress !== null) && (
        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Percakapan"
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 py-4 pb-8 space-y-3"
        >
          <h2 className="sr-only">Percakapan</h2>
          {messages.map((m) => (
            <div key={m.id} className="flex motion-safe:animate-[in_0.2s_ease-out] motion-reduce:animate-none" style={{ contentVisibility: 'auto' } as any}>
              <div className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[76%]">
                  <div
                    className={`px-4 py-3 text-sm leading-[22px] ${
                      m.role === 'user'
                        ? 'bg-[var(--accent)] text-[var(--accent-ink)] rounded-[18px] rounded-br-[6px]'
                        : 'bg-[var(--card)] border border-[var(--border)] rounded-[18px] rounded-bl-[6px]'
                    }`}
                  >
                    {m.text === '__LINK_RINGKASAN__' ? (
                      <Link to="/" className="text-sm font-semibold text-[var(--accent)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded">
                        Lihat di Ringkasan
                      </Link>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    )}
                  </div>
                  <p className={`mt-1 text-[12px] tabular-nums ${m.role === 'user' ? 'text-right text-[var(--text-muted)]' : 'text-[var(--text-muted)]'}`}>
                    {fmtTime(m.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {ocrProgress !== null && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
              {previewUrl && (
                <div className="mb-3 rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)]">
                  <img src={previewUrl} alt="Bukti yang diunggah" className="w-full max-h-48 object-cover" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--bg)] border border-[var(--border)] grid place-items-center">
                  <Gallery size={14} className="text-[var(--text-secondary)]" aria-hidden />
                </div>
                <p className="text-xs font-semibold" aria-live="polite">
                  Membaca bukti... {ocrProgress}%
                </p>
                <span className="ml-auto text-[12px] text-[var(--text-muted)]">offline</span>
              </div>
              <progress value={ocrProgress} max={100} aria-label="Memindai bukti" aria-valuetext={`${ocrProgress}%`} className="mt-3 h-1.5 w-full rounded-full overflow-hidden" />
              <p className="text-[12px] text-[var(--text-muted)] mt-2">Tetap di halaman ini, jangan tutup.</p>
            </div>
          )}

          {ocrError && <InlineAlert type="error">{ocrError}</InlineAlert>}

          {pending && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--card)] p-5 motion-safe:animate-[in_0.2s_ease-out] motion-reduce:animate-none">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] grid place-items-center">
                  <Check size={14} aria-hidden />
                </div>
                <p className="text-xs font-bold tracking-wide uppercase text-[var(--accent)]">Periksa transaksi</p>
              </div>
              <div className="mt-4 space-y-3">
                <label htmlFor="pending-desc" className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Deskripsi</span>
                  <input
                    id="pending-desc"
                    value={pending.description}
                    onChange={(e) => setPending({ ...pending, description: e.target.value })}
                    autoComplete="off"
                    placeholder="Misal: Toko Kopi"
                    className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label htmlFor="pending-amount" className="block">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">Nominal</span>
                    <input
                      id="pending-amount"
                      type="number"
                      inputMode="numeric"
                      value={pending.amount || ''}
                      onChange={(e) => setPending({ ...pending, amount: Number(e.target.value) || 0 })}
                      placeholder="50000"
                      className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                    />
                  </label>
                  <label htmlFor="pending-date" className="block">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">Tanggal</span>
                    <input
                      id="pending-date"
                      type="date"
                      value={pending.date}
                      onChange={(e) => setPending({ ...pending, date: e.target.value })}
                      className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                    />
                  </label>
                </div>
                <label htmlFor="pending-source" className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Sumber dana</span>
                  <input
                    id="pending-source"
                    value={pending.source ?? ''}
                    onChange={(e) => setPending({ ...pending, source: e.target.value })}
                    autoComplete="off"
                    placeholder="Tunai, Transfer Bank, GoPay..."
                    className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                  />
                </label>
                <label htmlFor="pending-note" className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Catatan <span className="text-[var(--text-muted)]">(opsional)</span></span>
                  <input
                    id="pending-note"
                    value={pending.note ?? ''}
                    onChange={(e) => setPending({ ...pending, note: e.target.value })}
                    autoComplete="off"
                    placeholder="Misal: untuk bulanan"
                    className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                  />
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-[var(--bg)] border border-[var(--border)] font-medium tabular-nums">{fmtIDR(pending.amount || 0)}</span>
                  <span className="text-[var(--text-muted)]">&middot;</span>
                  <span className="text-[var(--text-secondary)] tabular-nums">{pending.date}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={confirmSave}
                  disabled={!pending.amount}
                  className="flex-1 min-h-12 py-3 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                >
                  <Check size={16} aria-hidden />
                  Simpan transaksi
                </button>
                <button
                  type="button"
                  onClick={() => { setPending(null); setOcrError(null); }}
                  className="min-h-12 px-5 rounded-[var(--radius-md)] bg-[var(--bg)] border border-[var(--border)] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[var(--card)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                >
                  <X size={16} aria-hidden />
                  Batalkan
                </button>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      )}

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          type="button"
          aria-label="Kembali ke pesan terbaru"
          onClick={() => {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            endRef.current?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
          }}
          className="absolute bottom-24 md:bottom-20 left-1/2 -translate-x-1/2 z-20 min-w-12 min-h-12 w-12 h-12 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-md grid place-items-center hover:bg-[var(--bone)] active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
        >
          <ChevronDown size={16} aria-hidden />
        </button>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-[var(--accent)]/5 backdrop-blur-[1px] grid place-items-center p-6">
          <div className="rounded-[var(--radius-lg)] bg-[var(--card)] border-2 border-dashed border-[var(--accent)] p-6 text-center shadow-lg">
            <Gallery size={20} className="mx-auto text-[var(--accent)]" aria-hidden />
            <p className="text-sm font-bold mt-2">Lepas bukti di sini</p>
            <p className="text-xs text-[var(--text-secondary)]">JPG, PNG, atau WebP &middot; maks 10 MB</p>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 bg-[var(--bg)] px-4 md:px-6 pt-3 pb-[calc(66px+env(safe-area-inset-bottom))] md:pb-[calc(10px+env(safe-area-inset-bottom))">
        <form onSubmit={handleSend} className="flex items-end gap-2 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-[var(--accent)]/20 focus-within:border-[var(--accent)] transition-all">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <button
            type="button"
            aria-label="Pilih bukti dari galeri"
            onClick={() => fileRef.current?.click()}
            className="w-12 h-12 rounded-full bg-[var(--bg)] border border-[var(--border)] grid place-items-center shrink-0 hover:bg-[var(--border)] active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            <Gallery size={18} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Ambil foto bukti transaksi"
            onClick={() => cameraRef.current?.click()}
            className="w-12 h-12 rounded-full bg-[var(--bg)] border border-[var(--border)] grid place-items-center shrink-0 hover:bg-[var(--border)] active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 md:hidden"
          >
            <Camera size={18} aria-hidden />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Contoh: kopi 25rb"
            aria-label="Tulis pengeluaran"
            autoComplete="off"
            enterKeyHint="send"
            className="flex-1 min-w-0 min-h-[44px] max-h-32 bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-[var(--text-muted)] resize-none leading-snug"
          />
          <button
            type="submit"
            aria-label={isSending ? 'Memproses transaksi' : 'Kirim transaksi'}
            disabled={!input.trim() || isSending}
            aria-busy={isSending}
            className="w-12 h-12 rounded-full bg-[var(--accent-fill)] text-[var(--accent-ink)] grid place-items-center shrink-0 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            {isSending ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
            ) : (
              <Send size={18} aria-hidden />
            )}
          </button>
        </form>
        <p className="text-[11px] tracking-wide text-[var(--text-secondary)] text-center mt-2.5">
          <span className="hidden md:inline">Enter kirim · Shift+Enter baris baru · Tarik bukti ke area chat</span>
          <span className="md:hidden">Tarik bukti ke area chat untuk unggah</span>
        </p>
      </div>

      <style>{String.raw`@keyframes in { from { opacity:0; transform: translateY(4px)} to { opacity:1; transform: translateY(0)} } @media (prefers-reduced-motion: reduce) { .motion-safe\:animate-pulse, .motion-safe\:animate-\[in_0\.2s_ease-out\] { animation: none !important; } }`}</style>
    </div>
  );
}
