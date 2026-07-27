/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

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

/** 后缀（含点）；没有后缀返回空串。Dockerfile 这类无后缀文件走文件名匹配。 */
function getExtension(relPath: string): string {
  const lowerPath = relPath.toLowerCase();
  return lowerPath.includes(".") ? lowerPath.slice(lowerPath.lastIndexOf(".")) : "";
}

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

  return TEXT_EXTENSIONS.has(getExtension(relPath));
}

/** 后缀 → Monaco 语言 id。这些语法都在本地打包的 monaco-editor 里，不额外拉包。 */
const LANGUAGE_BY_EXTENSION: Record<string, SkillFileLanguage> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".py": "python",
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".sql": "sql",
  ".xml": "xml",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".toml": "ini",
  ".ini": "ini",
  ".cfg": "ini",
};

export type SkillFileLanguage =
  | "css"
  | "html"
  | "ini"
  | "javascript"
  | "json"
  | "markdown"
  | "plaintext"
  | "python"
  | "shell"
  | "sql"
  | "typescript"
  | "xml"
  | "yaml";

/** 高亮按后缀判，认不出来的按纯文本渲染——猜错语言比不高亮更难读。 */
export function resolveSkillFileLanguage(relPath?: string): SkillFileLanguage {
  if (!relPath) {
    return "plaintext";
  }

  return LANGUAGE_BY_EXTENSION[getExtension(relPath)] ?? "plaintext";
}

export function isMarkdownSkillFile(relPath?: string): boolean {
  return resolveSkillFileLanguage(relPath) === "markdown";
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
