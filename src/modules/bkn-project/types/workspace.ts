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

/** The tabs of the requirements and resources page, as they appear in its URL. */
export const RESOURCE_TABS = ["catalogs", "knowledge-base", "documents"] as const;

export type ResourceTab = (typeof RESOURCE_TABS)[number];

/** The requirements and resources page, on a tab or on the one needing action first. */
export function projectResourcesPath(projectId: string, tab?: ResourceTab) {
  const path = projectSectionPath(projectId, "resources");
  return tab ? `${path}?tab=${tab}` : path;
}

/**
 * The page a project goes on to, in the order it is built: its inputs, the ontology, the scenarios
 * that test it, the knowledge base where the edition has one, then the release. None past the end.
 */
export function nextProjectSection(
  section: ProjectSection,
  knowledgeBaseEnabled: boolean,
): ProjectSection | null {
  const order: ProjectSection[] = [
    "resources",
    "model",
    "scenarios",
    ...(knowledgeBaseEnabled ? (["instances"] as const) : []),
    "release",
  ];
  const index = order.indexOf(section);
  return index < 0 ? null : (order[index + 1] ?? null);
}

export function projectSectionPath(projectId: string, section: ProjectSection) {
  return `/bkn-project/${encodeURIComponent(projectId)}/${section}`;
}
