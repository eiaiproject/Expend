import type { ReceiptResult } from './receiptParser'

interface OcrWorker {
  recognize: (image: Blob) => Promise<{ data: { text: string } }>
  terminate: () => Promise<unknown>
}

export type OcrPhase = 'Menyiapkan mesin OCR' | 'Membaca teks'
export type OcrFailureReason = 'engine' | 'image'

export class OcrFailure extends Error {
  reason: OcrFailureReason

  constructor(reason: OcrFailureReason) {
    super(reason)
    this.name = 'OcrFailure'
    this.reason = reason
  }
}

let workerPromise: Promise<OcrWorker> | null = null
let progressHandler: ((progress: number, phase: OcrPhase) => void) | null = null

async function getWorker(): Promise<OcrWorker> {
  if (workerPromise) return workerPromise

  const pending = (async () => {
    const { createWorker } = await import('tesseract.js')
    return (await createWorker('ind+eng', 1, {
      langPath: '/tessdata',
      gzip: false,
      workerPath: '/tesseract-worker.min.js',
      corePath: '/tesseract-core',
      workerBlobURL: false,
      logger: (message: { status: string; progress: number }) => {
        if (message.status === 'recognizing text') {
          progressHandler?.(message.progress, 'Membaca teks')
        } else {
          progressHandler?.(0, 'Menyiapkan mesin OCR')
        }
      },
    })) as unknown as OcrWorker
  })()

  workerPromise = pending
  void pending.catch(() => {
    if (workerPromise === pending) workerPromise = null
  })
  return pending
}

async function shrink(file: Blob): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== 'function') return file
    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    if (longest <= 1600 && file.size < 3_000_000) {
      bitmap.close()
      return file
    }
    const scale = Math.min(1, 1600 / longest)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const resized = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    return resized ?? file
  } catch {
    return file
  }
}

export async function readReceipt(
  file: File,
  onProgress: (progress: number, phase: OcrPhase) => void,
): Promise<ReceiptResult> {
  const { parseReceipt } = await import('./receiptParser')
  progressHandler = onProgress

  let worker: OcrWorker
  try {
    worker = await getWorker()
  } catch {
    progressHandler = null
    throw new OcrFailure('engine')
  }

  onProgress(0.02, 'Membaca teks')
  const image = await shrink(file)

  try {
    const { data } = await worker.recognize(image)
    return parseReceipt(data.text)
  } catch {
    workerPromise = null
    void worker.terminate().catch(() => {})
    throw new OcrFailure('image')
  } finally {
    progressHandler = null
  }
}

export async function cancelOcr(): Promise<void> {
  progressHandler = null
  const pending = workerPromise
  workerPromise = null
  if (!pending) return
  try {
    const worker = await pending
    await worker.terminate()
  } catch {
    // Worker gagal dibuat: tidak ada yang perlu dihentikan.
  }
}
