import { useEffect, useEffectEvent, useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ChatMessage } from '../db/db';
import { addChatMessage } from '../utils/chatHistory';
import { parseChatInput } from '../utils/chatParser';
import { parseReceiptText } from '../utils/receiptParser';
import { recognizeImageDetailed, isOcrReady } from '../utils/ocr';
import { getAiConfig } from '../utils/aiConfig';
import { parseReceiptWithAi, type AiParsedReceipt } from '../utils/ai';
import { clearShareCache, ocrFailureKey, ocrFileErrorKey, readSharedFile, scrollToBottom, shouldShowTime } from './chat/chatHelpers';
import { PendingCard, type Pending } from './chat/PendingCard';
import { OcrProgressCard } from './chat/OcrProgressCard';
import { ChatEmptyState } from './chat/ChatEmptyState';
import { MessageBubble } from './chat/MessageBubble';
import { fmtIDR } from '../utils/format';
import { isValidISODate, todayLocalISO } from '../utils/date';
import { useKeyboardInset } from '../utils/keyboard';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { detectInputLang } from '../utils/langDetect';
import { Send, Gallery, ChatRoundDots, Camera, ChevronDown } from 'reicon-react';
import { InlineAlert } from '../components/InlineAlert';
import { Toast, useToast } from '../components/Toast';
import { LiveParseFeedback } from '../components/LiveParseFeedback';
import { QuickToggles } from '../components/QuickToggles';
import { FormatCheatSheet } from '../components/FormatCheatSheet';
import { OcrGuideOverlay } from '../components/OcrGuideOverlay';
import { useTranslation } from '../i18n';
import { DbErrorNotice } from '../components/DbErrorNotice';
import { requestPersistentStorage } from '../utils/storage';

const CHAT_PAGE = 50;

