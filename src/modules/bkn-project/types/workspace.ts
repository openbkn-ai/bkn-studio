/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** The pages of a project workspace, as they appear in its URL. */
export const PROJECT_SECTIONS = [
  "overview",
  "requirements",
  "model",
  "instances",
  "release",
  "builds",
] as const;

export type ProjectSection = (typeof PROJECT_SECTIONS)[number];

/** Pages of the professional knowledge-base extension: hidden in the community image. */
export const KNOWLEDGE_BASE_SECTIONS: readonly ProjectSection[] = ["instances", "builds"];

export function isProjectSection(value: string | undefined): value is ProjectSection {
  return (PROJECT_SECTIONS as readonly string[]).includes(value ?? "");
}

/** What a link to the modeling page asks it to show: the update field an object type waits for. */
export const updateFieldFocus = (objectTypeId: string) => `update-field:${objectTypeId}`;

/** An object type of the project's draft, open in the object type editor. */
export const projectObjectTypePath = (projectId: string, itemId: string) =>
  `${projectSectionPath(projectId, "model")}/object-types/${encodeURIComponent(itemId)}`;

export function projectSectionPath(projectId: string, section: ProjectSection) {
  return `/bkn-project/${encodeURIComponent(projectId)}/${section}`;
}
