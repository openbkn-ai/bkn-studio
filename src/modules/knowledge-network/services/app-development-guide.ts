/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * The App development page as a document, for downloading as Markdown or opening as a standalone
 * HTML page. Both come from one list of nodes, so the two never disagree.
 */

export type GuideCodeLanguage = "bash" | "python" | "typescript" | "json" | "text";

export type GuideNode =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "code"; language: GuideCodeLanguage; code: string }
  | { kind: "link"; text: string; href: string };

/** A fence longer than any run of backquotes in the code, so Cypher's backquotes stay inside. */
function fence(code: string) {
  const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}

export function toMarkdown(nodes: GuideNode[]): string {
  const blocks = nodes.map((node) => {
    switch (node.kind) {
      case "heading":
        return `${"#".repeat(node.level)} ${node.text}`;
      case "paragraph":
        return node.text;
      case "list":
        return node.items.map((item) => `- ${item}`).join("\n");
      case "link":
        return `[${node.text}](${node.href})`;
      case "code": {
        const marks = fence(node.code);
        return `${marks}${node.language === "text" ? "" : node.language}\n${node.code}\n${marks}`;
      }
    }
  });
  return `${blocks.join("\n\n")}\n`;
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Every piece of text is escaped: names and values come from the network and are not markup. */
export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

function safeHref(href: string) {
  return /^https?:\/\//i.test(href) ? escapeHtml(href) : "#";
}

const STYLE = `
:root { color-scheme: light dark; }
body { margin: 0; font: 15px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #182235; background: #fff; }
main { max-width: 920px; margin: 0 auto; padding: 40px 24px 80px; }
h1 { font-size: 26px; margin: 0 0 8px; }
h2 { font-size: 20px; margin: 36px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e4eaf0; }
h3 { font-size: 16px; margin: 24px 0 8px; }
h4 { font-size: 14px; margin: 16px 0 6px; color: #5b6b78; }
p, li { color: #34404c; }
pre { margin: 8px 0 16px; padding: 12px 16px; border: 1px solid #e4eaf0; border-radius: 6px; background: #f8fafc; font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
a { color: #1f6feb; }
@media (prefers-color-scheme: dark) {
  body { color: #e2e8f0; background: #111318; }
  p, li { color: #c3ccdb; }
  h2 { border-color: #2b2f37; }
  h4 { color: #a8afba; }
  pre { background: #1d2027; border-color: #2b2f37; }
  a { color: #6ea8fe; }
}
`;

/** A standalone page: no script, every text escaped. */
export function toHtml(title: string, nodes: GuideNode[], lang: string): string {
  const body = nodes
    .map((node) => {
      switch (node.kind) {
        case "heading":
          return `<h${String(node.level)}>${escapeHtml(node.text)}</h${String(node.level)}>`;
        case "paragraph":
          return `<p>${escapeHtml(node.text)}</p>`;
        case "list":
          return `<ul>${node.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
        case "link":
          return `<p><a href="${safeHref(node.href)}" rel="noreferrer" target="_blank">${escapeHtml(node.text)}</a></p>`;
        case "code":
          return `<pre><code>${escapeHtml(node.code)}</code></pre>`;
      }
    })
    .join("\n");
  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(lang)}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    `<body><main>\n${body}\n</main></body>`,
    "</html>",
  ].join("\n");
}

/** A file name from the network id, kept to characters every file system accepts. */
export function guideFileName(knId: string, extension: "md" | "html") {
  const base = knId.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "knowledge-network";
  return `${base}-app-development.${extension}`;
}
