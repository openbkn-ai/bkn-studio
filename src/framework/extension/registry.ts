/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n, { type TFunction } from "i18next";
import { createElement, type ComponentType, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import { RequireCapability } from "@/framework/entitlement/RequireCapability";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import type { SupportedLocale } from "@/framework/runtime/types";
import type { RevisionPreview } from "@/modules/bkn-project/components/ai/AskAiSidebar";
import type {
  AskRevision,
  Draft,
  DraftObjectType,
  DraftObjectTypeSave,
  DraftProperty,
  DraftRelationType,
  DraftRelationTypeSave,
} from "@/modules/bkn-project/types/draft";
import { capabilityMinEdition } from "@/modules/subscription/capability-catalog";

/**
 * What another build adds to Studio without this repository knowing about it: routes, the
 * buttons that lead to them, and the copy they render. The community build installs none.
 *
 * Registration happens in exactly one module, `@/app/extensions/installed`, which the entry
 * imports before the app mounts. A build that ships extensions (the enterprise image) swaps
 * that module out through a bundler alias instead of editing it, so the dependency runs one
 * way: the extending build imports Studio, Studio never imports it.
 */
export type StudioExtension = {
  /** Unique within a build. */
  id: string;
  /**
   * Capability key that switches the routes on. The shell reads it from the server's
   * capability list and does not judge it: every route is wrapped in a capability guard, so
   * a build that carries the code still renders nothing the licence does not cover, and a
   * licence that falls short gets the upgrade page instead.
   */
  capability: string;
  /** Routes inside the app shell, beside the module routes. */
  routes?: RouteObject[];
  /** Routes without the shell, like the knowledge-network workspace pages. */
  standaloneRoutes?: RouteObject[];
  /** Buttons on the knowledge-network workspace overview, beside Authorize and Edit. */
  workspaceActions?: WorkspaceAction[];
  /**
   * Entries in the knowledge-network workspace sidebar, under ability verification after the
   * built-in Q&A and MCP entries, or in the analysis group (see WorkspaceNavEntry.section).
   * Separate from workspaceActions, so the extension decides where each of its pages is offered.
   */
  workspaceNavItems?: WorkspaceNavEntry[];
  /**
   * Pages that take a set of instances from the graph overview, offered there as a button for
   * the instances selected on screen.
   */
  instanceHandOvers?: InstanceHandOver[];
  /** Copy merged into the translation resources, by locale. */
  locales?: Partial<Record<SupportedLocale, Record<string, unknown>>>;
  /** Embedded in the existing project resources page, inside its KB edition slot. */
  projectKnowledgeBaseResources?: ComponentType<ProjectKnowledgeBaseResourceProps>;
  /** Embedded in the existing modeling page; the core owns draft refresh. */
  projectKnowledgeBaseModel?: ComponentType<ProjectKnowledgeBaseModelProps>;
  /** Build progress and evidence previews, on the build page's unstructured tab. */
  projectKnowledgeBaseBuilds?: ComponentType<ProjectKnowledgeBaseBuildProps>;
  /** The term library page, under governance in the project navigation. */
  projectTermLibrary?: ComponentType<ProjectTermLibraryProps>;
  /** Concepts drawn from knowledge-base documents, on the concept extraction page. */
  projectConceptSource?: ComponentType<ProjectConceptSourceProps>;
  /**
   * Object types drawn from somewhere other than a table (documents, in the professional
   * edition): how the editing panel saves and checks them, its form for them, and how the model
   * names them. Without one such items do not exist, and the panel only edits table mappings.
   */
  projectObjectSourceEditor?: ProjectObjectSourceEditor;
  /** The same for relation types, including making one of them from the relation panel. */
  projectRelationSourceEditor?: ProjectRelationSourceEditor;
  /** The knowledge-bases section of the knowledge-network workspace. */
  knowledgeNetworkResourcePanel?: ComponentType<KnowledgeNetworkResourcePanelProps>;
  /** What a relation drawn from documents rests on, in the model's relation basis column. */
  projectRelationBasis?: ComponentType<ProjectRelationBasisProps>;
  /** Picks requirement documents from knowledge-base files, beside uploading them. */
  projectRequirementDocumentPicker?: ComponentType<ProjectRequirementDocumentPickerProps>;
  /** The knowledge-base block on the project overview, under the stat cards. */
  projectOverviewKnowledgeBase?: ComponentType<ProjectOverviewKnowledgeBaseProps>;
};

/** The project an extension's page or panel is for, and what the person may do there. */
type ProjectSlotProps = {
  projectId: string;
  /** Owner of an open project: may change what the panel holds. */
  canEdit: boolean;
};

export type ProjectTermLibraryProps = ProjectSlotProps & {
  /** The lineage the project publishes to, which the term library is kept for. */
  lineageId: string;
};

export type ProjectConceptSourceProps = ProjectSlotProps & {
  /** Something the panel did changed the concepts: the page reads them again. */
  onChanged: () => void;
};

/**
 * The part of an object or relation editing panel an edition supplies for items it owns. The
 * panel keeps what it edits for such an item as one value (`Save`, what saving sends) and leaves
 * reading, checking and changing that value to the editor; name and description stay the panel's.
 */
export type ProjectSourceEditor<Item, Save, EditorItem = Item> = {
  /** Whether the item is one this editor owns; the panel edits the others as table mappings. */
  appliesTo: (item: Item) => boolean;
  /** What saving the item unchanged sends, to start editing from and to tell changes. */
  toSave: (item: Item) => Save;
  /** Ask AI's revisions put into the value being edited, as if made by hand. */
  applyRevisions: (value: Save, revisions: AskRevision[], item: EditorItem) => Save;
  /** The form under name and description. */
  Editor: ComponentType<ProjectSourceEditorProps<EditorItem, Save>>;
};

export type ProjectSourceEditorProps<Item, Save> = {
  projectId: string;
  /** The draft the panel edits on. */
  draft: Draft;
  item: Item;
  value: Save;
  onChange: (value: Save) => void;
};

export type ProjectObjectSourceEditor = ProjectSourceEditor<
  DraftObjectType,
  DraftObjectTypeSave
> & {
  /** Translation key of why the value cannot be saved yet, or null when it can. */
  check: (value: DraftObjectTypeSave, item: DraftObjectType) => string | null;
  /** How one of Ask AI's revisions reads against the value being edited. */
  preview: (t: TFunction, value: DraftObjectTypeSave, revision: AskRevision) => RevisionPreview;
  /** Over the form: makes a further object type from this one, saved at once. */
  Derive?: ComponentType<ProjectObjectDeriveProps>;
  /** How the model's tables and the item's detail name what it is drawn from. */
  describe: (t: TFunction, item: DraftObjectType) => ProjectObjectSourceDescription;
  /** A property's cell in the item's detail, in place of the mapped column. */
  Property: ComponentType<{ property: DraftProperty }>;
};

export type ProjectObjectDeriveProps = {
  projectId: string;
  draft: Draft;
  item: DraftObjectType;
  /** Something is not saved or is running: deriving waits. */
  disabled: boolean;
  /** The draft with the derived object type in it. */
  onDerived: (draft: Draft) => void;
};

export type ProjectObjectSourceDescription = {
  /** The model's source column, in place of the table. */
  source: string;
  /** Said in the identity column in place of the primary keys, when they are not the business's. */
  identity?: string;
  /** Title of the detail's property column, in place of the mapped column. */
  propertyColumn: string;
};

/** A relation being made has no item yet: the editor gets null. */
export type ProjectRelationSourceEditor = ProjectSourceEditor<
  DraftRelationType,
  DraftRelationTypeSave,
  DraftRelationType | null
> & {
  /** Making a relation of this kind from the relation panel, by a switch over the mapping. */
  newItem: {
    /** Translation key of the switch's label. */
    labelKey: string;
    /** Whether the draft has what such a relation joins. */
    offered: (draft: Draft) => boolean;
    /** What the relation starts from, with the name and description typed so far. */
    start: (basic: { description: string; name: string }) => DraftRelationTypeSave;
  };
};

export type KnowledgeNetworkResourcePanelProps = {
  networkId: string;
  canModify: boolean;
};

export type ProjectRelationBasisProps = {
  projectId: string;
  relation: DraftRelationType;
};

export type ProjectRequirementDocumentPickerProps = ProjectSlotProps & {
  /** Documents were added: the list reads them again. */
  onPicked: () => void;
};

export type ProjectOverviewKnowledgeBaseProps = {
  projectId: string;
};

/** The installed knowledge-base extension's component for one project slot, if it has one. */
function projectSlot<K extends keyof StudioExtension>(key: K): StudioExtension[K] | undefined {
  return installed.find(
    (extension) => extension.capability === "knowledge_base" && extension[key],
  )?.[key];
}

export const extensionProjectTermLibrary = () => projectSlot("projectTermLibrary");
export const extensionProjectConceptSource = () => projectSlot("projectConceptSource");
export const extensionProjectObjectSourceEditor = () => projectSlot("projectObjectSourceEditor");
export const extensionProjectRelationSourceEditor = () =>
  projectSlot("projectRelationSourceEditor");
export const extensionKnowledgeNetworkResourcePanel = () =>
  projectSlot("knowledgeNetworkResourcePanel");
export const extensionProjectRelationBasis = () => projectSlot("projectRelationBasis");
export const extensionProjectRequirementDocumentPicker = () =>
  projectSlot("projectRequirementDocumentPicker");
export const extensionProjectOverviewKnowledgeBase = () =>
  projectSlot("projectOverviewKnowledgeBase");

export type ProjectKnowledgeBaseBuildProps = {
  projectId: string;
  /**
   * Kept for extensions built against the two pages these were on: the build page passes
   * "instances", which also offers the instances' preview.
   */
  section: "instances" | "builds";
  /** The lineage the project publishes to, whose knowledge-base data the tab also refreshes. */
  lineageId: string;
  canEdit: boolean;
  canManageBuilds: boolean;
};
export function extensionProjectKnowledgeBaseBuilds() {
  return installed.find((e) => e.capability === "knowledge_base" && e.projectKnowledgeBaseBuilds)
    ?.projectKnowledgeBaseBuilds;
}

export type ProjectKnowledgeBaseModelProps = {
  projectId: string;
  draftUpdateTime: number;
  canEdit: boolean;
  onChanged: () => void;
};
export function extensionProjectKnowledgeBaseModel() {
  return installed.find((e) => e.capability === "knowledge_base" && e.projectKnowledgeBaseModel)
    ?.projectKnowledgeBaseModel;
}

export type ProjectKnowledgeBaseResourceProps = {
  projectId: string;
  /** Owner of an open project: may lock sources and change samples. */
  canEdit: boolean;
  /** Owner, including archived projects: may finish retention cleanup. */
  canManageHolds: boolean;
  /** What the page's tab says of the panel: reported once read, and whenever it changes. */
  onStatusChange?: (status: ProjectKnowledgeBaseResourceStatus) => void;
};

export type ProjectKnowledgeBaseResourceStatus = {
  /** The files in scope; null before any are chosen or while they cannot be read. */
  fileCount: number | null;
  /** Something waits for the person, such as source changes or a selection not saved. */
  needsAttention: boolean;
};

export function extensionProjectKnowledgeBaseResources() {
  return installed.find(
    (extension) =>
      extension.capability === "knowledge_base" && extension.projectKnowledgeBaseResources,
  )?.projectKnowledgeBaseResources;
}

/**
 * A button that opens one of the extension's pages for the network on screen, in a new tab.
 * It is shown whatever the licence says: the page it opens is behind the extension's
 * capability guard, which is where a licence that falls short gets the upgrade page.
 */
export type WorkspaceAction = {
  /** Unique within the extension. */
  id: string;
  icon?: ReactNode;
  /** Translation key of the button label. */
  labelKey: string;
  /** Path inside the app, without the basename, for the given network. */
  path: (networkId: string) => string;
};

/**
 * A sidebar entry that opens one of the extension's pages for the network on screen, in place.
 * Such a page stands on its own, without the workspace sidebar, so the entry hands it the
 * workspace page in location state (`returnTo`, see back-navigation.ts) for its back button. Like
 * a workspace action, it is shown whatever the licence says and the page carries the guard.
 */
export type WorkspaceNavEntry = {
  /** Unique within the extension. */
  id: string;
  icon?: ReactNode;
  /** Translation key of the entry label. */
  labelKey: string;
  /** Path inside the app, without the basename, for the given network. */
  path: (networkId: string) => string;
  /**
   * The sidebar group it is listed in: ability verification (the default), or analysis, a group
   * after ability verification that the sidebar shows only while some entry is listed there.
   */
  section?: WorkspaceNavSection;
};

export type WorkspaceNavSection = "verification" | "analysis";

/**
 * A button on the graph overview that opens one of the extension's pages, in a new tab, with the
 * instances selected there. The overview has room for one: it shows the first one registered. Like a workspace action it is shown whatever the licence says: the
 * page it opens carries the capability guard.
 */
export type InstanceHandOver = {
  /** Unique within the extension. */
  id: string;
  icon?: ReactNode;
  /** Translation key of the button label; it receives `count`, the instances handed over. */
  labelKey: string;
  /**
   * Instances the page takes at most; a larger selection disables the button. A function is read
   * whenever the selection changes, for a limit people set themselves on that page.
   */
  maxInstances: number | (() => number);
  /**
   * Translation key of a sentence added to the "too many" tip, saying how to take more (where the
   * limit is set); it receives `limit`.
   */
  limitHintKey?: string;
  /** Path inside the app, without the basename, for the given network. */
  path: (networkId: string) => string;
  /**
   * The URL to open, from the page's absolute URL and the instance ids (`<object type>-<key>`,
   * see lib/instance-label.ts). `objectTypeIds` lists the network's object types, for a page
   * that packs ids by type.
   */
  url: (pageUrl: string, instanceIds: string[], objectTypeIds: string[]) => string;
};

/** The most instances a hand-over takes right now. */
export function handOverLimit(handOver: InstanceHandOver): number {
  return typeof handOver.maxInstances === "function"
    ? handOver.maxInstances()
    : handOver.maxInstances;
}

const installed: StudioExtension[] = [];
let frozen = false;

export function registerExtension(extension: StudioExtension) {
  if (frozen) {
    throw new Error(
      `Extension "${extension.id}" was registered after the app mounted; register it from @/app/extensions/installed.`,
    );
  }
  if (installed.some((item) => item.id === extension.id)) {
    throw new Error(`Extension "${extension.id}" is registered twice.`);
  }
  for (const route of [...(extension.routes ?? []), ...(extension.standaloneRoutes ?? [])]) {
    // The gate wraps route.element; a route rendered through lazy or Component would slip past it.
    if (route.element === undefined) {
      throw new Error(
        `Extension "${extension.id}" has a route without an element (${route.path ?? "index"}).`,
      );
    }
  }
  installed.push(extension);
  addExtensionLocales(extension.locales);
}

/**
 * Called by the bootstrap as the app mounts. The router is built once from what is installed
 * by then, so a later registration throws instead of leaving a route silently missing.
 */
export function freezeExtensions() {
  frozen = true;
}

/** Whether an installed extension implements this capability, i.e. this build has its pages. */
export function isExtensionInstalled(capability: string): boolean {
  return installed.some((extension) => extension.capability === capability);
}

export function extensionRoutes(): RouteObject[] {
  return installed.flatMap((extension) => gated(extension, extension.routes));
}

export function extensionStandaloneRoutes(): RouteObject[] {
  return installed.flatMap((extension) => gated(extension, extension.standaloneRoutes));
}

export function extensionWorkspaceActions(): (WorkspaceAction & { key: string })[] {
  return installed.flatMap((extension) =>
    (extension.workspaceActions ?? []).map((action) => ({
      ...action,
      key: `${extension.id}:${action.id}`,
    })),
  );
}

/** The workspace sidebar entries extensions registered, or those of one group when named. */
export function extensionWorkspaceNavItems(
  section?: WorkspaceNavSection,
): (WorkspaceNavEntry & { key: string })[] {
  return installed.flatMap((extension) =>
    (extension.workspaceNavItems ?? [])
      .filter((item) => !section || (item.section ?? "verification") === section)
      .map((item) => ({
        ...item,
        key: `${extension.id}:${item.id}`,
      })),
  );
}

export function extensionInstanceHandOvers(): (InstanceHandOver & { key: string })[] {
  return installed.flatMap((extension) =>
    (extension.instanceHandOvers ?? []).map((handOver) => ({
      ...handOver,
      key: `${extension.id}:${handOver.id}`,
    })),
  );
}

/**
 * A capability the edition catalog knows gets the full upgrade page when the licence does not
 * cover it: what the capability is, the edition it needs, and the way to the licence portal and
 * the edition comparison. The page itself stays unmounted, so it sends nothing while locked. A
 * capability the catalog does not know has no copy for that page and falls back to the plain
 * guard.
 */
function gated(extension: StudioExtension, routes: RouteObject[] = []): RouteObject[] {
  const { capability } = extension;
  const minEdition = capabilityMinEdition(capability);

  return routes.map((route) => ({
    ...route,
    element: minEdition
      ? createElement(RequireEdition, {
          capability,
          children: route.element,
          minEdition,
          mountLockedContent: false,
        })
      : createElement(RequireCapability, { capability, children: route.element }),
  }));
}

/**
 * Merges copy into the running translation resources without overriding existing keys. Also
 * used by pages an extending build serves outside this shell, which share the resources.
 */
export function addExtensionLocales(locales: StudioExtension["locales"]) {
  for (const [locale, resources] of Object.entries(locales ?? {})) {
    i18n.addResourceBundle(locale, "translation", resources, true, false);
  }
}

/** Tests only: forget every registration and reopen the registry. */
export function resetExtensionsForTesting() {
  installed.length = 0;
  frozen = false;
}
