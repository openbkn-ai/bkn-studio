/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Palette shared with the ontology preview (first eight), extended so twelve object types stay distinct. */
export const OBJECT_TYPE_PALETTE = [
  "#2e68ff",
  "#7c4dff",
  "#00b8a3",
  "#f5a623",
  "#eb5757",
  "#11a0d8",
  "#9b51e0",
  "#2bb673",
  "#d4380d",
  "#08979c",
  "#c41d7f",
  "#7cb305",
];

export type MenuAction =
  | "expandOut"
  | "expandIn"
  | "expandBoth"
  | "setPathStart"
  | "clearPathStart"
  | "setPathEnd"
  | "clearPathEnd"
  | "remove"
  | "pin"
  | "unpin";

export const MENU_ORDER: MenuAction[] = ["expandOut", "expandIn", "expandBoth", "setPathStart", "setPathEnd", "pin", "remove"];
