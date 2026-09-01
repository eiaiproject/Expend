import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { parseChatInput } from '../utils/chatParser';
import { parseReceiptText } from '../utils/receiptParser';
import { recognizeImage } from '../utils/ocr';
import { fmtIDR } from '../utils/format';
import { Send, Check, Edit2, Gallery, ChatRoundDots, Receipt } from 'reicon-react';

type Pending = { description: string; amount: number; date: string };

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
  const fileRef = useRef<HTMLInputElement>(null);
  const messages = useLiveQuery(() => db.chatMessages.orderBy('createdAt').toArray(), []) ?? [];
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pending, ocrProgress]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    const now = new Date().toISOString();
    await db.chatMessages.add({ role: 'user', text, createdAt: now });
    const parsed = parseChatInput(text);
    if (!parsed) {
      await db.chatMessages.add({
        role: 'assistant',
        text: 'Nominal tidak terbaca. Contoh: "kopi 20rb" atau "50000 indomaret".',
        createdAt: new Date().toISOString(),
      });
      return;
    }
    const today = now.slice(0, 10);
    const p: Pending = { description: parsed.description, amount: parsed.amount, date: today };
    setPending(p);
    await db.chatMessages.add({
      role: 'assistant',
      text: `Siap dicatat: ${p.description} - ${fmtIDR(p.amount)}`,
      createdAt: new Date().toISOString(),
      parsed: p,
    });
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setOcrError('File harus gambar');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setOcrError('File harus <5MB');
      return;
    }
    setOcrError(null);
    setOcrProgress(0);
    try {
      const text = await recognizeImage(file, (n) => setOcrProgress(n));
      const parsed = parseReceiptText(text);
      if (!parsed) {
        setPending({ description: 'Transfer', amount: 0, date: new Date().toISOString().slice(0, 10) });
        setOcrError('Nominal tidak terbaca. Edit manual.');
        await db.chatMessages.add({
          role: 'assistant',
          text: 'Foto kurang jelas - silakan edit manual.',
          createdAt: new Date().toISOString(),
        });
        return;
      }
      setPending({ description: parsed.description, amount: parsed.amount, date: parsed.date });
      await db.chatMessages.add({
        role: 'assistant',
        text: `Siap dicatat: ${parsed.description} - ${fmtIDR(parsed.amount)}`,
        createdAt: new Date().toISOString(),
        parsed: { description: parsed.description, amount: parsed.amount },
      });
    } catch {
      setOcrError('Gagal membaca bukti. Sambungkan internet sekali untuk download model.');
    } finally {
      setOcrProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function confirmSave() {
    if (!pending?.amount) return;
    const now = new Date().toISOString();
    const txId = (await db.transactions.add({
      description: pending.description,
      amount: pending.amount,
      date: pending.date,
      createdAt: now,
      rawText: pending.description,
    })) as number;
    await db.chatMessages.add({
      role: 'assistant',
      text: `Tercatat ✓ ${pending.description} - ${fmtIDR(pending.amount)}`,
      createdAt: new Date().toISOString(),
      txId,
    });
    setPending(null);
    setOcrError(null);
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0 -mx-4 md:mx-0"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 -mt-5 md:mt-0 -mx-4 md:mx-0 px-4 md:px-0 py-3 bg-[var(--bg)]/80 backdrop-blur-md border-b border-transparent">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white grid place-items-center">
            <ChatRoundDots size={16} />
          </div>
          <div>
            <h1 className="text-[13px] font-bold leading-none">Chat Expend</h1>
            <p className="text-xs text-[var(--text-secondary)] leading-none mt-1">Ketik atau upload bukti • offline</p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Offline-ready
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 md:px-0 py-4 space-y-3 pr-1">
        {messages.length === 0 && (
          <div className="rounded-[16px] border border-dashed border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--bg)] border border-[var(--border)] grid place-items-center shrink-0">
                <Receipt size={18} className="text-[var(--text-secondary)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-wrap-balance">Mulai catat</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 text-wrap-pretty">Ketik "kopi 20rb" atau upload bukti transfer - total otomatis, tanggal bisa diedit.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <div className="font-mono text-xs bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 flex items-center justify-between">
                <span>beli kopi di Indomaret 50000</span>
                <span className="text-[11px] text-[var(--text-muted)]">tap untuk isi</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="h-px flex-1 bg-[var(--border)]" />
                <span>atau</span>
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--card)] transition-colors"
              >
                <Gallery size={16} /> Upload bukti transfer
              </button>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-[in_0.2s_ease-out]`}>
            <div className="max-w-[76%]">
              <div
                className={`px-4 py-3 text-sm leading-[22px] shadow-sm ${
                  m.role === 'user'
                    ? 'bg-[var(--accent)] text-white rounded-[18px] rounded-br-[6px]'
                    : 'bg-[var(--card)] border border-[var(--border)] rounded-[18px] rounded-bl-[6px]'
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-wrap-pretty">{m.text}</p>
              </div>
              <p className={`mt-1 text-[11px] tabular-nums ${m.role === 'user' ? 'text-right text-[var(--text-muted)]' : 'text-[var(--text-muted)]'}`}>
                {fmtTime(m.createdAt)}
              </p>
            </div>
          </div>
        ))}

        {ocrProgress !== null && (
          <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--bg)] border border-[var(--border)] grid place-items-center">
                <Gallery size={14} className="text-[var(--text-secondary)]" />
              </div>
              <p className="text-xs font-semibold" aria-live="polite">
                Membaca bukti… {ocrProgress}%
              </p>
              <span className="ml-auto text-[11px] text-[var(--text-muted)]">offline</span>
            </div>
            <progress value={ocrProgress} max={100} aria-label="Memindai bukti" aria-valuetext={`${ocrProgress}%`} className="mt-3 h-1.5 w-full rounded-full overflow-hidden" />
            <p className="text-[11px] text-[var(--text-muted)] mt-2">Tetap di halaman ini, jangan tutup.</p>
          </div>
        )}

        {ocrError && (
          <p id="ocr-error" role="alert" aria-live="polite" className="text-xs px-3 py-2.5 rounded-xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)]">
            {ocrError}
          </p>
        )}

        {pending && (
          <div className="rounded-[20px] border border-[var(--accent)] bg-[var(--card)] shadow-md p-5 animate-[in_0.2s_ease-out]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-white grid place-items-center">
                <Check size={14} />
              </div>
              <p className="text-xs font-bold tracking-wide uppercase text-[var(--accent)]">Preview</p>
              <span className="ml-auto text-[11px] px-2 py-1 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)]">bisa diedit</span>
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
                  className="mt-1 w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
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
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                  />
                </label>
                <label htmlFor="pending-date" className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Tanggal</span>
                  <input
                    id="pending-date"
                    type="date"
                    value={pending.date}
                    onChange={(e) => setPending({ ...pending, date: e.target.value })}
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-[var(--bg)] border border-[var(--border)] font-medium tabular-nums">{fmtIDR(pending.amount || 0)}</span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-secondary)] tabular-nums">{pending.date}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={confirmSave}
                disabled={!pending.amount}
                className="flex-1 py-3 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all shadow-sm"
              >
                <Check size={16} /> Simpan
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setOcrError(null);
                }}
                className="px-5 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[var(--card)] active:scale-[0.98] transition-all"
              >
                <Edit2 size={16} /> Batal
              </button>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-[var(--accent)]/5 backdrop-blur-[1px] grid place-items-center p-6">
          <div className="rounded-[16px] bg-[var(--card)] border-2 border-dashed border-[var(--accent)] p-6 text-center shadow-lg">
            <Gallery size={20} className="mx-auto text-[var(--accent)]" />
            <p className="text-sm font-bold mt-2">Lepas bukti di sini</p>
            <p className="text-xs text-[var(--text-secondary)]">JPG/PNG/WebP - max 5MB</p>
          </div>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSend} className="sticky bottom-0 bg-[var(--bg)] pt-3 pb-[calc(10px+env(safe-area-inset-bottom))] mt-2">
        <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-[20px] p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-[var(--accent)]/20 focus-within:border-[var(--accent)] transition-all">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }} />
          <button
            type="button"
            aria-label="upload bukti"
            onClick={() => fileRef.current?.click()}
            className="w-10 h-10 rounded-full bg-[var(--bg)] border border-[var(--border)] grid place-items-center shrink-0 hover:bg-[var(--border)] active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Gallery size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis pengeluaran, mis: kopi 25rb"
            className="flex-1 h-10 bg-transparent px-2 text-sm outline-none placeholder:text-[var(--text-muted)]"
          />
          <button
            type="submit"
            aria-label="kirim"
            disabled={!input.trim()}
            className="w-10 h-10 rounded-full bg-[var(--accent-fill)] text-[var(--accent-ink)] grid place-items-center shrink-0 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] text-center mt-2 hidden md:block">Enter untuk kirim • drag bukti ke chat</p>
      </form>

      <style>{`@keyframes in { from { opacity:0; transform: translateY(4px)} to { opacity:1; transform: translateY(0)} }`}</style>
    </div>
  );
}
