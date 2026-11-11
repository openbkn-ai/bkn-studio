/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Cypher `$name` parameters, read the way the execution factory reads them when a Cypher
 * function is saved: `$` inside a string, a comment or a backtick-quoted name is no parameter,
 * a name may be any Unicode letters, digits and `_`, or backtick-quoted, and a positional
 * `$0` is refused (bkn-backend takes named parameters only).
 */
export type CypherParameterScan = {
  /** Distinct names, in first-use order. */
  names: string[];
  /** The statement uses a positional parameter such as `$0`. */
  positional: boolean;
  /** Where each named parameter is written, from its `$`, as UTF-16 offsets into the text. */
  spans: CypherParameterSpan[];
};

export type CypherParameterSpan = { name: string; start: number; end: number };

const NAME_CHAR = /[\p{L}\p{N}_]/u;
const NAME_START = /[\p{L}_]/u;
const DIGIT = /[0-9]/;

export function scanCypherParameters(query: string): CypherParameterScan {
  const names: string[] = [];
  const seen = new Set<string>();
  let positional = false;
  const spans: CypherParameterSpan[] = [];
  const chars = Array.from(query);
  // offsets[i] is where chars[i] starts in the string; a character beyond the BMP takes two units.
  const offsets: number[] = [0];
  for (const char of chars) offsets.push(offsets[offsets.length - 1] + char.length);
  const offsetAt = (index: number) => offsets[Math.min(index, chars.length)];
  let i = 0;
  let dollar = 0;
  const add = (name: string) => {
    spans.push({ name, start: offsetAt(dollar), end: offsetAt(i) });
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  };

  while (i < chars.length) {
    const c = chars[i];
    const next = chars[i + 1];
    if (c === "'" || c === '"') {
      i += 1;
      while (i < chars.length && chars[i] !== c) {
        i += chars[i] === "\\" ? 2 : 1;
      }
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < chars.length && chars[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < chars.length && !(chars[i] === "*" && chars[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === "`") {
      i += 1;
      while (i < chars.length) {
        if (chars[i] === "`") {
          if (chars[i + 1] === "`") {
            i += 2;
            continue;
          }
          break;
        }
        i += 1;
      }
      i += 1;
      continue;
    }
    if (c !== "$") {
      i += 1;
      continue;
    }
    dollar = i;
    i += 1;
    if (i >= chars.length) break;
    if (chars[i] === "`") {
      let name = "";
      i += 1;
      while (i < chars.length) {
        if (chars[i] === "`") {
          if (chars[i + 1] === "`") {
            name += "`";
            i += 2;
            continue;
          }
          break;
        }
        name += chars[i];
        i += 1;
      }
      i += 1;
      if (name) add(name);
      continue;
    }
    if (DIGIT.test(chars[i])) {
      positional = true;
      while (i < chars.length && NAME_CHAR.test(chars[i])) i += 1;
      continue;
    }
    if (!NAME_START.test(chars[i])) continue;
    let name = "";
    while (i < chars.length && NAME_CHAR.test(chars[i])) {
      name += chars[i];
      i += 1;
    }
    add(name);
  }
  return { names, positional, spans };
}

/** A name written as `$name` when it can be, and as `` $`name` `` when it cannot. */
export function cypherParameterReference(name: string): string {
  return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name) ? `$${name}` : `$\`${name.replace(/`/g, "``")}\``;
}

export type CypherScalarType = "string" | "number" | "boolean";

export type CypherLiteral =
  | { type: CypherScalarType; value: string | number | boolean }
  | { type: "array"; itemType: CypherScalarType; value: Array<string | number | boolean> };

function scalarLiteral(
  text: string,
): { type: CypherScalarType; value: string | number | boolean } | null {
  const trimmed = text.trim();
  if (trimmed.length >= 2) {
    const quote = trimmed[0];
    if ((quote === "'" || quote === '"') && trimmed[trimmed.length - 1] === quote) {
      const body = trimmed.slice(1, -1);
      // A quote of the same kind inside means this is more than one literal.
      if (new RegExp(`(^|[^\\\\])${quote}`).test(body)) return null;
      return { type: "string", value: body.replace(/\\(.)/g, "$1") };
    }
  }
  if (/^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(trimmed)) {
    return { type: "number", value: Number(trimmed) };
  }
  if (/^(true|false)$/i.test(trimmed)) {
    return { type: "boolean", value: trimmed.toLowerCase() === "true" };
  }
  return null;
}

/**
 * Reads the text a user selected to turn into a parameter: a quoted string, a number, a boolean,
 * or a list of one kind of them (for `IN $name`). Anything else, a property name or an
 * expression, cannot become a parameter: a statement's parameters replace values only.
 */
