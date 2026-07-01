/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext } from "react";

export type WorkspaceSlotsValue = {
  toolbarHost: HTMLDivElement | null;
};

export const WorkspaceSlotsContext = createContext<WorkspaceSlotsValue | null>(null);
