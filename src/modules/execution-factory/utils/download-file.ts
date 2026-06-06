export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function sanitizeDownloadFilename(name: string, fallback: string) {
  const sanitized = name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || fallback;
}
