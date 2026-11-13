/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * The object types AI reads: those the network already has, and those of the project's own
 * confirmed model, apart.
 */
export type AskModel = {
  /** The project's concept model is confirmed. */
  confirmed: boolean;
  /** Adopted object types the network already has. */
  network: number;
  /** Adopted object types the project adds. */
  project: number;
};

/** The adopted object types of a draft, apart by whether the network already has them. */
export function modelCountsOf(
  objectTypes: readonly { adopted: boolean; existing?: boolean }[],
): Omit<AskModel, "confirmed"> {
  const adopted = objectTypes.filter((item) => item.adopted);
  const network = adopted.filter((item) => item.existing).length;
  return { network, project: adopted.length - network };
}
