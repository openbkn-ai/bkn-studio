/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Segmented, Spin } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { DraftItemDialog } from "@/modules/bkn-project/components/draft/DraftItemDialog";
import { DraftObjectDrawer } from "@/modules/bkn-project/components/draft/DraftObjectDrawer";
import {
  adoptBlocker,
  draftErrorCode,
  type EditableItem,
  unadoptedWith,
} from "@/modules/bkn-project/components/draft/edit";
import {
  type DraftItemActions,
  DraftExcludedPanel,
  DraftObjectsTable,
  DraftRelationsTable,
  DraftValueTypesTable,
} from "@/modules/bkn-project/components/draft/DraftTables";
import {
  missingCatalogs,
  relationsWithUnadoptedEnds,
} from "@/modules/bkn-project/components/draft/evidence";
import {
  editDraftItem,
  generateDraft,
  getDraft,
} from "@/modules/bkn-project/services/draft.service";
import type { Draft, DraftItemEdit, DraftItemKind } from "@/modules/bkn-project/types/draft";
import type { Project } from "@/modules/bkn-project/types/project";
import { catalogListAllQuery, listCatalogs } from "@/shared/catalog";

import styles from "./ProjectModel.module.css";

/** How often a draft that is drafting is read again. */
export const DRAFT_POLL_MS = 5000;

type Tab = "excluded" | "objects" | "relations" | "valueTypes";

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
export function ProjectModel({ project }: { project: Project }) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  // undefined while loading, null before the first draft.
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<Catalogs>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("objects");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ item: EditableItem; kind: DraftItemKind } | null>(null);
  const [saving, setSaving] = useState(false);

  // Counts every read, failed or not, so a drafting draft is read again after a failure too.
  const [reads, setReads] = useState(0);

  const loadDraft = useCallback(async () => {
    try {
      setDraft(await getDraft(project.id));
      setLoadError(null);
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setReads((count) => count + 1);
    }
  }, [project.id]);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    let active = true;
    listCatalogs(catalogListAllQuery({ pageSize: 500 }), { skipErrorToast: true })
      .then((result) => {
        if (active) {
          setCatalogs(new Map(result.items.map(({ id, name }) => [id, name])));
        }
      })
      // Without the list, catalogs show by id and nothing is reported missing.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // A draft that is drafting is read again until it is done; leaving the page stops it.
  const drafting = draft?.status === "drafting";
  useEffect(() => {
    if (!drafting) {
      return undefined;
    }
    const timer = window.setTimeout(() => void loadDraft(), DRAFT_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [drafting, loadDraft, reads]);

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
        setGenerateError(extractRequestErrorMessage(error));
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
   * Sends one edit made on the draft as read, and shows the draft bkn-project replies. A draft
   * someone else changed is reloaded and the edit is not replayed: it was made on what they
   * changed.
   */
  const sendEdit = async (
    kind: DraftItemKind,
    itemId: string,
    edit: DraftItemEdit,
  ): Promise<EditOutcome> => {
    if (!draft) {
      return "failed";
    }
    setSaving(true);
    try {
      const next = await editDraftItem(project.id, kind, itemId, draft.updateTime, edit);
      const cascaded =
        kind === "object_types" && edit.adopted === false ? unadoptedWith(draft, next) : [];
      setDraft(next);
      if (cascaded.length) {
        message.info(t("bknProject.model.edit.cascade", { count: cascaded.length }));
      }
      return "done";
    } catch (error) {
      if (draftErrorCode(error) === "Stale") {
        message.warning(t("bknProject.model.edit.stale"));
        await loadDraft();
        return "stale";
      }
      message.error(extractRequestErrorMessage(error));
      return "failed";
    } finally {
      setSaving(false);
    }
  };

  const catalogNames = useMemo(() => Object.fromEntries(catalogs ?? []), [catalogs]);
  const missing = useMemo(
    () =>
      catalogs ? missingCatalogs(project.catalogIds, draft ?? null, new Set(catalogs.keys())) : [],
    [catalogs, draft, project.catalogIds],
  );
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

  const notices = (
    <>
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
      {missing.length ? (
        <Alert
          message={t("bknProject.model.notice.missingCatalogs", {
            names: missing.map((id) => catalogNames[id] ?? id).join(", "),
          })}
          showIcon
          type="warning"
        />
      ) : null}
      {unadoptedEnds.length ? (
        <Alert
          message={t("bknProject.model.notice.unadoptedEnds", { count: unadoptedEnds.length })}
          showIcon
          type="warning"
        />
      ) : null}
    </>
  );

  if (draft === null) {
    return (
      <div className={styles.page}>
        {notices}
        <EmptyStatePanel
          action={generateButton}
          description={t(
            noCatalogs ? "bknProject.model.empty.noCatalogs" : "bknProject.model.empty.description",
          )}
          title={t("bknProject.model.empty.title")}
        />
      </div>
    );
  }

  const { items } = draft;
  const actions: DraftItemActions = {
    adoptBlocker: (kind, item) => adoptBlocker(draft, kind, item),
    // bkn-project refuses edits on an archived project.
    archived: project.archived,
    busy: saving,
    onAdopt: (kind, item, adopted) => void sendEdit(kind, item.id, { adopted }),
    onEdit: (kind, item) => setEditing({ item, kind }),
  };
  const pending =
    items.objectTypes.filter((item) => item.needsIdentity).length + unadoptedEnds.length;
  const objectNames = Object.fromEntries(items.objectTypes.map((item) => [item.id, item.name]));
  const leftOut = items.excluded.length + items.unreadable.length;
  const tabs: { label: string; value: Tab }[] = [
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
            ? t("bknProject.model.summary", {
                objects: items.objectTypes.length,
                relations: items.relationTypes.length,
              })
            : null}
          {draft.status === "ready" && pending ? (
            <strong className={styles.pending}>
              {t("bknProject.model.pending", { count: pending })}
            </strong>
          ) : null}
        </span>
        <span className={styles.spacer} />
        {generateButton}
      </div>
      {notices}
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
          <Segmented<Tab> onChange={setTab} options={tabs} value={activeTab} />
          {activeTab === "objects" ? (
            <DraftObjectsTable
              actions={actions}
              catalogNames={catalogNames}
              items={items.objectTypes}
              onOpen={setOpenId}
            />
          ) : activeTab === "relations" ? (
            <DraftRelationsTable
              actions={actions}
              items={items.relationTypes}
              objectNames={objectNames}
              unadoptedEnds={new Set(unadoptedEnds.map((item) => item.id))}
            />
          ) : activeTab === "valueTypes" ? (
            <DraftValueTypesTable
              actions={actions}
              catalogNames={catalogNames}
              items={items.valueTypes}
            />
          ) : (
            <DraftExcludedPanel
              catalogNames={catalogNames}
              excluded={items.excluded}
              objectNames={objectNames}
              unreadable={items.unreadable}
            />
          )}
          <DraftObjectDrawer
            catalogNames={catalogNames}
            excluded={items.excluded}
            objectType={items.objectTypes.find((item) => item.id === openId) ?? null}
            onClose={() => setOpenId(null)}
          />
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
