/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined } from "@ant-design/icons";
import { Alert, Segmented, Space, Spin } from "antd";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { ExistingDefinitions } from "@/modules/bkn-project/components/model/ExistingDefinitions";
import { requestFailureText } from "@/modules/bkn-project/components/publish/messages";
import { DraftConceptGraph } from "@/modules/bkn-project/components/draft/DraftConceptGraph";
import { DraftChangesPanel } from "@/modules/bkn-project/components/draft/DraftChangesPanel";
import { DraftItemDialog } from "@/modules/bkn-project/components/draft/DraftItemDialog";
import { IdentityDialog } from "@/modules/bkn-project/components/draft/IdentityDialog";
import { DraftObjectDrawer } from "@/modules/bkn-project/components/draft/DraftObjectDrawer";
import { ObjectTypePanel } from "@/modules/bkn-project/components/object-type/ObjectTypePanel";
import { RelationTypePanel } from "@/modules/bkn-project/components/relation-type/RelationTypePanel";
import { ConfirmDraft } from "@/modules/bkn-project/components/model/ConfirmDraftDialog";
import { UnderstandingBar } from "@/modules/bkn-project/components/model/UnderstandingBar";
import { SourceChangesNotice } from "@/modules/bkn-project/components/model/SourceChanges";
import {
  adoptBlocker,
  draftErrorCode,
  type EditableItem,
  restoredProperty,
  unadoptedWith,
} from "@/modules/bkn-project/components/draft/edit";
import {
  type DraftItemActions,
  DraftExcludedPanel,
  DraftObjectsTable,
  DraftRelationsTable,
  DraftValueTypesTable,
} from "@/modules/bkn-project/components/draft/DraftTables";
import { RelationSuggestionsEntry } from "@/modules/bkn-project/components/draft/RelationSuggestionsDrawer";
import {
  catalogNamesOf,
  missingCatalogs,
  relationsWithUnadoptedEnds,
} from "@/modules/bkn-project/components/draft/evidence";
import {
  chooseIdentity,
  DRAFT_POLL_MS,
  editDraftItem,
  generateDraft,
  getDraft,
  restoreField,
} from "@/modules/bkn-project/services/draft.service";
import type {
  RelationSuggestion,
  Draft,
  DraftExcludedField,
  DraftItemEdit,
  DraftItemKind,
  DraftObjectType,
} from "@/modules/bkn-project/types/draft";
import { listText } from "@/modules/bkn-project/components/publish/messages";
import { getProjectPending } from "@/modules/bkn-project/services/publish.service";
import type { Project } from "@/modules/bkn-project/types/project";
import type { PendingItem, PendingQuestion } from "@/modules/bkn-project/types/publish";
import { useAccountDirectory } from "@/modules/knowledge-network/hooks/useAccountDirectory";
import type { ResourceTab } from "@/modules/bkn-project/types/workspace";
import { catalogListAllQuery, listCatalogs } from "@/shared/catalog";

import styles from "./ProjectModel.module.css";
import { extensionProjectKnowledgeBaseModel } from "@/framework/extension/registry";
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";

const TABS = ["changes", "excluded", "objects", "relations", "valueTypes"] as const;
type Tab = (typeof TABS)[number];
const isTab = (value: string | null | undefined): value is Tab =>
  (TABS as readonly string[]).includes(value ?? "");

/** How sending an edit ended: the dialog closes unless it failed for another reason. */
type EditOutcome = "done" | "failed" | "stale";

/** Catalogs the caller can see, by id; null when they could not be listed. */
type Catalogs = Map<string, string> | null;

const STATUS_TONE = { drafting: "info", failed: "error", ready: "neutral" } as const;

function failureKey(error: string) {
  if (error === "interrupted" || error === "timeout") {
    return `bknProject.model.failed.${error}`;
  }
  return "bknProject.model.failed.source";
}

/**
 * The ontology modeling page: the project's draft, read-only. Every rule lives in
 * bkn-project; the page shows what it answers and the evidence behind each item.
 */
