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
    <div className="flex flex-col h-[calc(100dvh-56px)] md:h-[calc(100dvh-32px)]" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">Coba ketik:</p>
            <p className="mt-2 font-mono text-xs bg-[var(--bg)] rounded-lg px-3 py-2">beli kopi di Indomaret 50000</p>
            <p className="mt-2 text-xs">Akan tercatat → Kopi Di Indomaret · Rp50.000</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-[var(--accent)] text-white rounded-br-md' : 'bg-[var(--card)] border border-[var(--border)] rounded-bl-md'}`}
            >
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            </div>
          </div>
        ))}
        {ocrProgress !== null && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="text-xs font-medium">Membaca bukti… {ocrProgress}%</p>
            <progress value={ocrProgress} max={100} className="mt-2 h-1.5 w-full rounded-full overflow-hidden" />
          </div>
        )}
        {ocrError && <p className="text-xs text-red-600 px-1">{ocrError}</p>}
        {pending && (
          <div className="rounded-2xl border border-[var(--accent)] bg-[var(--card)] p-4">
            <p className="text-xs font-bold tracking-widest uppercase text-[var(--accent)]">Preview</p>
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="text-xs text-[var(--text-secondary)]">Deskripsi</span>
                <input
                  value={pending.description}
                  onChange={(e) => setPending({ ...pending, description: e.target.value })}
                  className="mt-1 w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-[var(--text-secondary)]">Nominal</span>
                  <input
                    type="number"
                    value={pending.amount || ''}
                    onChange={(e) => setPending({ ...pending, amount: Number(e.target.value) || 0 })}
                    className="mt-1 w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--text-secondary)]">Tanggal</span>
                  <input
                    type="date"
                    value={pending.date}
                    onChange={(e) => setPending({ ...pending, date: e.target.value })}
                    className="mt-1 w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </label>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{fmtIDR(pending.amount || 0)} · {pending.date}</p>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={confirmSave}
                className="flex-1 py-2.5 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold inline-flex items-center justify-center gap-2"
              >
                <Check size={16} /> Simpan
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setOcrError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm font-medium inline-flex items-center gap-2"
              >
                <Edit2 size={16} /> Batal
              </button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="sticky bottom-0 bg-[var(--bg)] pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] flex gap-2"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button
          type="button"
          aria-label="upload bukti"
          onClick={() => fileRef.current?.click()}
          className="w-11 h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] grid place-items-center shrink-0"
        >
          <Gallery size={18} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tulis pengeluaran, mis: kopi 25rb"
          className="flex-1 h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
        />
        <button type="submit" aria-label="kirim" className="w-11 h-11 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] grid place-items-center shrink-0">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
