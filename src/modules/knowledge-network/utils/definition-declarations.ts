/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  DefinitionDeclarations,
  DefinitionLifecycle,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  aliasProblem,
  type AliasProblem,
  areDeclarationValuesEqual,
} from "@/modules/knowledge-network/utils/property-declarations";

/** The lifecycle statuses the form offers; a definition without a lifecycle is active. */
export type LifecycleStatus = "active" | "deprecated";

/** The aliases and lifecycle as the basic info form holds them. */
export type DefinitionDeclarationFormValues = {
  aliases?: string[];
  lifecycleReason?: string;
  lifecycleStatus?: LifecycleStatus;
  replacedBy?: string;
};

/**
 * Drops what declares nothing: empty aliases, and a lifecycle that is not deprecated. Aliases are
 * trimmed and keep their order, which is the user's.
 */
export function normalizeDefinitionDeclarations(
  value: DefinitionDeclarations | undefined,
): DefinitionDeclarations | undefined {
  if (!value) {
    return undefined;
  }
  const aliases = (value.aliases ?? []).map((alias) => alias.trim()).filter(Boolean);
  const lifecycle = normalizeLifecycle(value.lifecycle);
  const next: DefinitionDeclarations = {
    ...(aliases.length ? { aliases } : {}),
    ...(lifecycle ? { lifecycle } : {}),
  };
  return Object.keys(next).length ? next : undefined;
}

function normalizeLifecycle(
  value: DefinitionLifecycle | undefined,
): DefinitionLifecycle | undefined {
  if (value?.status !== "deprecated") {
    return undefined;
  }
  const replacedBy = value.replacedBy?.trim();
  return {
    reason: value.reason.trim(),
    ...(replacedBy ? { replacedBy } : {}),
    status: "deprecated",
  };
}

export function areDefinitionDeclarationsEqual(
  left: DefinitionDeclarations | undefined,
  right: DefinitionDeclarations | undefined,
) {
  return areDeclarationValuesEqual(
    normalizeDefinitionDeclarations(left),
    normalizeDefinitionDeclarations(right),
  );
}

export const isDeprecated = (value: { declarations?: DefinitionDeclarations } | undefined) =>
  value?.declarations?.lifecycle?.status === "deprecated";

/**
 * Checks the aliases of a definition: their count, each alias, and that none is one of its own
 * names. Whether an alias is the name of another definition only the backend checks.
 */
export function definitionAliasProblem(
  aliases: readonly string[] | undefined,
  ownNames: readonly string[],
): AliasProblem | null {
  return aliasProblem(aliases ?? [], ownNames.map((name) => name.trim()).filter(Boolean), []);
}

export function toDefinitionDeclarationForm(
  value: DefinitionDeclarations | undefined,
): Required<Pick<DefinitionDeclarationFormValues, "aliases" | "lifecycleStatus">> &
  DefinitionDeclarationFormValues {
  const lifecycle = value?.lifecycle;
  return {
    aliases: [...(value?.aliases ?? [])],
    lifecycleReason: lifecycle?.reason,
    lifecycleStatus: lifecycle ? "deprecated" : "active",
    replacedBy: lifecycle?.replacedBy,
  };
}

/** The declarations the form holds. Setting it back to active drops the reason and replacement. */
export function fromDefinitionDeclarationForm(
  values: DefinitionDeclarationFormValues,
): DefinitionDeclarations | undefined {
  return normalizeDefinitionDeclarations({
    aliases: values.aliases,
    lifecycle:
      values.lifecycleStatus === "deprecated"
        ? {
            reason: values.lifecycleReason ?? "",
            replacedBy: values.replacedBy,
            status: "deprecated",
          }
        : undefined,
  });
}

/**
 * The definitions that can replace the one with `id`: those of the same kind still in use, other
 * than itself.
 */
export function replacementCandidates<
  T extends { declarations?: DefinitionDeclarations; id: string },
>(items: readonly T[], id: string | undefined): T[] {
  return items.filter((item) => item.id !== id && !isDeprecated(item));
}
