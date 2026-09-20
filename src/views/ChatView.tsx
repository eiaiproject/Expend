import { useEffect, useEffectEvent, useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { addChatMessage } from '../utils/chatHistory';
import { parseChatInput } from '../utils/chatParser';
import { parseReceiptText } from '../utils/receiptParser';
import { recognizeImageDetailed, isOcrReady, validateImageFile, validateFileMagic, OcrModelError } from '../utils/ocr';
import { fmtIDR } from '../utils/format';
import { todayLocalISO } from '../utils/date';
import { useKeyboardInset } from '../utils/keyboard';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { detectInputLang } from '../utils/langDetect';
import { Send, Check, Gallery, ChatRoundDots, Receipt, Camera, ChevronDown, X } from 'reicon-react';
import { Link } from 'react-router-dom';
import { InlineAlert } from '../components/InlineAlert';
import { Toast, useToast } from '../components/Toast';
import { LiveParseFeedback } from '../components/LiveParseFeedback';
import { QuickToggles } from '../components/QuickToggles';
import { FormatCheatSheet } from '../components/FormatCheatSheet';
import { OcrGuideOverlay } from '../components/OcrGuideOverlay';
import { useTranslation } from '../i18n';

type Pending = { description: string; amount: number; date: string; note?: string; source?: string };

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function scrollToBottom(listRef: React.RefObject<HTMLDivElement | null>, instant = false) {
  // Scroll di dalam wadah list SAJA (bukan endRef.scrollIntoView): scrollIntoView
  // menggelembung ke semua ancestor scrollable termasuk main (overflow:hidden
  // tetap bisa di-scroll programatik) sehingga seluruh kolom bergeser dan
  // composer lepas dari docking keyboard.
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: instant || prefersReduced ? 'auto' : 'smooth' });
}

const CHAT_PAGE = 50;

// Timestamp hanya saat ganti hari/role agar list tidak berisik.
// Dipisah dari komponen agar S3776 tidak menghitung rantai || ini.
function shouldShowTime(prev: { createdAt: string; role: string } | undefined, cur: { createdAt: string; role: string }): boolean {
  if (!prev) return true;
  return prev.createdAt.slice(0, 10) !== cur.createdAt.slice(0, 10) || cur.role !== prev.role;
}

/**
 * Validasi berkas bukti sebelum OCR. Dipisah dari handleFile supaya rantai
 * cabangnya tidak menambah kompleksitas kognitif fungsi yang mengurus state UI
 * (Sonar S3776), dan supaya urutan validasi tetap terbaca sebagai satu daftar.
 */
async function ocrFileErrorKey(file: File): Promise<'chat.ocrFormatError' | 'chat.ocrTooLarge' | null> {
  const fileErr = validateImageFile(file);
  if (fileErr === 'format' || fileErr === 'empty') return 'chat.ocrFormatError';
  if (fileErr === 'too-large') return 'chat.ocrTooLarge';
  // A7: Validasi magic number untuk cegah polyglot file
  const magicErr = await validateFileMagic(file);
  return magicErr === 'magic' ? 'chat.ocrFormatError' : null;
}

/**
 * Model OCR yang gagal dimuat (asetnya ~8 MB, di-cache setelah pemakaian
 * pertama) butuh saran berbeda dari foto yang memang tidak terbaca.
 */
function ocrFailureKey(e: unknown): 'chat.ocrModelError' | 'chat.ocrReadError' {
  return e instanceof OcrModelError ? 'chat.ocrModelError' : 'chat.ocrReadError';
}

