import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { parseChatInput } from '../utils/chatParser';
import { fmtIDR } from '../utils/format';
import { Send, Check, Edit2 } from 'reicon-react';

export default function ChatView() {
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<{ description: string; amount: number } | null>(null);
  const messages = useLiveQuery(() => db.chatMessages.orderBy('createdAt').toArray(), []) ?? [];
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, pending]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    const now = new Date().toISOString();
    await db.chatMessages.add({ role: 'user', text, createdAt: now });
    const parsed = parseChatInput(text);
    if (!parsed) {
      await db.chatMessages.add({ role: 'assistant', text: 'Nominal tidak terbaca. Contoh: "kopi 20rb" atau "50000 indomaret".', createdAt: new Date().toISOString() });
      return;
    }
    setPending(parsed);
    await db.chatMessages.add({ role: 'assistant', text: `Siap dicatat: ${parsed.description} — ${fmtIDR(parsed.amount)}`, createdAt: new Date().toISOString(), parsed });
  }

  async function confirmSave() {
    if (!pending) return;
    const now = new Date().toISOString();
    const isoDate = now.slice(0, 10);
    const txId = (await db.transactions.add({ description: pending.description, amount: pending.amount, date: isoDate, createdAt: now, rawText: pending.description })) as number;
    await db.chatMessages.add({ role: 'assistant', text: `Tercatat ✓ ${pending.description} — ${fmtIDR(pending.amount)}`, createdAt: new Date().toISOString(), txId });
    setPending(null);
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] md:h-[calc(100dvh-32px)]">
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
            <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-[var(--accent)] text-white rounded-br-md' : 'bg-[var(--card)] border border-[var(--border)] rounded-bl-md'}`}>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            </div>
          </div>
        ))}
        {pending && (
          <div className="rounded-2xl border border-[var(--accent)] bg-[var(--card)] p-4">
            <p className="text-xs font-bold tracking-widest uppercase text-[var(--accent)]">Preview</p>
            <p className="font-semibold mt-1">{pending.description}</p>
            <p className="text-sm text-[var(--text-secondary)]">{fmtIDR(pending.amount)}</p>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={confirmSave} className="flex-1 py-2.5 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold inline-flex items-center justify-center gap-2"><Check size={16} /> Simpan</button>
              <button type="button" onClick={() => setPending(null)} className="px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm font-medium inline-flex items-center gap-2"><Edit2 size={16} /> Batal</button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="sticky bottom-0 bg-[var(--bg)] pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tulis pengeluaran, mis: kopi 25rb" className="flex-1 h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/20" />
        <button type="submit" aria-label="kirim" className="w-11 h-11 rounded-xl bg-[var(--accent-fill)] text-[var(--accent-ink)] grid place-items-center shrink-0"><Send size={18} /></button>
      </form>
    </div>
  );
}
