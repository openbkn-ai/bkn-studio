/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CodeEditor } from "./CodeEditor";

type JsonEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  height?: number;
  readOnly?: boolean;
};

export function JsonEditor({
  value = "",
  onChange,
  height = 260,
  readOnly = false,
}: JsonEditorProps) {
  return (
    <CodeEditor
      height={height}
      language="json"
      onChange={onChange}
      readOnly={readOnly}
      value={value}
    />
  );
}
