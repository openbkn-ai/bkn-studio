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

/** Where a page may add a small control right after the top bar's trail, such as a version picker. */
export type ShellTrailSlotValue = {
  setTrailHost: (host: HTMLSpanElement | null) => void;
  trailHost: HTMLSpanElement | null;
};

export const ShellTrailSlotContext = createContext<ShellTrailSlotValue | null>(null);