export default function ChatView() {
  const { t, lang } = useTranslation();
  // TASK 3: prefill dari contoh one-tap (?input=...) — baca saat init.
  const [input, setInput] = useState(() => {
    try {
      return (new URLSearchParams(window.location.search).get('input') ?? '').slice(0, 500);
    } catch {
      return '';
    }
  });
  const debouncedInput = useDebouncedValue(input, 300);
  const [pending, setPending] = useState<Pending | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showOcrGuide, setShowOcrGuide] = useState(() => {
    try {
      return localStorage.getItem('expend_ocr_guide') !== '1';
    } catch {
      return true;
    }
  });
  const { toast, showToast, dismissToast } = useToast();
  const langHintShown = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrAvailable, setOcrAvailable] = useState(isOcrReady());
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const saveInFlight = useRef(false);
  const ocrInFlight = useRef(false);
  const mountedRef = useRef(true);
  const [isSaving, setIsSaving] = useState(false);
  // false = kartu ringkas (default tiap pending baru); true = form Ubah.
  // Di-reset di tiap titik yang membuat pending (handleSend/handleFile/share)
  // agar setState tidak di dalam effect (react-hooks/set-state-in-effect).
  const [pendingEditable, setPendingEditable] = useState(false);
  const keyboardInset = useKeyboardInset();
  const [visibleLimit, setVisibleLimit] = useState(CHAT_PAGE);
  // Hanya 50 pesan terakhir agar render tetap ringan; pesan lama tidak dihapus.
  // Loading awal dibedakan dari empty (R-27). hasLoaded mengunci agar reload transien
  // Dexie saat kirim pesan tidak me-remount wadah scroll (itu yang melempar ke atas).
  const messagesResult = useLiveQuery(() => db.chatMessages.orderBy('createdAt').reverse().limit(visibleLimit).toArray().then((arr) => arr.reverse()), [visibleLimit]);
  const [messageCache, setMessageCache] = useState<{ snapshot: typeof messagesResult; loaded: boolean }>({
    snapshot: undefined,
    loaded: false,
  });
  // Cache snapshot Dexie saat render, bukan di effect (react-hooks/set-state-in-effect).
  // Semantik sama: pesan lama tetap tampil saat reload transien agar wadah
  // scroll tidak remount (itu yang melempar ke atas), dan loading awal
  // tetap dibedakan dari empty (R-27).
  if (messagesResult !== undefined && messagesResult !== messageCache.snapshot) {
    setMessageCache({ snapshot: messagesResult, loaded: true });
  }
  const messages = messagesResult ?? messageCache.snapshot ?? [];
  const isMessagesLoading = !messageCache.loaded && messagesResult === undefined;
  const totalChat = useLiveQuery(() => db.chatMessages.count(), []) ?? 0;
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const firstRenderRef = useRef(true);
  const adjustRef = useRef<{ h: number; top: number } | null>(null);



  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Guard regresi DEV: composer harus docked di dasar visual viewport saat
  // keyboard terbuka (bottom == vv.height + vv.offsetTop). Hanya peringatan
  // console, dihapus dari bundle produksi oleh dead-code elimination Vite.
  useEffect(() => {
    if (!import.meta.env.DEV || keyboardInset <= 0) return;
    const el = composerRef.current;
    const vv = window.visualViewport;
    if (!el || !vv) return;
    const r = el.getBoundingClientRect();
    const target = vv.height + vv.offsetTop;
    if (Math.abs(r.bottom - target) > 4) {
      console.warn(
        `[expend] composer tidak docked: bottom=${r.bottom.toFixed(1)} target=${target.toFixed(1)}`,
      );
    }
  }, [keyboardInset]);

  // Jangkar kirim: kemunculan kartu verifikasi (~200px+) dalam commit Dexie
  // bertahap dapat melompati threshold nearBottom sehingga pesan baru tak
  // terlihat. Jangkar mencatat posisi & inset keyboard SAAT menekan kirim:
  // commit-commit berikutnya dipaksa scroll hanya bila user memang di bawah
  // dengan inset yang sama. Ganti inset (buka/tutup keyboard) atau baca atas
  // otomatis membatalkan — anti-rebut utuh, tanpa timestamp/window.
  const sendAnchorRef = useRef<{ atBottom: boolean; kb: number } | null>(null);
  const captureSendAnchor = () => {
    const el = listRef.current;
    const atBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 200 : true;
    sendAnchorRef.current = { atBottom, kb: keyboardInset };
  };

  // Default di bawah (instant saat mount), anti-rebut: hanya auto-scroll
  // bila user sudah di dekat bawah. Muat pesan lama tidak melempar ke bawah.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (adjustRef.current) {
      const { h, top } = adjustRef.current;
      adjustRef.current = null;
      el.scrollTop = top + (el.scrollHeight - h);
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    const anchor = sendAnchorRef.current;
    const forceSend = !!anchor && anchor.atBottom && anchor.kb === keyboardInset;
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      scrollToBottom(listRef, true);
    } else if (nearBottom || forceSend) {
      // Selalu instant: smooth scrollIntoView di-interupsi setiap ada
      // mutasi layout (progress OCR, kartu pending, gambar) sehingga
      // berhenti di tengah - user harus klik panah bawah manual.
      // Smooth hanya untuk ketukan eksplisit tombol panah (scrollToBottom).
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, pending, ocrProgress, keyboardInset]);

  // Track scroll position for "back to latest" button
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    // C5: Tampilkan tombol "back to latest" juga saat ada pending/OCR
    // (pesan baru ditambahkan tapi user sudah scroll ke atas)
    setShowScrollBtn(!isNearBottom && (messages.length > 0 || pending !== null || ocrProgress !== null));
  }, [messages.length, pending, ocrProgress]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [input]);

  // TASK 2: live parse feedback dengan debounce 300ms (via useDebouncedValue).
  // Guard pending agar tak ganggu kartu verifikasi.
  const liveDebounced = pending ? '' : debouncedInput;

  // Efek share sengaja hanya berjalan saat mount (membaca params URL sekali,
  // lalu replaceState menghapusnya). Effect Event memanggil handler/terjemahan
  // dari render terakhir tanpa menambah dependency array, sehingga perilaku
  // sekali-mount tetap utuh sekaligus bebas warning exhaustive-deps.
  const onSharedFile = useEffectEvent((file: File) => handleFile(file));
  const shareErrorMessage = useEffectEvent(() => t('chat.ocrShareFailed'));

  // Handle share target
  useEffect(() => { // NOSONAR - cognitive complexity from share file+text handling
    const params = new URLSearchParams(window.location.search);
    if (!params.has('share')) return;
    (async () => {
      try {
        // B2/B3: Cek error param dari share-handler.js (cache gagal).
        // setState di dalam callback async, bukan body effect langsung
        // (react-hooks/set-state-in-effect). Badan async fn jalan sinkron
        // sampai await pertama, jadi urutannya identik.
        const shareError = params.get('error');
        if (shareError) {
          setOcrError(shareErrorMessage());
          window.history.replaceState({}, '', '/chat');
          return;
        }
        const cache = await caches.open('share-cache');

        // Prioritize image OCR over share text.
        // Share messages from banking apps (e.g. SeaBank "Halo, aku sudah
        // kirim Rp...") are conversational noise - the screenshot is the
        // real receipt. If we have an image, use OCR only and discard text.
        const fileRes = await cache.match('shared-file');
        if (fileRes) {
          const blob = await fileRes.blob();
          const name = decodeURIComponent(fileRes.headers.get('x-file-name') || 'receipt.png');
          const type = fileRes.headers.get('content-type') || 'image/png';
          const file = new File([blob], name, { type });
          await onSharedFile(file);
          await cache.delete('shared-file');
          // Discard share text when image is available
          await cache.delete('shared-meta');
        } else {              // No image - use share text as chat input fallback
              const metaRes = await cache.match('shared-meta');
              if (metaRes) {
                const meta = await metaRes.json();
                const sharedText = [meta.text, meta.url].filter(Boolean).join(' ').trim();
                if (sharedText) {
                  const parsed = parseChatInput(sharedText);
                  if (parsed) {
                    setPending({ description: parsed.description, amount: parsed.amount, date: parsed.date || todayLocalISO(), source: parsed.source, note: parsed.note });
                    setPendingEditable(false);
                  } else {
                    setInput(sharedText.slice(0, 80));
                  }
                }
                await cache.delete('shared-meta');
              } else {
                // B3: Cache kosong - kemungkinan iOS Safari atau share gagal.
                // Minta user upload manual lewat galeri.
                setOcrError(shareErrorMessage());
              }
        }
        window.history.replaceState({}, '', '/chat');
      } catch {
        // B3: Cache API error (iOS Safari compatibility / quota exceeded)
        setOcrError(shareErrorMessage());
        window.history.replaceState({}, '', '/chat');
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'upload') {
      fileRef.current?.click();
      window.history.replaceState({}, '', '/chat');
    }
  }, []);

  // TASK 3: fokus + bersihkan param setelah prefill (sinkron DOM, tanpa setState).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('input')) {
      textareaRef.current?.focus();
      window.history.replaceState({}, '', '/chat');
    }
  }, []);

  // TASK 5: panduan visual pra-capture (dismiss persist lokal).
  const dismissGuide = useCallback(() => {
    setShowOcrGuide(false);
    try {
      localStorage.setItem('expend_ocr_guide', '1');
    } catch {}
  }, []);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    captureSendAnchor();
    setIsSending(true);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const now = new Date().toISOString();
    await addChatMessage({ role: 'user', text, createdAt: now });

    // TASK 8: deteksi bahasa per-input (parse tetap jalan; toast sekali per session).
    const detected = detectInputLang(text);
    if (detected && detected !== lang && !langHintShown.current) {
      langHintShown.current = true;
      showToast(t('chat.detectedLang'));
    }

    const parsed = parseChatInput(text);
    if (!parsed) {
      await addChatMessage({
        role: 'assistant',
        text: t('chat.noAmount'),
        createdAt: new Date().toISOString(),
      });
      setIsSending(false);
      return;
    }
    const today = now.slice(0, 10);
    const p: Pending = { description: parsed.description, amount: parsed.amount, date: parsed.date || today, source: parsed.source, note: parsed.note };
    setPending(p);
    setOcrConfidence(null);
    setPendingEditable(false);
    await addChatMessage({
      role: 'assistant',
      text: t('chat.recorded', { desc: p.description, amount: fmtIDR(p.amount) }),
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

  /** Foto terbaca tapi tidak ada nominal yang bisa dipercaya: minta isi manual. */
  async function handleUnparsedReceipt() {
    setPending({ description: 'Transfer', amount: 0, date: todayLocalISO() });
    setPendingEditable(false);
    setOcrError(t('chat.ocrReadError'));
    await addChatMessage({
      role: 'assistant',
      text: t('chat.ocrClearPhoto'),
      createdAt: new Date().toISOString(),
    });
  }

  async function handleFile(file: File) {
    if (ocrInFlight.current) return;
    captureSendAnchor();
    const fileErrKey = await ocrFileErrorKey(file);
    if (fileErrKey) {
      setOcrError(t(fileErrKey));
      return;
    }
    ocrInFlight.current = true;
    setOcrError(null);
    const url = URL.createObjectURL(file);
    if (mountedRef.current) {
      setPreviewUrl(url);
      setOcrProgress(0);
    }
    try {
      const { text, confidence } = await recognizeImageDetailed(file, (n) => {
        if (mountedRef.current) setOcrProgress(n);
      });
      if (!mountedRef.current) return;
      setOcrConfidence(confidence);
      const parsed = parseReceiptText(text);
      if (!parsed) {
        await handleUnparsedReceipt();
        return;
      }
      setPending({ description: parsed.description, amount: parsed.amount, date: parsed.date, note: parsed.note, source: parsed.source });
      setPendingEditable(false);
      await addChatMessage({
        role: 'assistant',
        text: t('chat.recorded', { desc: parsed.description, amount: fmtIDR(parsed.amount) }),
        createdAt: new Date().toISOString(),
        parsed: { description: parsed.description, amount: parsed.amount },
      });
    } catch (e) {
      if (mountedRef.current) setOcrError(t(ocrFailureKey(e)));
    } finally {
      ocrInFlight.current = false;
      URL.revokeObjectURL(url);
      if (mountedRef.current) {
        setOcrProgress(null);
        setOcrAvailable(isOcrReady());
        setPreviewUrl(null);
      }
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  }

  async function saveNow(p: Pending) {
    if (!p.amount || !Number.isFinite(p.amount) || p.amount <= 0 || p.amount > 1_000_000_000_000) return;
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    if (mountedRef.current) setIsSaving(true);
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
      await addChatMessage({
        role: 'assistant',
        text: t('chat.saved', { desc: p.description, amount: fmtIDR(p.amount) }),
        createdAt: new Date().toISOString(),
        txId,
      });
      await addChatMessage({
        role: 'assistant',
        text: '__LINK_RINGKASAN__',
        createdAt: new Date().toISOString(),
      });
      if (mountedRef.current) {
        setPending(null);
        setOcrError(null);
        setOcrConfidence(null);
      }
    } catch {
      if (mountedRef.current) setOcrError(t('chat.saveError') ?? 'Gagal menyimpan transaksi. Coba lagi.');
    } finally {
      saveInFlight.current = false;
      if (mountedRef.current) setIsSaving(false);
    }
  }

  async function confirmSave() {
    if (!pending?.amount || isSaving) return;
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
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
            <ChatRoundDots size={18} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold tracking-tight leading-tight truncate">{t('chat.title')}</h1>
            <p className="text-xs text-[var(--text-secondary)] leading-tight mt-0.5 truncate">{t('chat.subtitle')}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <QuickToggles />
            {/* Status OCR dekoratif: baru tampil di layar lebar. Di bawah lg
                label ini memotong judul header sampai ter-truncate. */}
            <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bone)] text-[var(--text-secondary)] text-[12px] font-semibold border border-[var(--border)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
              <span>{ocrAvailable ? t('common.ready') : t('common.loadingProcessor')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error selalu terlihat, termasuk saat chat masih kosong (R-27):
          alert validasi/upload tidak boleh terkubur di dalam wadah log. */}
      {ocrError && (
        <div className="shrink-0 px-4 md:px-6 pt-3">
          <InlineAlert>{ocrError}</InlineAlert>
        </div>
      )}

      {/* Loading dibedakan dari empty (R-27): skeleton saat Dexie belum jawab. */}
      {isMessagesLoading && !pending && ocrProgress === null && (
        <div className="flex-1 min-h-0 flex items-start pt-6 px-4 md:px-6">
          <output className="w-full rounded-[var(--radius-lg)] bg-[var(--card)] border border-[var(--border)] p-4 space-y-3 animate-pulse" aria-live="polite" aria-label={t('common.loadingData')}>
            <span className="sr-only">{t('common.loading')}</span>
            <div className="h-16 rounded-[var(--radius-md)] bg-[var(--border)]" />
            <div className="h-16 rounded-[var(--radius-md)] bg-[var(--border)]" />
          </output>
        </div>
      )}

      {/* Empty state - outside of role="log" */}
      {!isMessagesLoading && messages.length === 0 && !pending && ocrProgress === null && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-3">
          <div className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 mt-6 mb-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-soft)] border border-[var(--border)]/60 grid place-items-center shrink-0 shadow-sm">
                <Receipt size={18} className="text-[var(--accent)]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold tracking-tight leading-none">{t('chat.startRecording')}</p>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">{t('chat.startDesc')}</p>
                <div className="mt-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-[var(--border)]/60 bg-[var(--card)] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" aria-hidden />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" aria-hidden />
                    <span className="text-[11px] font-mono tracking-wide text-[var(--text-muted)] uppercase">{t('chat.example')}</span>
                    <span className="ml-auto text-[11px] font-sans normal-case tracking-normal text-[var(--text-muted)]">{t('chat.tapExample')}</span>
                  </div>
                  <div className="px-3 py-2.5 flex flex-col gap-1 font-mono text-[12px] leading-5 text-[var(--text-secondary)]">
                    <button
                      type="button"
                      aria-label={t('chat.useExample', { example: 'kopi 25rb dari BSI' })}
                      onClick={() => {
                        setInput('kopi 25rb dari BSI');
                        textareaRef.current?.focus();
                      }}
                      className="text-left flex items-center min-h-12 rounded-[8px] px-2 py-1.5 hover:bg-[var(--bone)] active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                    >
                      <span>kopi <span className="text-[var(--accent)] font-medium">25rb</span> <span className="text-[var(--text-muted)]">dari BSI</span></span>
                    </button>
                    <button
                      type="button"
                      aria-label={t('chat.useExample', { example: 'bayar listrik 200rb via GoPay' })}
                      onClick={() => {
                        setInput('bayar listrik 200rb via GoPay');
                        textareaRef.current?.focus();
                      }}
                      className="text-left flex items-center min-h-12 rounded-[8px] px-2 py-1.5 hover:bg-[var(--bone)] active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                    >
                      <span>bayar listrik <span className="text-[var(--accent)] font-medium">200rb</span> <span className="text-[var(--text-muted)]">via GoPay</span></span>
                    </button>
                    <button
                      type="button"
                      aria-label={t('chat.useExample', { example: 'belanja indomaret 50000' })}
                      onClick={() => {
                        setInput('belanja indomaret 50000');
                        textareaRef.current?.focus();
                      }}
                      className="text-left flex items-center min-h-12 rounded-[8px] px-2 py-1.5 hover:bg-[var(--bone)] active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                    >
                      <span>belanja indomaret <span className="text-[var(--accent)] font-medium">50000</span></span>
                    </button>
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
                {t('chat.uploadReceipt')}
              </button>
            </div>
          </div>
          {/* Panduan pra-capture di dalam area scroll (bukan fixed flow) agar
              viewport pendek/landscape tak mendorong composer keluar layar. */}
          {showOcrGuide && keyboardInset === 0 && (
            <div className="mb-4">
              <OcrGuideOverlay onDismiss={dismissGuide} />
            </div>
          )}
        </div>
      )}

      {/* Message log */}
      {(!isMessagesLoading || pending || ocrProgress !== null) && (messages.length > 0 || pending || ocrProgress !== null) && (
        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={t('chat.conversation')}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 pt-4 space-y-3"
          // Shell (App.tsx) sudah memotong app sampai visualViewport -> dasar
          // list = atap keyboard. JANGAN tambah inset keyboard di sini
          // (penyebab bug composer menggantung di Android). Composer di flow
          // normal (bukan overlay) sehingga tingginya juga tidak perlu masuk
          // padding (menghasilkan gap mati antara bubble terakhir dan composer).
          // Padding bawah dipindah ke anchor endRef: padding container menjadi
          // lantai minimum flex dan mendorong composer keluar di viewport pendek.
        >
          <h2 className="sr-only">{t('chat.conversation')}</h2>
          {/* Panduan pra-capture ikut scroll (anak pertama log) dengan alasan
              yang sama: fixed flow memakan ruang viewport pendek. */}
          {showOcrGuide && keyboardInset === 0 && !pending && ocrProgress === null && (
            <OcrGuideOverlay onDismiss={dismissGuide} />
          )}
          {totalChat > messages.length && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  const el = listRef.current;
                  if (el) adjustRef.current = { h: el.scrollHeight, top: el.scrollTop };
                  setVisibleLimit((v) => v + CHAT_PAGE);
                }}
                className="min-h-11 px-4 rounded-full bg-[var(--card)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
              >
                {t('chat.loadOlder')}
              </button>
            </div>
          )}
          {messages.map((m, i) => {
            const showTime = shouldShowTime(messages[i - 1], m);
            return (
              <div key={m.id} className="flex motion-safe:animate-[in_0.2s_ease-out] motion-reduce:animate-none" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 96px' } as any}>
                <div className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[76%]">
                    <div
                      className={`px-4 py-3 text-sm leading-[22px] ${
                        m.role === 'user'
                          ? 'bg-[var(--accent-fill)] text-[var(--accent-ink)] rounded-[var(--radius-lg)] rounded-br-[var(--radius-sm)]'
                          : 'bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] rounded-bl-[var(--radius-sm)]'
                      }`}
                    >
                      {m.text === '__LINK_RINGKASAN__' ? (
                        <Link to="/" className="text-sm font-semibold text-[var(--accent)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded">
                          {t('chat.viewSummary')}
                        </Link>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      )}
                    </div>
                    {showTime && (
                      <p className={`mt-1 text-[12px] tabular-nums ${m.role === 'user' ? 'text-right text-[var(--text-muted)]' : 'text-[var(--text-muted)]'}`}>
                        {fmtTime(m.createdAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {ocrProgress !== null && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
              {previewUrl && (
                <div className="mb-3 rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)]">
                  <img src={previewUrl} alt={t('chat.uploadReceipt')} className="w-full max-h-48 object-cover" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--bg)] border border-[var(--border)] grid place-items-center">
                  <Gallery size={14} className="text-[var(--text-secondary)]" aria-hidden />
                </div>
                <p className="text-xs font-semibold" aria-live="polite">
                  {t('chat.readingReceipt')} {ocrProgress}%
                </p>
                <span className="ml-auto text-[12px] text-[var(--text-muted)]">{t('chat.offline')}</span>
              </div>
              <progress value={ocrProgress} max={100} aria-label="Memindai bukti" aria-valuetext={`${ocrProgress}%`} className="mt-3 h-1.5 w-full rounded-full overflow-hidden" />
              <p className="text-[12px] text-[var(--text-muted)] mt-2">{t('chat.stayOnPage')}</p>
            </div>
          )}

          {pending && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--card)] p-5 overflow-clip motion-safe:animate-[in_0.2s_ease-out] motion-reduce:animate-none">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--accent-fill)] text-[var(--accent-ink)] grid place-items-center">
                  <Check size={14} aria-hidden />
                </div>
                <p className="text-xs font-bold tracking-wide uppercase text-[var(--accent)]">{t('chat.checkTransaction')}</p>
                <button
                  type="button"
                  onClick={() => setPendingEditable((v) => !v)}
                  aria-expanded={pendingEditable}
                  className="ml-auto text-xs font-semibold text-[var(--accent)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded px-1 min-h-8"
                >
                  {t('chat.pendingEdit')}
                </button>
              </div>
              {/* Ringkasan selalu di atas aksi: Simpan/Batal tidak boleh jatuh
                  di bawah fold layar kecil/keyboard. */}
              <p className="mt-3 text-sm font-bold leading-snug break-words">{pending.description}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
                {fmtIDR(pending.amount || 0)} &middot; {pending.date}{pending.source ? ` · ${pending.source}` : ''}
              </p>
              {pending.note && (
                <p className="mt-1 text-xs text-[var(--text-secondary)] break-words">
                  {t('chat.note')}: {pending.note}
                </p>
              )}
              {ocrConfidence !== null && (
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] font-semibold text-[var(--text-secondary)] tabular-nums" aria-live="polite">
                    {t('chat.ocrConfidence', { value: ocrConfidence })}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">{t('chat.ocrPriorityNote')}</p>
                </div>
              )}
              {(pendingEditable || !pending.amount) && (
                <div className="mt-4 space-y-3 border-t border-[var(--border)]/60 pt-4">
                <label htmlFor="pending-desc" className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{t('chat.description')}</span>
                  <input
                    id="pending-desc"
                    value={pending.description}
                    onChange={(e) => setPending({ ...pending, description: e.target.value })}
                    autoComplete="off"
                    placeholder={t('chat.descPlaceholder')}
                    className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label htmlFor="pending-amount" className="block">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">{t('chat.amount')}</span>
                    <input
                      id="pending-amount"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="1000000000000"
                      value={pending.amount || ''}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        setPending({ ...pending, amount: v });
                      }}
                      placeholder="50000"
                      className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
                    />
                  </label>
                  <label htmlFor="pending-date" className="block">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">{t('chat.date')}</span>
                    <input
                      id="pending-date"
                      type="date"
                      value={pending.date}
                      onChange={(e) => {
                        const v = e.target.value;
                        // C4: Validasi format YYYY-MM-DD sebelum update state
                        if (/^\d{4}-\d{2}-\d{2}$/.test(v) || v === '') {
                          setPending({ ...pending, date: v });
                        }
                      }}
                      className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
                    />
                  </label>
                </div>
                <label htmlFor="pending-source" className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{t('chat.source')}</span>
                  <input
                    id="pending-source"
                    value={pending.source ?? ''}
                    onChange={(e) => setPending({ ...pending, source: e.target.value })}
                    autoComplete="off"
                    placeholder={t('chat.sourcePlaceholder')}
                    className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
                  />
                </label>
                <label htmlFor="pending-note" className="block">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{t('chat.note')} <span className="text-[var(--text-muted)]">({t('chat.noteOptional')})</span></span>
                  <input
                    id="pending-note"
                    value={pending.note ?? ''}
                    onChange={(e) => setPending({ ...pending, note: e.target.value })}
                    autoComplete="off"
                    placeholder={t('chat.notePlaceholder')}
                    className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
                  />
                </label>
              </div>
              )}
              <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 border-t border-[var(--border)]/60 bg-[var(--card)] px-5 pb-5 pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={confirmSave}
                  disabled={!pending.amount || isSaving}
                  className="flex-1 min-h-12 py-3 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                >
                  <Check size={16} aria-hidden />
                  {t('chat.saveTransaction')}
                </button>
                <button
                  type="button"
                  onClick={() => { setPending(null); setOcrError(null); setOcrConfidence(null); }}
                  className="min-h-12 px-5 rounded-[var(--radius-md)] bg-[var(--card)] border border-[var(--border)] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                >
                  <X size={16} aria-hidden />
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          <div ref={endRef} className="pb-4" />
        </div>
      )}

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          type="button"
          aria-label={t('chat.backToLatest')}
          onClick={() => scrollToBottom(listRef)}
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
            <p className="text-sm font-bold mt-2">{t('chat.dropHere')}</p>
            <p className="text-xs text-[var(--text-secondary)]">{t('chat.dropFormats')}</p>
          </div>
        </div>
      )}

      {/* Composer */}
      <div
        ref={composerRef}
        className={`shrink-0 bg-[var(--bg)] px-4 md:px-6 pt-3 ${
          keyboardInset > 0
            ? // Keyboard terbuka → BottomNav sudah disembunyikan (App.tsx), jadi
              // ruang 66px tidak diperlukan; kecilkan padding bawah agar area
              // pesan lebih lega saat mengetik.
              'pb-[calc(10px+env(safe-area-inset-bottom))]'
            : 'pb-[calc(66px+env(safe-area-inset-bottom))] md:pb-[calc(10px+env(safe-area-inset-bottom))]'
        }`}
      >
      {liveDebounced.trim() !== '' && <LiveParseFeedback debounced={liveDebounced} />}
        <form onSubmit={handleSend} className="flex items-end gap-2 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:border-[var(--accent)] transition-all">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                handleFile(f);
              } else {
                // B7: Jika tidak ada file dipilih (permission ditolak di iOS Safari)
                // tampilkan pesan error setelah delay singkat
                setTimeout(() => {
                  if (mountedRef.current && !ocrInFlight.current) {
                    setOcrError(t('chat.ocrCameraDenied'));
                  }
                }, 500);
              }
            }}
          />
          <button
            type="button"
            aria-label={t('chat.pickFromGallery')}
            onClick={() => fileRef.current?.click()}
            className="w-12 h-12 rounded-full bg-[var(--bg)] border border-[var(--border)] grid place-items-center shrink-0 hover:bg-[var(--border)] active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            <Gallery size={18} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t('chat.takePhoto')}
            onClick={() => cameraRef.current?.click()}
            className="w-12 h-12 rounded-full bg-[var(--bg)] border border-[var(--border)] grid place-items-center shrink-0 hover:bg-[var(--border)] active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 md:hidden"
          >
            <Camera size={18} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t('chat.formatHelp')}
            title={t('chat.formatHelp')}
            onClick={() => setShowSheet(true)}
            className="w-12 h-12 rounded-full bg-[var(--bg)] border border-[var(--border)] grid place-items-center shrink-0 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--border)] active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
          >
            <span aria-hidden>?</span>
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={500}
            placeholder={t('chat.inputPlaceholder')}
            aria-label={t('chat.inputLabel')}
            autoComplete="off"
            enterKeyHint="send"
            className="flex-1 min-w-0 min-h-[44px] max-h-32 bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-[var(--text-muted)] resize-none leading-snug"
          />
          {input.length > 400 && (
            <span className={`text-[10px] tabular-nums self-end mb-2.5 ${input.length >= 500 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`} aria-live="polite">
              {input.length}/500
            </span>
          )}
          <button
            type="submit"
            aria-label={isSending ? t('chat.processing') : t('chat.send')}
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
        {/* Hint hanya relevan saat keyboard tertutup - sembunyikan saat
            mengetik agar layar mobile tidak terbuang. */}
        {keyboardInset === 0 && (
          <p className="hidden md:block text-[11px] tracking-wide text-[var(--text-secondary)] text-center mt-2.5">
            <span>{t('chat.shortcutsDesktop')}</span>
          </p>
        )}
      </div>

      <FormatCheatSheet open={showSheet} onClose={() => setShowSheet(false)} />
      {/* key per pesan agar timer toast baru tidak mewarisi sisa timer lama. */}
      {toast && <Toast key={toast.message} message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      <style>{String.raw`@keyframes in { from { opacity:0; transform: translateY(4px)} to { opacity:1; transform: translateY(0)} } @media (prefers-reduced-motion: reduce) { .motion-safe\:animate-pulse, .motion-safe\:animate-\[in_0\.2s_ease-out\] { animation: none !important; } }`}</style>
    </div>
  );
}
