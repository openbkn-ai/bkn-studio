/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const RESOURCE_ID_MAX_LENGTH = 128;
export const RESOURCE_NAME_MAX_LENGTH = 128;
export const RESOURCE_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/;
export const RESOURCE_NAME_COUNT = {
  max: RESOURCE_NAME_MAX_LENGTH,
  strategy: (value: string) => Array.from(value).length,
  exceedFormatter: (value: string, { max }: { max: number }) =>
    Array.from(value).slice(0, max).join(""),
};
