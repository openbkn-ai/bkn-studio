const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_MIME_EXACT = new Set([
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "application/javascript",
  "application/xml",
  "application/markdown",
]);

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".py",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".sh",
  ".sql",
  ".xml",
  ".html",
  ".css",
  ".csv",
]);

export function isTextPreviewableSkillFile(mimeType?: string, relPath?: string): boolean {
  const normalizedMime = mimeType?.toLowerCase();
  if (normalizedMime) {
    if (TEXT_MIME_PREFIXES.some((prefix) => normalizedMime.startsWith(prefix))) {
      return true;
    }
    if (TEXT_MIME_EXACT.has(normalizedMime)) {
      return true;
    }
  }

  if (!relPath) {
    return false;
  }

  const lowerPath = relPath.toLowerCase();
  const extension = lowerPath.includes(".") ? lowerPath.slice(lowerPath.lastIndexOf(".")) : "";
  return TEXT_EXTENSIONS.has(extension);
}

/**
 * Rewrites internal OSS presigned URLs to a browser-reachable path.
 * - E2E / Docker dev: `VITE_API_BASE_URL=http://localhost:9010/api` → fetch via API gateway `/oss-workspace`
 * - Local Vite dev: relative `/oss-workspace` proxied in vite.config.ts
 */
export function resolveSkillFileFetchUrl(url: string, apiBaseUrl?: string): string {
  if (!url || url.startsWith("mock://")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "oss-minio" || parsed.pathname.startsWith("/oss-workspace")) {
      const normalizedApiBase = apiBaseUrl?.replace(/\/$/, "") ?? "";
      if (normalizedApiBase.startsWith("http")) {
        const gatewayOrigin = normalizedApiBase.replace(/\/api$/, "");
        return `${gatewayOrigin}${parsed.pathname}${parsed.search}`;
      }

      // E2E init script forces apiBaseUrl=/api; OSS still goes through nginx gateway on :9010.
      if (normalizedApiBase === "/api" || normalizedApiBase.endsWith("/api")) {
        return `http://127.0.0.1:9010${parsed.pathname}${parsed.search}`;
      }

      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return url;
  }

  return url;
}

export function formatSkillFileSize(size?: number): string {
  if (size === undefined || size === null) {
    return "-";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
