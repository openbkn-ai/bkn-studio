/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Segmented, Spin } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { DraftObjectDrawer } from "@/modules/bkn-project/components/draft/DraftObjectDrawer";
import {
  DraftExcludedPanel,
  DraftObjectsTable,
  DraftRelationsTable,
  DraftValueTypesTable,
} from "@/modules/bkn-project/components/draft/DraftTables";
import {
  missingCatalogs,
  relationsWithUnadoptedEnds,
} from "@/modules/bkn-project/components/draft/evidence";
import { generateDraft, getDraft } from "@/modules/bkn-project/services/draft.service";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { Project } from "@/modules/bkn-project/types/project";
import { catalogListAllQuery, listCatalogs } from "@/shared/catalog";

import styles from "./ProjectModel.module.css";

/** How often a draft that is drafting is read again. */
export const DRAFT_POLL_MS = 5000;

type Tab = "excluded" | "objects" | "relations" | "valueTypes";

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
  // undefined while loading, null before the first draft.
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<Catalogs>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("objects");
  const [openId, setOpenId] = useState<string | null>(null);

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

  const generate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      setDraft(await generateDraft(project.id));
    } catch (error) {
      setGenerateError(extractRequestErrorMessage(error));
    } finally {
      setGenerating(false);
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
      disabled={drafting || noCatalogs}
      loading={generating}
      onClick={() => void generate()}
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
              catalogNames={catalogNames}
              items={items.objectTypes}
              onOpen={setOpenId}
            />
          ) : activeTab === "relations" ? (
            <DraftRelationsTable
              items={items.relationTypes}
              objectNames={objectNames}
              unadoptedEnds={new Set(unadoptedEnds.map((item) => item.id))}
            />
          ) : activeTab === "valueTypes" ? (
            <DraftValueTypesTable catalogNames={catalogNames} items={items.valueTypes} />
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
        </>
      )}
    </div>
  );
}
