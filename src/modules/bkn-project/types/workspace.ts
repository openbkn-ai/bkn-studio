/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** The pages of a project workspace, as they appear in its URL. */
export const PROJECT_SECTIONS = [
  "overview",
  "resources",
  "model",
  "scenarios",
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

/**
 * Pages that moved, by the address they had: links and bookmarks to them open where their content
 * is now. The requirements page held the scenarios and their documents; the documents moved to
 * the requirements and resources page.
 */
export const MOVED_SECTIONS: Readonly<Record<string, ProjectSection>> = {
  requirements: "scenarios",
};

/** What a link to the modeling page asks it to show: the update field an object type waits for. */
export const updateFieldFocus = (objectTypeId: string) => `update-field:${objectTypeId}`;

/** The modeling page with an object type of the draft open in its editing panel. */
export const projectObjectTypePath = (projectId: string, itemId: string) =>
  `${projectSectionPath(projectId, "model")}?object=${encodeURIComponent(itemId)}`;

/** A knowledge network's workspace, opened at its overview. */
export const networkWorkspacePath = (networkId: string) =>
  `/knowledge-network/workspace/${encodeURIComponent(networkId)}/overview`;

export function projectSectionPath(projectId: string, section: ProjectSection) {
  return `/bkn-project/${encodeURIComponent(projectId)}/${section}`;
}
