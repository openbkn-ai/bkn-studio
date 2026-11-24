/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * What another page asks of the event class page when it sends the user there: show a class, or
 * open its edit or delete. It travels in the navigation state, so a shared link never opens a
 * delete.
 */
export type EventClassIntent = { action: "delete" | "edit" | "view"; code: string };

export type EventClassNavigationState = { eventClassIntent?: EventClassIntent };

/** The event class page of a network, under its dynamic model. */
export function eventClassesPath(networkId: string) {
  return `/knowledge-network/workspace/${encodeURIComponent(networkId)}/event-classes`;
}

export function readEventClassIntent(state: unknown): EventClassIntent | undefined {
  const intent = (state as EventClassNavigationState | null | undefined)?.eventClassIntent;
  return intent &&
    typeof intent.code === "string" &&
    (intent.action === "delete" || intent.action === "edit" || intent.action === "view")
    ? intent
    : undefined;
}