export function parseCypherLiteral(text: string): CypherLiteral | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return null;
    const parts = splitListItems(inner);
    if (!parts) return null;
    const items = parts.map(scalarLiteral);
    if (items.some((item) => item === null)) return null;
    const scalars = items as Array<{ type: CypherScalarType; value: string | number | boolean }>;
    const itemType = scalars[0].type;
    if (scalars.some((item) => item.type !== itemType)) return null;
    return { type: "array", itemType, value: scalars.map((item) => item.value) };
  }
  return scalarLiteral(trimmed);
}

/** Splits a list's items on commas outside quotes. */
function splitListItems(inner: string): string[] | null {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i];
    if (quote) {
      current += c;
      if (c === "\\") {
        current += inner[i + 1] ?? "";
        i += 1;
      } else if (c === quote) {
        quote = null;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      current += c;
      continue;
    }
    if (c === "[" || c === "]") return null;
    if (c === ",") {
      parts.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  if (quote) return null;
  parts.push(current);
  return parts.map((part) => part.trim());
}

/**
 * A name for a new parameter: the property the literal is compared with when the text right
 * before it says so (`s.code = 'x'`, `{code: 'x'}`, `s.code IN [...]`), else `param`, made
 * distinct from the names in use.
 */
export function suggestCypherParameterName(before: string, taken: readonly string[]): string {
  const match =
    /([\p{L}_][\p{L}\p{N}_]*)`?\s*(?:=|<>|<=|>=|<|>|:|\bIN\b|\bCONTAINS\b|\bSTARTS\s+WITH\b|\bENDS\s+WITH\b)\s*$/iu.exec(
      before,
    );
  const base = match?.[1] && !/^(where|and|or|not|return|in)$/i.test(match[1]) ? match[1] : "param";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n += 1) {
    if (!used.has(`${base}_${n}`)) return `${base}_${n}`;
  }
}

/**
 * A parameter's value typed on the data query page, read as a Cypher literal (`'S1'`, `5`,
 * `true`, `[1, 2]`). Text that is no literal is taken as a string, so a plain `S1` works too;
 * a code made of digits needs quotes to stay a string, as it would in the statement.
 */
export function cypherParameterValue(text: string): CypherLiteral | null {
  if (!text.trim()) return null;
  return parseCypherLiteral(text) ?? { type: "string", value: text.trim() };
}

/** The values of the statement's parameters that have one. */
export function cypherParameterValues(
  names: readonly string[],
  texts: Readonly<Record<string, string>>,
): Record<string, string | number | boolean | Array<string | number | boolean>> {
  const values: Record<string, string | number | boolean | Array<string | number | boolean>> = {};
  for (const name of names) {
    const literal = cypherParameterValue(texts[name] ?? "");
    if (literal) values[name] = literal.value;
  }
  return values;
}

function scalarText(value: string | number | boolean): string {
  return typeof value === "string"
    ? `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
    : String(value);
}

/** A value as the literal text the parameter inputs show. */
export function cypherLiteralText(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value
      .filter((item): item is string | number | boolean =>
        ["string", "number", "boolean"].includes(typeof item),
      )
      .map(scalarText)
      .join(", ")}]`;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return scalarText(value);
  }
  return "";
}

/**
 * The statement with every string, comment and backtick-quoted name blanked to spaces, by the
 * same rules the parameter scan reads it, so a keyword search finds only what is written as
 * code: `'LIMIT 5'` or `// ORDER BY` is no clause.
 */
export function blankCypherLiterals(query: string): string {
  let out = "";
  let i = 0;
  const blank = (text: string) => text.replace(/[^\n]/g, " ");
  while (i < query.length) {
    const c = query[i];
    const next = query[i + 1];
    let end = -1;
    if (c === "'" || c === '"') {
      end = i + 1;
      while (end < query.length && query[end] !== c) end += query[end] === "\\" ? 2 : 1;
      end += 1;
    } else if (c === "/" && next === "/") {
      end = query.indexOf("\n", i);
      if (end < 0) end = query.length;
    } else if (c === "/" && next === "*") {
      end = query.indexOf("*/", i + 2);
      end = end < 0 ? query.length : end + 2;
    } else if (c === "`") {
      end = i + 1;
      while (end < query.length) {
        if (query[end] === "`") {
          if (query[end + 1] === "`") {
            end += 2;
            continue;
          }
          break;
        }
        end += 1;
      }
      end += 1;
    }
    if (end < 0) {
      out += c;
      i += 1;
      continue;
    }
    end = Math.min(end, query.length);
    out += blank(query.slice(i, end));
    i = end;
  }
  return out;
}
