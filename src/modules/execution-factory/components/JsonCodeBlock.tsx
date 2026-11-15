/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { JsonTextBlock } from "@/framework/json/JsonTextBlock";

type JsonCodeBlockProps = {
  value: unknown;
  className?: string;
};

function toPretty(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    // Fall back for values such as circular references that JSON.stringify cannot handle.
    return Object.prototype.toString.call(value);
  }
}

export function JsonCodeBlock({ value, className }: JsonCodeBlockProps) {
  const pretty = toPretty(value);
  return <JsonTextBlock text={pretty ?? "-"} className={className} />;
}
