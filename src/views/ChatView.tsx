import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { parseChatInput } from '../utils/chatParser';
import { parseReceiptText } from '../utils/receiptParser';
import { recognizeImage } from '../utils/ocr';
import { fmtIDR } from '../utils/format';
import { Send, Check, Edit2, Gallery } from 'reicon-react';

type Pending = { description: string; amount: number; date: string };

export default function ChatView() {
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messages = useLiveQuery(() => db.chatMessages.orderBy('createdAt').toArray(), []) ?? [];
  const endRef = useRef<HTMLDivElement>(null);
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

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)] text-wrap-balance">Coba ketik:</p>
            <p className="mt-2 font-mono text-xs bg-[var(--bg)] rounded-lg px-3 py-2 border border-[var(--border)]">beli kopi di Indomaret 50000</p>
            <p className="mt-2 text-xs text-wrap-pretty">Akan tercatat - Kopi Di Indomaret · Rp50.000</p>
            <p className="mt-3 text-xs text-[var(--text-muted)] text-wrap-pretty">Atau upload bukti transfer via tombol galeri.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${m.role === 'user' ? 'bg-[var(--accent)] text-white rounded-br-md' : 'bg-[var(--card)] border border-[var(--border)] rounded-bl-md'}`}
            >
              <p className="whitespace-pre-wrap break-words text-wrap-pretty">{m.text}</p>
            </div>
          </div>
        ))}
        {ocrProgress !== null && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="text-xs font-medium text-wrap-balance" aria-live="polite">
              Membaca bukti… {ocrProgress}%
            </p>
            <progress value={ocrProgress} max={100} aria-label="Memindai bukti" className="mt-2 h-1.5 w-full rounded-full overflow-hidden" />
          </div>
        )}
        {ocrError && (
          <p role="alert" aria-live="polite" className="text-xs px-2 py-2 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)]">
            {ocrError}
          </p>
        )}
        {pending && (
          <div className="rounded-xl border border-[var(--accent)] bg-[var(--card)] p-4">
            <p className="text-xs font-bold tracking-wide uppercase text-[var(--accent)]">Preview</p>
            <div className="mt-3 space-y-3">
              <label htmlFor="pending-desc" className="block">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Deskripsi</span>
                <input
                  id="pending-desc"
                  value={pending.description}
                  onChange={(e) => setPending({ ...pending, description: e.target.value })}
                  autoComplete="off"
                  className="mt-1 w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
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
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </label>
                <label htmlFor="pending-date" className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Tanggal</span>
                  <input
                    id="pending-date"
                    type="date"
                    value={pending.date}
                    onChange={(e) => setPending({ ...pending, date: e.target.value })}
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </label>
              </div>
              <p className="text-xs text-[var(--text-secondary)] tabular-nums">
                {fmtIDR(pending.amount || 0)} · {pending.date}
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={confirmSave}
                disabled={!pending.amount}
                className="flex-1 py-2.5 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all"
              >
                <Check size={16} /> Simpan
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setOcrError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm font-medium inline-flex items-center gap-2 hover:bg-[var(--card)] active:scale-[0.98] transition-all"
              >
                <Edit2 size={16} /> Batal
              </button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="sticky bottom-0 bg-[var(--bg)] pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] flex gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }} />
        <button
          type="button"
          aria-label="upload bukti"
          onClick={() => fileRef.current?.click()}
          className="w-11 h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] grid place-items-center shrink-0 hover:bg-[var(--bg)] active:scale-95 disabled:opacity-40 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Gallery size={18} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tulis pengeluaran, mis: kopi 25rb"
          className="flex-1 h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
        />
        <button
          type="submit"
          aria-label="kirim"
          className="w-11 h-11 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] grid place-items-center shrink-0 hover:opacity-90 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
