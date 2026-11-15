/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ConfigProvider } from "antd";
import { CodeEditor } from "@/framework/code-editor/CodeEditor";

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  schema?: unknown;
  ariaLabel?: string;
  id?: string;
  placeholder?: string;
  height?: number;
  readOnly?: boolean;
};

/** Text only: parsing, validation and serialization remain with the caller. */
export function JsonInput({ schema, ariaLabel, height = 160, readOnly, ...props }: Props) {
  const { componentDisabled } = ConfigProvider.useConfig();
  return (
    <CodeEditor
      editableWhileLoading
      {...props}
      ariaLabel={ariaLabel}
      language="json"
      jsonSchema={schema}
      height={height}
      readOnly={readOnly || componentDisabled}
    />
  );
}
