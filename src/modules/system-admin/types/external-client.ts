/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** A client that registered itself to let a user sign in from an agent (MCP sign-in). */
export type ExternalClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  registeredAt: string | null;
  registeredFrom: string;
};
