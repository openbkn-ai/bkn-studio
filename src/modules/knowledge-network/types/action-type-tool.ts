/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type MockActionToolParameter = {
  name: string;
  required?: boolean;
  type?: string;
};

export type MockActionTool = {
  boxId: string;
  boxName: string;
  parameters: MockActionToolParameter[];
  toolId: string;
  toolName: string;
  type: "tool";
};
