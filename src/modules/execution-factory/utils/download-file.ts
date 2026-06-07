export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function sanitizeDownloadFilename(name: string, fallback: string) {
  const sanitized = name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || fallback;
}

export function parseContentDispositionFilename(
  contentDisposition?: string,
): string | undefined {
  if (!contentDisposition?.trim()) {
    return undefined;
  }

  const filenameMatch = contentDisposition.match(
    /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i,
  );

  if (!filenameMatch?.[1]) {
    return undefined;
  }

  const raw = filenameMatch[1].replace(/['"]/g, "").trim();
  if (!raw) {
    return undefined;
  }

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
