/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { DefinitionObject } from "./model";

export type ApiDefinitionEditorProps = {
  value?: DefinitionObject;
  onChange: (value: DefinitionObject) => void;
  disabled?: boolean;
  onValidityChange?: (valid: boolean) => void;
};