export default function ChatView() {
  const { t, lang } = useTranslation();
  // prefill dari contoh one-tap (?input=...), baca saat init.
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
  const LANG_HINT_KEY = 'expend_lang_hint';
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const shareProcessedRef = useRef(false);
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
  const [chatRetry, setChatRetry] = useState(0);
  // Hanya 50 pesan terakhir agar render tetap ringan; pesan lama tidak dihapus.
  // Loading awal dibedakan dari empty (R-27). hasLoaded mengunci agar reload transien
  // Dexie saat kirim pesan tidak me-remount wadah scroll (itu yang melempar ke atas).
  const messagesResult = useLiveQuery(
    () => db.chatMessages.orderBy('createdAt').reverse().limit(visibleLimit).toArray().then((arr) => arr.reverse()).catch(() => null),
    [visibleLimit, chatRetry],
  );
  const [messageCache, setMessageCache] = useState<{ snapshot: ChatMessage[] | undefined; loaded: boolean }>({
    snapshot: undefined,
    loaded: false,
  });
  // Cache snapshot Dexie saat render, bukan di effect (react-hooks/set-state-in-effect).
  // Semantik: pesan lama tetap tampil saat reload transien agar wadah scroll
  // tidak remount (itu yang melempar ke atas); loading awal dibedakan dari
  // empty (R-27). Guard perbandingan referensi mencegah loop render.
  if (Array.isArray(messagesResult) && messagesResult !== messageCache.snapshot) {
    setMessageCache({ snapshot: messagesResult, loaded: true });
  }
  const messagesFailed = messagesResult === null;
  const messages = Array.isArray(messagesResult) ? messagesResult : messageCache.snapshot ?? [];
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
  // otomatis membatalkan, anti-rebut utuh, tanpa timestamp/window.
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
    // Inset keyboard berubah async (animasi + debounce blur), toleransi 40px
    // agar pesan sendiri tetap terlihat walau inset bergeser saat kirim.
    const sameKb = !anchor || Math.abs(anchor.kb - keyboardInset) < 40;
    const forceSend = !!anchor && anchor.atBottom && sameKb;
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      scrollToBottom(listRef, true);
      sendAnchorRef.current = null;
    } else if (nearBottom || forceSend) {
      // Selalu instant: smooth scrollIntoView di-interupsi setiap ada
      // mutasi layout (progress OCR, kartu pending, gambar) sehingga
      // berhenti di tengah - user harus klik panah bawah manual.
      // Smooth hanya untuk ketukan eksplisit tombol panah (scrollToBottom).
      el.scrollTop = el.scrollHeight;
      sendAnchorRef.current = null;
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

  // live parse feedback dengan debounce 300ms (via useDebouncedValue).
  // Guard pending agar tak ganggu kartu verifikasi.
  const liveDebounced = pending ? '' : debouncedInput;

  // Efek share sengaja hanya berjalan saat mount (membaca params URL sekali,
  // lalu replaceState menghapusnya). Effect Event memanggil handler/terjemahan
  // dari render terakhir tanpa menambah dependency array, sehingga perilaku
  // sekali-mount tetap utuh sekaligus bebas warning exhaustive-deps.
  const onSharedFile = useEffectEvent((file: File) => handleFile(file));
  const shareErrorMessage = useEffectEvent(() => t('chat.ocrShareFailed'));

  const handleSharedImage = useEffectEvent(async (file: File, cache: Cache): Promise<void> => {
    if (ocrInFlight.current) {
      showToast(t('chat.ocrBusy'), 'error');
      await cache.delete('shared-file');
      await cache.delete('shared-meta');
      window.history.replaceState({}, '', '/chat');
      return;
    }
    try {
      await onSharedFile(file);
    } finally {
      // Jangan tinggalkan payload share di cache, termasuk saat OCR/handler gagal.
      await cache.delete('shared-file');
      await cache.delete('shared-meta');
    }
  });

  const handleSharedTextFallback = useEffectEvent(async (cache: Cache): Promise<void> => {
    const metaRes = await cache.match('shared-meta');
    if (!metaRes) {
      // B3: Cache kosong - kemungkinan iOS Safari atau share gagal.
      // Minta user upload manual lewat galeri.
      setOcrError(shareErrorMessage());
      return;
    }
    try {
      const meta = await metaRes.json();
      const sharedText = [meta.text, meta.url].filter(Boolean).join(' ').trim();
      if (sharedText) {
        const parsed = parseChatInput(sharedText, t('chat.untitled'));
        if (parsed) {
          setPending({ description: parsed.description, amount: parsed.amount, date: parsed.date || todayLocalISO(), source: parsed.source, note: parsed.note });
          setPendingEditable(false);
        } else {
          setInput(sharedText.slice(0, 500));
        }
      }
    } finally {
      await cache.delete('shared-meta');
    }
  });

  // Handle share target
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('share')) return;
    if (shareProcessedRef.current) return;
    shareProcessedRef.current = true;
    void (async () => {
      try {
        // B2/B3: Cek error param dari share-handler.js (cache gagal).
        // setState di dalam callback async, bukan body effect langsung
        // (react-hooks/set-state-in-effect). Badan async fn jalan sinkron
        // sampai await pertama, jadi urutannya identik.
        const shareError = params.get('error');
        if (shareError) {
          await clearShareCache();
          setOcrError(shareErrorMessage());
          window.history.replaceState({}, '', '/chat');
          return;
        }
        const cache = await caches.open('share-cache');
        const file = await readSharedFile(cache);
        if (file) {
          await handleSharedImage(file, cache);
        } else {
          await handleSharedTextFallback(cache);
        }
        window.history.replaceState({}, '', '/chat');
      } catch {
        // B3: Cache API error (iOS Safari compatibility / quota exceeded)
        await clearShareCache();
        setOcrError(shareErrorMessage());
        window.history.replaceState({}, '', '/chat');
      }
    })();
    // showToast/t di deps untuk exhaustive-deps: aman karena guard
    // shareProcessedRef membuat eksekusi ulang jadi no-op.
  }, [showToast, t]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'upload') {
      fileRef.current?.click();
      window.history.replaceState({}, '', '/chat');
    }
  }, []);

  // fokus + bersihkan param setelah prefill (sinkron DOM, tanpa setState).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('input')) {
      textareaRef.current?.focus();
      window.history.replaceState({}, '', '/chat');
    }
  }, []);

  // panduan visual pra-capture (dismiss persist lokal).
  const dismissGuide = useCallback(() => {
    setShowOcrGuide(false);
    try {
      localStorage.setItem('expend_ocr_guide', '1');
    } catch {}
  }, []);

  /** Toast hint bahasa sekali per sesi; dipisah agar handleSend tetap sederhana. */
  function maybeShowLanguageHint(text: string) {
    const detected = detectInputLang(text);
    if (!detected || detected === lang) return;
    let shown = false;
    try {
      shown = sessionStorage.getItem(LANG_HINT_KEY) === '1';
    } catch {
      // sessionStorage bisa diblokir; hint tetap ditampilkan sekali.
    }
    if (shown) return;
    try {
      sessionStorage.setItem(LANG_HINT_KEY, '1');
    } catch {
      // Flag gagal disimpan bukan alasan menahan hint.
    }
    showToast(t(detected === 'en' ? 'chat.detectedLang' : 'chat.detectedLangId'));
  }

  /** Tampilkan hasil AI/OCR sebagai kartu verifikasi + pesan chat. */
  async function showParsedReceipt(receipt: AiParsedReceipt, confidence: number | null) {
    if (!mountedRef.current) return;
    setOcrConfidence(confidence);
    setPending({
      description: receipt.description,
      amount: receipt.amount,
      date: receipt.date,
      source: receipt.source,
      note: receipt.note,
    });
    setPendingEditable(false);
    await addChatMessage({
      role: 'assistant',
      text: t('chat.recorded', { desc: receipt.description, amount: fmtIDR(receipt.amount) }),
      createdAt: new Date().toISOString(),
      parsed: { description: receipt.description, amount: receipt.amount },
    });
  }

  /** Coba vision BYOK; null berarti lanjut ke OCR lokal (termasuk tanpa key). */
  async function tryAiReceipt(file: File): Promise<AiParsedReceipt | null> {
    const aiConfig = getAiConfig();
    if (!aiConfig) return null;
    try {
      setOcrProgress(15);
      return await parseReceiptWithAi(file, aiConfig);
    } catch {
      try {
        if (!sessionStorage.getItem('expend_ai_fallback')) {
          sessionStorage.setItem('expend_ai_fallback', '1');
          showToast(t('chat.aiFallback'));
        }
      } catch {
        // sessionStorage bisa diblokir; fallback OCR tetap berjalan.
      }
      return null;
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isSendingRef.current) return;
    isSendingRef.current = true;
    captureSendAnchor();
    setIsSending(true);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const now = new Date().toISOString();
    let userMessageAdded = false;
    try {
      await addChatMessage({ role: 'user', text, createdAt: now });
      userMessageAdded = true;

      // Deteksi bahasa per-input; toast sekali per session (sessionStorage),
      // bukan per-mount, dengan arah pesan yang benar (id↔en).
      maybeShowLanguageHint(text);

      const parsed = parseChatInput(text, t('chat.untitled'));
      if (!parsed) {
        await addChatMessage({
          role: 'assistant',
          text: t('chat.noAmount'),
          createdAt: new Date().toISOString(),
        });
        return;
      }
      // `now` is UTC; a transaction saved at 00:30 WIB must still get today's
      // local date, not yesterday's UTC date.
      const today = todayLocalISO();
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
    } catch {
      if (!userMessageAdded) setInput(text);
      showToast(t('chat.saveError'), 'error');
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
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

  function clearFileInputs() {
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }

  async function handleFile(file: File) {
    if (ocrInFlight.current) {
      showToast(t('chat.ocrBusy'), 'error');
      clearFileInputs();
      return;
    }
    // Lock before the first await so two quick file selections cannot both
    // pass the guard and start OCR/AI concurrently.
    ocrInFlight.current = true;
    let url: string | null = null;
    try {
      const fileErrKey = await ocrFileErrorKey(file);
      if (fileErrKey) {
        if (mountedRef.current) setOcrError(t(fileErrKey));
        return;
      }
      captureSendAnchor();
      setOcrError(null);
      url = URL.createObjectURL(file);
      if (mountedRef.current) {
        setPreviewUrl(url);
        setOcrProgress(0);
      }

      // BYOK bersifat opsional. Saat key tersedia, coba model vision lebih dulu;
      // kegagalan apa pun jatuh ke OCR lokal, jadi aplikasi tetap bisa dipakai.
      const aiParsed = await tryAiReceipt(file);
      if (aiParsed) {
        await showParsedReceipt(aiParsed, null);
        return;
      }

      setOcrProgress(20);
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
      await showParsedReceipt(parsed, confidence);
    } catch (e) {
      if (mountedRef.current) setOcrError(t(ocrFailureKey(e)));
    } finally {
      ocrInFlight.current = false;
      if (url) URL.revokeObjectURL(url);
      if (mountedRef.current) {
        setOcrProgress(null);
        setOcrAvailable(isOcrReady());
        setPreviewUrl(null);
      }
      clearFileInputs();
    }
  }

  async function retryMessages() {
    try {
      await db.open();
    } catch {
      // Notice tetap tampil jika query berikutnya masih gagal.
    }
    setChatRetry((n) => n + 1);
  }

  async function saveNow(p: Pending) {
    // Rupiah is integer-only. The pending form uses type=number and can emit
    // decimals; round once here so DB and summary never store fractions.
    const amount = Math.round(p.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) {
      if (mountedRef.current) setOcrError(t('chat.saveInvalid'));
      return;
    }
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    if (mountedRef.current) setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const description = p.description.trim() || t('chat.untitled');
      const date = isValidISODate(p.date) ? p.date : todayLocalISO();
      await db.transaction('rw', [db.transactions, db.chatMessages, db.transactionAudit], async () => {
        const txId = (await db.transactions.add({
          description,
          amount,
          date,
          createdAt: now,
          rawText: description,
          note: p.note || undefined,
          source: p.source || undefined,
        })) as number;
        const after = await db.transactions.get(txId);
        if (after) await db.transactionAudit.add({ txId, action: 'create', at: now, after });
        await addChatMessage({
          role: 'assistant',
          text: t('chat.saved', { desc: description, amount: fmtIDR(amount) }),
          createdAt: new Date().toISOString(),
          txId,
        });
        await addChatMessage({
          role: 'assistant',
          text: '__LINK_RINGKASAN__',
          createdAt: new Date().toISOString(),
        });
      });
      void requestPersistentStorage();
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
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current += 1; setIsDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDragLeave={(e) => { e.preventDefault(); dragCounter.current = Math.max(0, dragCounter.current - 1); if (dragCounter.current === 0) setIsDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void handleFile(f);
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
            <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bone)] text-[var(--text-secondary)] text-xs font-semibold border border-[var(--border)]">
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
        <ChatEmptyState
          showOcrGuide={showOcrGuide}
          keyboardInset={keyboardInset}
          onSelectExample={(text) => { setInput(text); textareaRef.current?.focus(); }}
          onPickFile={() => fileRef.current?.click()}
          onDismissGuide={dismissGuide}
        />
      )}

      {messagesFailed && (
        <div className="px-4 md:px-6 pt-4">
          <DbErrorNotice
            message={t('chat.loadError')}
            retryLabel={t('common.retry')}
            onRetry={() => void retryMessages()}
          />
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
                className="min-h-12 px-4 rounded-full bg-[var(--card)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
              >
                {t('chat.loadOlder')}
              </button>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={m.id} message={m} showTime={shouldShowTime(messages[i - 1], m)} lang={lang} />
          ))}

          {ocrProgress !== null && (
            <OcrProgressCard progress={ocrProgress} previewUrl={previewUrl} />
          )}

          {pending && (
            <PendingCard
              pending={pending}
              editable={pendingEditable}
              saving={isSaving}
              ocrConfidence={ocrConfidence}
              onToggleEdit={() => setPendingEditable((v) => !v)}
              onChange={setPending}
              onSave={() => void confirmSave()}
              onCancel={() => { setPending(null); setOcrError(null); setOcrConfidence(null); }}
            />
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
      {liveDebounced.trim() !== '' && <LiveParseFeedback debounced={liveDebounced} fallbackDescription={t('chat.untitled')} />}
        <form onSubmit={handleSend} className="flex items-end gap-2 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:border-[var(--accent)] transition-all">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // User sengaja batal (Cancel picker) → diam, bukan error.
              // Hanya permission-denied nyata yang ditangani browser via
              // file kosong; tanpa sinyal itu jangan tuduh kamera ditolak.
              if (f) {
                void handleFile(f);
              }
              e.target.value = '';
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
            className="hidden sm:grid w-12 h-12 rounded-full bg-[var(--bg)] border border-[var(--border)] place-items-center shrink-0 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--border)] active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
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
            className="flex-1 min-w-0 min-h-12 max-h-32 bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-[var(--text-muted)] resize-none leading-snug"
          />
          {input.length > 400 && (
            <span className={`text-xs tabular-nums self-end mb-2.5 ${input.length >= 500 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`} aria-live="polite">
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
          <p className="hidden md:block text-xs tracking-wide text-[var(--text-secondary)] text-center mt-2.5">
            <span>{t('chat.shortcutsDesktop')}</span>
          </p>
        )}
      </div>

      <FormatCheatSheet open={showSheet} onClose={() => setShowSheet(false)} />
      {/* key per pesan agar timer toast baru tidak mewarisi sisa timer lama. */}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      <style>{String.raw`@keyframes in { from { opacity:0; transform: translateY(4px)} to { opacity:1; transform: translateY(0)} } @media (prefers-reduced-motion: reduce) { .motion-safe\:animate-pulse, .motion-safe\:animate-\[in_0\.2s_ease-out\] { animation: none !important; } }`}</style>
    </div>
  );
}
