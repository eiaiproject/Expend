export async function recognizeImage(file: File, onProgress: (n: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker: any = await createWorker('ind+eng', 1, {
    logger: (m: any) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  try {
    onProgress(5);
    const { data } = await worker.recognize(file);
    onProgress(100);
    return data.text as string;
  } finally {
    await worker.terminate();
  }
}
