/**
 * Download a Blob as a file.
 * Automatically revokes the object URL after the download to prevent memory leaks.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Revoke after a microtask to ensure the browser has started the download
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}
