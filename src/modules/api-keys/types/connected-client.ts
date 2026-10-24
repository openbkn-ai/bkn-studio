/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** An external client (WorkBuddy, Claude Code, Cursor…) the user signed in from. */
export type ConnectedClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  grantedAt: string | null;
  scopes: string[];
};