export function ProjectModel({
  focus,
  initialObject,
  initialTab,
  onConfirmed,
  onGoToResources,
  onViewConfirmation,
  ownerIsCaller,
  project,
}: {
  /** What a link asked to show on its tab, such as the update field an object type waits for. */
  focus?: string | null;
  /** The object type a link asked to edit, opened in the panel on a ready draft. */
  initialObject?: string | null;
  /** The tab a link asked for, such as the overview's "View all" changes; others are ignored. */
  initialTab?: string | null;
  /** Called once the draft is confirmed, to show what follows. */
  onConfirmed: () => void;
  /** Shows what an earlier confirmation started, on the release page. */
  onViewConfirmation: () => void;
  /** Opens the requirements and resources page, where the project's catalogs are chosen. */
  onGoToResources: (tab?: ResourceTab) => void;
  /** Only the owner may replace the project's catalogs; others are asked to contact them. */
  ownerIsCaller: boolean;
  project: Project;
}) {
  const { t } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const directory = useAccountDirectory();
  const KnowledgeBaseModel = extensionProjectKnowledgeBaseModel();
  const kbMode = useBknProjectKbMode();
  // undefined while loading, null before the first draft.
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<Catalogs>(null);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : "objects");
  const [openId, setOpenId] = useState<string | null>(null);
  // The object type open in the editing panel over the page.
  const [panelId, setPanelId] = useState<string | null>(initialObject ?? null);
  // The relation type open in its panel: null makes a new one.
  const [relationPanel, setRelationPanel] = useState<{
    id: string | null;
    /** A suggestion a new relation type starts from. */
    prefill?: RelationSuggestion;
  } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // A link's object type is open until the panel closes: the link then no longer opens it again.
  const closePanel = () => {
    setPanelId(null);
    if (searchParams.has("object")) {
      const next = new URLSearchParams(searchParams);
      next.delete("object");
      setSearchParams(next, { replace: true });
    }
  };
  const [editing, setEditing] = useState<{ item: EditableItem; kind: DraftItemKind } | null>(null);
  const [saving, setSaving] = useState(false);
  const [choosingIdentity, setChoosingIdentity] = useState<DraftObjectType | null>(null);
  const [neededBy, setNeededBy] = useState<ReadonlyMap<string, PendingQuestion[]>>(new Map());
  // Adopted object types that could refresh their local index by an update field, and have none.
  const [updateFields, setUpdateFields] = useState<PendingItem[]>([]);

  // Counts every read, failed or not, so a drafting draft is read again after a failure too.
  const [reads, setReads] = useState(0);

  const loadDraft = useCallback(async () => {
    try {
      setDraft(await getDraft(project.id));
      setLoadError(null);
    } catch (error) {
      setLoadError(requestFailureText(t, error));
    } finally {
      setReads((count) => count + 1);
    }
  }, [project.id, t]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  // Without the list, catalogs show by id, nothing is reported missing and they cannot be
  // changed; the owner is told and may try again.
  const [catalogsFailed, setCatalogsFailed] = useState(false);
  const [catalogReads, setCatalogReads] = useState(0);
  useEffect(() => {
    let active = true;
    listCatalogs(catalogListAllQuery({ pageSize: 500 }), { skipErrorToast: true })
      .then((result) => {
        if (active) {
          setCatalogs(new Map(result.items.map(({ id, name }) => [id, name])));
          setCatalogsFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setCatalogsFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [catalogReads]);

  // Which scenario questions need what waits: read with each version of a ready draft. It only
  // adds to what the draft shows, so a failed read shows nothing more.
  const readyAt = draft?.status === "ready" ? draft.updateTime : null;
  useEffect(() => {
    if (readyAt === null) {
      setNeededBy(new Map());
      setUpdateFields([]);
      return undefined;
    }
    let active = true;
    getProjectPending(project.id)
      .then((pending) => {
        if (active) {
          setNeededBy(
            new Map(pending.items.map((item) => [`${item.kind}/${item.itemId}`, item.neededBy])),
          );
          setUpdateFields(pending.items.filter((item) => item.reason === "needs_update_field"));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id, readyAt]);

  // A draft that is drafting is read again until it is done; leaving the page stops it.
  const drafting = draft?.status === "drafting";
  // Catalogs being added are drafted in the background too, while the draft stays editable.
  const followed =
    drafting ||
    confirming ||
    Boolean(draft?.items.adding) ||
    draft?.datasetPreparation?.state === "preparing";
  useEffect(() => {
    if (!followed) {
      return undefined;
    }
    const timer = window.setTimeout(() => void loadDraft(), DRAFT_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [followed, loadDraft, reads]);

  const generate = async (discardDecisions: boolean) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      setDraft(
        await (discardDecisions
          ? generateDraft(project.id, { discardDecisions })
          : generateDraft(project.id)),
      );
    } catch (error) {
      if (!discardDecisions && draftErrorCode(error) === "HasDecisions") {
        // Someone decided something since the draft was read: show it, then ask.
        const fresh = await getDraft(project.id).catch(() => null);
        if (fresh) {
          setDraft(fresh);
        }
        // Without the reloaded draft the count is unknown; the page never guesses one.
        confirmRegenerate(fresh ? fresh.items.decisions.length : null);
      } else {
        setGenerateError(requestFailureText(t, error));
      }
    } finally {
      setGenerating(false);
    }
  };

  function confirmRegenerate(count: number | null) {
    void modal.confirm({
      cancelText: t("common.cancel"),
      content:
        count === null
          ? t("bknProject.model.regenerateConfirm.contentUncounted")
          : t("bknProject.model.regenerateConfirm.content", { count }),
      okButtonProps: { danger: true },
      okText: t("bknProject.model.regenerateConfirm.ok"),
      onOk: () => generate(true),
      title: t("bknProject.model.regenerateConfirm.title"),
    });
  }

  // Drafting again over decisions discards them, so it asks first.
  const startGenerate = () => {
    const count = draft?.items.decisions.length ?? 0;
    if (count) {
      confirmRegenerate(count);
    } else {
      void generate(false);
    }
  };

  /**
   * Sends one change made on the draft as read, and shows the draft bkn-project replies. A draft
   * someone else changed is reloaded and the change is not replayed: it was made on what they
   * changed. `refused` handles a refusal the caller can explain better than bkn-project's text.
   */
  const send = async (
    request: (updateTime: number) => Promise<Draft>,
    done?: (before: Draft, next: Draft) => void,
    refused?: (code: string | undefined) => string | null,
  ): Promise<EditOutcome> => {
    if (!draft) {
      return "failed";
    }
    setSaving(true);
    try {
      const next = await request(draft.updateTime);
      setDraft(next);
      done?.(draft, next);
      return "done";
    } catch (error) {
      const code = draftErrorCode(error);
      const explained = code === "Stale" ? t("bknProject.model.edit.stale") : refused?.(code);
      if (explained) {
        message.warning(explained);
        await loadDraft();
        return "stale";
      }
      message.error(requestFailureText(t, error));
      return "failed";
    } finally {
      setSaving(false);
    }
  };

  const sendEdit = (kind: DraftItemKind, itemId: string, edit: DraftItemEdit) =>
    send(
      (updateTime) => editDraftItem(project.id, kind, itemId, updateTime, edit),
      (before, next) => {
        const cascaded =
          kind === "object_types" && edit.adopted === false ? unadoptedWith(before, next) : [];
        if (cascaded.length) {
          message.info(t("bknProject.model.edit.cascade", { count: cascaded.length }));
        }
      },
    );

  const sendIdentity = (objectType: DraftObjectType, properties: string[]) =>
    send(
      (updateTime) => chooseIdentity(project.id, objectType.id, updateTime, properties),
      (_before, next) => {
        const after = next.items.objectTypes.find((item) => item.id === objectType.id);
        // Choosing does not adopt: say what is left to do when there is something.
        message.success(
          t(
            after && !after.adopted
              ? "bknProject.model.identity.savedAdopt"
              : "bknProject.model.identity.saved",
            { name: objectType.name },
          ),
        );
      },
    );

  const restore = (field: DraftExcludedField, objectName: string) => {
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(
        field.keyword
          ? "bknProject.model.restore.confirm"
          : "bknProject.model.restore.confirmNoKeyword",
        { field: field.field, keyword: field.keyword, objectType: objectName },
      ),
      okText: t("bknProject.model.restore.label"),
      onOk: () =>
        send(
          (updateTime) => restoreField(project.id, updateTime, field.objectType, field.field),
          (_before, next) => {
            // Name the property only as bkn-project replied it; it may carry a suffix.
            const property = restoredProperty(next, field.objectType, field.field);
            message.success(
              property
                ? t("bknProject.model.restore.saved", {
                    objectType: objectName,
                    property: property.name,
                  })
                : t("bknProject.model.restore.savedNoName", { objectType: objectName }),
            );
          },
          // Restored by someone else meanwhile: say so plainly and show the draft as it is.
          (code) => (code === "ItemNotFound" ? t("bknProject.model.restore.already") : null),
        ),
      title: t("bknProject.model.restore.title"),
    });
  };

  const catalogNames = useMemo(() => Object.fromEntries(catalogs ?? []), [catalogs]);
  const missing = useMemo(
    () =>
      catalogs ? missingCatalogs(project.catalogIds, draft ?? null, new Set(catalogs.keys())) : [],
    [catalogs, draft, project.catalogIds],
  );
  // The project's own catalogs that are gone are fixed by changing them; catalogs only the draft
  // still reads are fixed by drafting again, so the two notices offer different actions.
  const projectMissing = missing.filter((id) => project.catalogIds.includes(id));
  const draftMissing = missing.filter((id) => !project.catalogIds.includes(id));
  // Catalogs by name; those without a known name, as gone ones are, are said without one.
  const catalogNotice = (key: string, ids: string[]) => {
    const names = catalogNamesOf(ids, catalogNames);
    return names
      ? t(key, { names: listText(t, names) })
      : t(`${key}Unnamed`, { count: ids.length });
  };
  const unadoptedEnds = useMemo(
    () => (draft?.status === "ready" ? relationsWithUnadoptedEnds(draft) : []),
    [draft],
  );

  if (loadError && draft === undefined) {
    return (
      <Alert
        action={
          <AppButton onClick={() => void loadDraft()} size="small">
            {t("common.retry")}
          </AppButton>
        }
        description={loadError}
        message={t("bknProject.model.loadFailed")}
        showIcon
        type="error"
      />
    );
  }
  if (draft === undefined) {
    return (
      <div className={styles.center}>
        <Spin />
      </div>
    );
  }

  const noCatalogs = project.catalogIds.length === 0;
  // The catalogs are chosen, added and changed on the requirements and resources page: the owner
  // is led there, as nobody else may change them. No change on an archived project.
  const catalogsLink = (label: string, primary = false) =>
    ownerIsCaller && !project.archived ? (
      <AppButton onClick={() => onGoToResources("catalogs")} type={primary ? "primary" : "default"}>
        {t(label)}
      </AppButton>
    ) : null;
  const generateButton = (
    <AppButton
      disabled={drafting || noCatalogs || project.archived}
      loading={generating}
      onClick={startGenerate}
      type={draft && draft.status === "ready" ? "default" : "primary"}
    >
      {t(draft ? "bknProject.model.regenerate" : "bknProject.model.generate")}
    </AppButton>
  );

  // Semantic understanding names the catalogs' tables for drafting, so it shows before a draft too.
  const understanding = noCatalogs ? null : (
    <UnderstandingBar
      archived={project.archived}
      catalogNames={catalogNames}
      hasDraft={draft !== null}
      namingLanguage={project.namingLanguage}
      onRedraft={startGenerate}
      ownerIsCaller={ownerIsCaller}
      projectId={project.id}
      redraftDisabled={drafting || generating}
    />
  );

  const preparation = draft?.datasetPreparation;
  const notices = (
    <>
      {preparation && (
        <Alert
          message={t(`bknProject.model.preparation.${preparation.state}`, {
            ready: preparation.ready,
            total: preparation.total,
          })}
          showIcon
          type={
            preparation.state === "failed" || preparation.state === "stale" ? "warning" : "info"
          }
        />
      )}
      {ownerIsCaller && catalogsFailed ? (
        <Alert
          action={
            <AppButton onClick={() => setCatalogReads((count) => count + 1)} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={t("bknProject.model.catalogs.loadFailed")}
          showIcon
          type="warning"
        />
      ) : null}
      {loadError ? (
        <Alert
          description={loadError}
          message={t("bknProject.model.loadFailed")}
          showIcon
          type="warning"
        />
      ) : null}
      {generateError ? (
        <Alert
          closable
          description={generateError}
          message={t("bknProject.model.generateFailed")}
          onClose={() => setGenerateError(null)}
          showIcon
          type="error"
        />
      ) : null}
      {projectMissing.length ? (
        <Alert
          action={catalogsLink("bknProject.model.catalogs.change")}
          description={ownerIsCaller ? undefined : t("bknProject.model.notice.askOwner")}
          message={catalogNotice("bknProject.model.notice.missingCatalogs", projectMissing)}
          showIcon
          type="error"
        />
      ) : null}
      {draftMissing.length ? (
        <Alert
          message={catalogNotice("bknProject.model.notice.draftReadsMissing", draftMissing)}
          showIcon
          type="warning"
        />
      ) : null}
      {draft?.status === "ready" ? (
        <SourceChangesNotice
          archived={project.archived}
          draftUpdateTime={draft.updateTime}
          onDrafted={(next) => {
            setDraft(next);
            setTab("changes");
          }}
          projectId={project.id}
        />
      ) : null}
      {unadoptedEnds.length ? (
        <Alert
          message={t("bknProject.model.notice.unadoptedEnds", { count: unadoptedEnds.length })}
          showIcon
          type="error"
        />
      ) : null}
    </>
  );

  if (draft === null) {
    return (
      <div className={styles.page}>
        {notices}
        {understanding}
        <ExistingDefinitions networkId={project.knId} projectId={project.id} />
        <EmptyStatePanel
          action={
            noCatalogs ? (
              catalogsLink("bknProject.model.catalogs.choose", true)
            ) : (
              <Space>
                {generateButton}
                {catalogsLink("bknProject.model.catalogs.manage")}
              </Space>
            )
          }
          description={t(
            noCatalogs && KnowledgeBaseModel && kbMode === "enabled" && ownerIsCaller
              ? "bknProject.model.empty.knowledgeBaseSources"
              : noCatalogs
                ? ownerIsCaller
                  ? "bknProject.model.empty.noCatalogs"
                  : "bknProject.model.empty.noCatalogsAskOwner"
                : "bknProject.model.empty.description",
          )}
          title={t("bknProject.model.empty.title")}
        />
      </div>
    );
  }

  const { items } = draft;
  const objectNames = Object.fromEntries(items.objectTypes.map((item) => [item.id, item.name]));
  const actions: DraftItemActions = {
    adoptBlocker: (kind, item) => adoptBlocker(draft, kind, item),
    // bkn-project refuses edits on an archived project.
    archived: project.archived,
    busy: saving,
    onAdopt: (kind, item, adopted) => void sendEdit(kind, item.id, { adopted }),
    onChooseIdentity: setChoosingIdentity,
    onEdit: (kind, item) => setEditing({ item, kind }),
    onRestore: (field) => restore(field, objectNames[field.objectType] ?? field.objectType),
    networkId: project.knId,
  };
  // What the network already has is in the draft beside what drafting adds, read only.
  const existingObjects = items.objectTypes.filter((item) => item.existing).length;
  const existingRelations = items.relationTypes.filter((item) => item.existing).length;
  const holdsExisting = existingObjects + existingRelations > 0;
  const existingObjectIds = new Set(
    items.objectTypes.filter((item) => item.existing).map((item) => item.id),
  );
  const existingRelationIds = new Set(
    items.relationTypes.filter((item) => item.existing).map((item) => item.id),
  );
  // A ready draft of a project in use opens an object type in the editor; otherwise its details.
  const editable = draft.status === "ready" && !project.archived;
  const openEditor = (id: string) => {
    // What the network already has opens read only: it is edited in the knowledge network.
    if (existingObjectIds.has(id)) {
      setOpenId(id);
      return;
    }
    setOpenId(null);
    setRelationPanel(null);
    setPanelId(id);
  };
  // A link may ask to edit what the network already has: it is shown read only instead.
  const existingPanel = panelId !== null && existingObjectIds.has(panelId);
  const shownId = openId ?? (existingPanel ? panelId : null);
  const openRelation = (id: string | null) => {
    if (id && existingRelationIds.has(id)) {
      return;
    }
    closePanel();
    setRelationPanel({ id });
  };
  // The panel's own read of the draft after it moved: the page shows it too.
  const readDraftAgain = async () => {
    try {
      const next = await getDraft(project.id);
      setDraft(next);
      return next;
    } catch (error) {
      message.error(requestFailureText(t, error));
      return null;
    }
  };
  const pending =
    items.objectTypes.filter((item) => item.needsIdentity).length + unadoptedEnds.length;
  const leftOut = items.excluded.length + items.unreadable.length;
  const tabs: { label: ReactNode; value: Tab }[] = [
    {
      label: t("bknProject.model.tabs.objects", { count: items.objectTypes.length }),
      value: "objects",
    },
    {
      label: t("bknProject.model.tabs.relations", { count: items.relationTypes.length }),
      value: "relations",
    },
    ...(items.valueTypes.length
      ? [
          {
            label: t("bknProject.model.tabs.valueTypes", { count: items.valueTypes.length }),
            value: "valueTypes" as const,
          },
        ]
      : []),
    ...(leftOut
      ? [
          {
            label: t("bknProject.model.tabs.excluded", { count: leftOut }),
            value: "excluded" as const,
          },
        ]
      : []),
    {
      // The tab lists what waits before the decisions, so it counts both, as the header does.
      label: (
        <span>
          {t("bknProject.model.tabs.changes", { count: items.decisions.length })}
          {pending ? (
            <span className={styles.tabPending}>
              {t("bknProject.model.pending", { count: pending })}
            </span>
          ) : null}
        </span>
      ),
      value: "changes",
    },
  ];
  const activeTab = tabs.some((item) => item.value === tab) ? tab : "objects";

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <LightStatusTag tone={STATUS_TONE[draft.status] ?? "neutral"}>
          {t(`bknProject.model.status.${draft.status}`)}
        </LightStatusTag>
        <span className={styles.summary}>
          {draft.status === "ready"
            ? holdsExisting
              ? t("bknProject.model.summaryWithExisting", {
                  newObjects: t("bknProject.model.countObjects", {
                    count: items.objectTypes.length - existingObjects,
                  }),
                  newRelations: t("bknProject.model.countRelations", {
                    count: items.relationTypes.length - existingRelations,
                  }),
                  objects: t("bknProject.model.countObjects", { count: existingObjects }),
                  relations: t("bknProject.model.countRelations", { count: existingRelations }),
                })
              : t("bknProject.model.summary", {
                  objects: items.objectTypes.length,
                  relations: items.relationTypes.length,
                })
            : null}
          {draft.status === "ready" && pending ? (
            // Leads to the list of what waits, each with the action that settles it.
            <AppButton className={styles.pending} onClick={() => setTab("changes")} type="link">
              {t("bknProject.model.pending", { count: pending })}
            </AppButton>
          ) : null}
        </span>
        <span className={styles.spacer} />
        {projectMissing.length ? null : catalogsLink("bknProject.model.catalogs.manage")}
        {generateButton}
        {draft.status === "ready" && !project.archived ? (
          <ConfirmDraft
            draft={draft}
            onConfirmed={onConfirmed}
            onViewConfirmation={onViewConfirmation}
            onSendingChange={setConfirming}
            onShowPending={() => setTab("changes")}
            onStale={() => void loadDraft()}
            projectId={project.id}
          />
        ) : null}
      </div>
      {notices}
      {draft.items.adding ? (
        <Alert
          message={t("bknProject.model.catalogs.adding", {
            count: draft.items.adding.catalogIds.length,
          })}
          showIcon
          type="info"
        />
      ) : null}
      {understanding}
      {holdsExisting ? (
        draft.items.existingTables?.length ? (
          <span className={styles.existingHint}>
            {t("bknProject.model.existing.skippedHint", {
              count: draft.items.existingTables.length,
            })}
          </span>
        ) : null
      ) : (
        // A draft made before it held what the network has shows it beside the draft.
        <ExistingDefinitions
          networkId={project.knId}
          projectId={project.id}
          skippedTables={draft.items.existingTables}
        />
      )}
      {draft.status === "drafting" ? (
        <EmptyStatePanel
          description={t("bknProject.model.drafting.description")}
          title={t("bknProject.model.drafting.title")}
        />
      ) : draft.status === "failed" ? (
        <Alert
          description={
            <>
              {t(failureKey(draft.error))}
              {failureKey(draft.error).endsWith("source") && draft.error ? (
                <details className={styles.details}>
                  <summary>{t("bknProject.model.failed.details")}</summary>
                  {draft.error}
                </details>
              ) : null}
            </>
          }
          message={t("bknProject.model.failed.title")}
          showIcon
          type="error"
        />
      ) : (
        <>
          <DraftConceptGraph
            draft={draft}
            networkId={project.knId}
            onOpen={editable ? openEditor : setOpenId}
            onOpenRelation={editable ? openRelation : undefined}
            title={t("bknProject.model.graph.title")}
          />
          <Segmented<Tab> onChange={setTab} options={tabs} value={activeTab} />
          {activeTab === "objects" ? (
            <DraftObjectsTable
              actions={actions}
              catalogNames={catalogNames}
              items={items.objectTypes}
              onOpen={editable ? openEditor : setOpenId}
            />
          ) : activeTab === "relations" ? (
            <>
              {draft.status === "ready" ? (
                <div className={styles.tabActions}>
                  <RelationSuggestionsEntry
                    draft={draft}
                    editable={editable}
                    onAdopt={async (relationTypeId) => {
                      await sendEdit("relation_types", relationTypeId, { adopted: true });
                    }}
                    onCreate={(suggestion) => {
                      closePanel();
                      setRelationPanel({ id: null, prefill: suggestion });
                    }}
                    projectId={project.id}
                  />
                  {editable ? (
                    <AppButton icon={<PlusOutlined />} onClick={() => openRelation(null)}>
                      {t("bknProject.relationEditor.add")}
                    </AppButton>
                  ) : null}
                </div>
              ) : null}
              <DraftRelationsTable
                actions={actions}
                items={items.relationTypes}
                objectNames={objectNames}
                onOpen={editable ? openRelation : undefined}
                projectId={project.id}
                unadoptedEnds={new Set(unadoptedEnds.map((item) => item.id))}
              />
            </>
          ) : activeTab === "valueTypes" ? (
            <DraftValueTypesTable
              actions={actions}
              catalogNames={catalogNames}
              items={items.valueTypes}
            />
          ) : activeTab === "changes" ? (
            <DraftChangesPanel
              actions={actions}
              currentUserId={runtimeConfig.currentUser.id}
              directory={directory}
              draft={draft}
              focus={focus}
              neededBy={neededBy}
              onSetUpdateField={async (objectTypeId, property) =>
                (await sendEdit("object_types", objectTypeId, { incrementalKey: property })) !==
                "failed"
              }
              unadoptedEnds={unadoptedEnds}
              updateFields={updateFields}
            />
          ) : (
            <DraftExcludedPanel
              actions={actions}
              catalogNames={catalogNames}
              excluded={items.excluded}
              objectNames={objectNames}
              unreadable={items.unreadable}
            />
          )}
          <DraftObjectDrawer
            catalogNames={catalogNames}
            excluded={items.excluded}
            objectType={items.objectTypes.find((item) => item.id === shownId) ?? null}
            onClose={() => {
              setOpenId(null);
              // One a link asked to edit is shown read only; closing it drops the link.
              if (existingPanel) {
                closePanel();
              }
            }}
            onEdit={
              editable && !(shownId && existingObjectIds.has(shownId)) ? openEditor : undefined
            }
          />
          {relationPanel && editable ? (
            <RelationTypePanel
              draft={draft}
              // Another suggestion opened starts the editor over from it.
              key={`${relationPanel.id ?? "new"}/${relationPanel.prefill ? JSON.stringify([relationPanel.prefill.ends, relationPanel.prefill.name, relationPanel.prefill.origin]) : ""}`}
              onClose={() => setRelationPanel(null)}
              onReload={readDraftAgain}
              onSaved={setDraft}
              prefill={relationPanel.prefill}
              project={project}
              relationTypeId={relationPanel.id}
            />
          ) : null}
          {panelId && editable && !existingPanel ? (
            <ObjectTypePanel
              draft={draft}
              key={`${panelId}`}
              objectTypeId={panelId}
              onClose={closePanel}
              onReload={readDraftAgain}
              onSaved={setDraft}
              project={project}
            />
          ) : null}
          {choosingIdentity ? (
            <IdentityDialog
              objectType={choosingIdentity}
              onCancel={() => setChoosingIdentity(null)}
              onSave={async (properties) => {
                if ((await sendIdentity(choosingIdentity, properties)) !== "failed") {
                  setChoosingIdentity(null);
                }
              }}
            />
          ) : null}
          {editing ? (
            <DraftItemDialog
              item={editing.item}
              onCancel={() => setEditing(null)}
              onSave={async (edit) => {
                if ((await sendEdit(editing.kind, editing.item.id, edit)) !== "failed") {
                  setEditing(null);
                }
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
