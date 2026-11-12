/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Space, Spin, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { BknProjectKbBadge, BknProjectKbSlot } from "@/framework/entitlement/BknProjectKbSlot";
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import {
  extensionProjectKnowledgeBaseResources,
  type ProjectKnowledgeBaseResourceStatus,
} from "@/framework/extension/registry";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { ExistingDot } from "@/modules/bkn-project/components/existing/ExistingMark";
import { ProjectCatalogsModal } from "@/modules/bkn-project/components/ProjectCatalogsModal";
import { UNDERSTANDING_STATUS_TONE } from "@/modules/bkn-project/components/publish/messages";
import { DocumentViewer } from "@/modules/bkn-project/components/requirements/Citations";
import { Citing } from "@/modules/bkn-project/components/requirements/citing";
import { RequirementDocuments } from "@/modules/bkn-project/components/requirements/RequirementDocuments";
import { getDraft } from "@/modules/bkn-project/services/draft.service";
import { getUnderstanding } from "@/modules/bkn-project/services/publish.service";
import {
  getNetworkBackground,
  listDocuments,
  NETWORK_DOCUMENT_ID,
} from "@/modules/bkn-project/services/requirements.service";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { Project } from "@/modules/bkn-project/types/project";
import type { UnderstandingCatalog, UnderstandingTable } from "@/modules/bkn-project/types/publish";
import type { RequirementDocument } from "@/modules/bkn-project/types/requirements";
import { listKnowledgeNetworkCapabilities } from "@/modules/knowledge-network/services/capability-binding.service";
import { RESOURCE_TABS, type ResourceTab } from "@/modules/bkn-project/types/workspace";
import { catalogListAllQuery, listCatalogs } from "@/shared/catalog";

import styles from "./ProjectResources.module.css";

const PREFIX = "bknProject.resources";
const PAGE_SIZE = 20;

/** A table of the project's catalogs, as this page lists it. */
type TableRow = UnderstandingTable & { catalogId: string; usedBy: string[] };

/**
 * What a project is built from, one kind to a tab: the data catalogs its ontology and instances
 * come from, with each table's semantic understanding and the object types that use it; in the
 * professional edition, the knowledge bases; and the requirement documents and regulations that
 * give the business background. The tab lives in the URL, so refreshing, going back and links from
 * other pages land on it; without one the page opens where something waits. The knowledge-base
 * panel stays mounted across tabs: it reports its count and what waits, and keeps what is not saved.
 */
export function ProjectResources({
  onGoToModel,
  onProjectChange,
  ownerIsCaller,
  project,
}: {
  onGoToModel: () => void;
  onProjectChange: (project: Project) => void;
  /** Only the owner chooses catalogs and documents; others see them. */
  ownerIsCaller: boolean;
  project: Project;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const kbMode = useBknProjectKbMode();
  const canEdit = ownerIsCaller && !project.archived;
  const KnowledgeBaseResources = extensionProjectKnowledgeBaseResources();
  const [searchParams, setSearchParams] = useSearchParams();
  const [kbStatus, setKbStatus] = useState<ProjectKnowledgeBaseResourceStatus | null>(null);

  // The catalogs the caller can see, by id; null while read or when they could not be.
  const [catalogs, setCatalogs] = useState<Map<string, string> | null>(null);
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

  // The draft, for the object types each table is used by and whether catalogs can be added;
  // undefined while read, null before the first.
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  const loadDraft = useCallback(async () => {
    setDraft(await getDraft(project.id).catch(() => null));
  }, [project.id]);

  // Each table's semantic understanding; null when it could not be read.
  const [understanding, setUnderstanding] = useState<UnderstandingCatalog[] | null | undefined>(
    undefined,
  );
  const loadUnderstanding = useCallback(async () => {
    setUnderstanding(await getUnderstanding(project.id).catch(() => null));
  }, [project.id]);

  const [documents, setDocuments] = useState<RequirementDocument[] | null>(null);
  const [documentsFailed, setDocumentsFailed] = useState(false);
  const loadDocuments = useCallback(async () => {
    try {
      setDocuments(await listDocuments(project.id));
      setDocumentsFailed(false);
    } catch {
      setDocumentsFailed(true);
    }
  }, [project.id]);

  useEffect(() => {
    void loadDraft();
    void loadDocuments();
  }, [loadDocuments, loadDraft]);

  // The network's own background, read only: null on a new network, or while it cannot be read.
  const [background, setBackground] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    getNetworkBackground(project.id)
      .then((document) => active && setBackground(Boolean(document)))
      .catch(() => active && setBackground(null));
    return () => {
      active = false;
    };
  }, [project.id]);

  // The knowledge bases mounted on the network, which are the project's sources too.
  const [networkBases, setNetworkBases] = useState<string[]>([]);
  useEffect(() => {
    if (kbMode !== "enabled") {
      return undefined;
    }
    let active = true;
    listKnowledgeNetworkCapabilities(project.knId, {
      limit: 100,
      mountedOnly: true,
      type: "knowledge_base",
    })
      .then(
        (result) =>
          active && setNetworkBases(result.entries.map((item) => item.name || item.capabilityId)),
      )
      .catch(() => active && setNetworkBases([]));
    return () => {
      active = false;
    };
  }, [kbMode, project.knId]);
  // The catalogs' tables change with the catalogs.
  useEffect(() => {
    void loadUnderstanding();
  }, [loadUnderstanding, project.catalogIds]);

  const [changing, setChanging] = useState<"add" | "replace" | null>(null);
  const [viewing, setViewing] = useState<{
    documentId: string;
    range?: { end: number; start: number };
  } | null>(null);

  // "Unknown" only once the list is read and lacks it: not while it is read, or could not be.
  const catalogName = (id: string) =>
    catalogs
      ? (catalogs.get(id) ?? t(`${PREFIX}.catalogs.unnamed`))
      : t(`${PREFIX}.catalogs.nameUnread`);
  // The object types of the draft by the table they read, adopted or not.
  const usedBy = useMemo(() => {
    const byTable = new Map<string, string[]>();
    for (const item of draft?.status === "ready" ? draft.items.objectTypes : []) {
      byTable.set(item.table.resourceId, [
        ...(byTable.get(item.table.resourceId) ?? []),
        item.name,
      ]);
    }
    return byTable;
  }, [draft]);
  const rows: TableRow[] = (understanding ?? [])
    .filter((catalog) => catalog.visible)
    .flatMap((catalog) =>
      catalog.tables.map((table) => ({
        ...table,
        catalogId: catalog.catalogId,
        usedBy: usedBy.get(table.resourceId) ?? [],
      })),
    );
  const invisible = (understanding ?? []).filter((catalog) => !catalog.visible);

  // Changing is offered once the visible catalogs are known: the dialog starts from them. Adding
  // drafts the new catalogs' tables into a ready draft, so it waits for one.
  const canChange = canEdit && catalogs !== null;
  const canAdd =
    canChange &&
    draft?.status === "ready" &&
    !draft.items.adding &&
    [...catalogs.keys()].some((id) => !project.catalogIds.includes(id));

  const columns: ColumnsType<TableRow> = [
    { dataIndex: "name", key: "name", title: t(`${PREFIX}.tables.name`) },
    {
      key: "catalog",
      render: (_value, record) => catalogName(record.catalogId),
      title: t(`${PREFIX}.tables.catalog`),
    },
    {
      key: "understanding",
      render: (_value, record) => (
        <LightStatusTag tone={UNDERSTANDING_STATUS_TONE[record.status] ?? "neutral"}>
          {record.status === "completed" && !record.applied
            ? t("bknProject.understand.progress.notApplied")
            : t(`bknProject.understand.status.${record.status}`)}
        </LightStatusTag>
      ),
      title: t(`${PREFIX}.tables.understanding`),
      width: 140,
    },
    {
      key: "usedBy",
      render: (_value, record) =>
        record.usedBy.length ? (
          record.usedBy.join(t(`${PREFIX}.tables.separator`))
        ) : (
          <span className={styles.muted}>{t(`${PREFIX}.tables.unused`)}</span>
        ),
      title: t(`${PREFIX}.tables.usedBy`),
    },
  ];

  const goneCatalogs = catalogs ? project.catalogIds.filter((id) => !catalogs.has(id)).length : 0;
  const catalogsWait = !project.catalogIds.length || goneCatalogs > 0;
  const kbMounted = kbMode === "enabled" && Boolean(KnowledgeBaseResources);
  const kbWaits = kbMounted && Boolean(kbStatus?.needsAttention);
  const waitingTab: ResourceTab = !catalogsWait && kbWaits ? "knowledge-base" : "catalogs";

  // Without a tab in the URL the page opens on the first needing action, settled once the panel has
  // said what waits: dealing with something does not move the person away from it.
  const [openingTab, setOpeningTab] = useState<ResourceTab | null>(null);
  const panelHasSpoken = !kbMounted || kbStatus !== null;
  const catalogsSettled = catalogs !== null || catalogsFailed;
  useEffect(() => {
    if (panelHasSpoken && catalogsSettled) {
      setOpeningTab((current) => current ?? waitingTab);
    }
  }, [catalogsSettled, panelHasSpoken, waitingTab]);

  const asked = RESOURCE_TABS.find((tab) => tab === searchParams.get("tab"));
  const activeTab =
    asked && (asked !== "knowledge-base" || kbMode !== "hidden")
      ? asked
      : (openingTab ?? waitingTab);

  const tabLabel = (label: ReactNode, count: number | null | undefined, waits: boolean) => (
    <span className={styles.tabLabel}>
      {label}
      {count === null || count === undefined ? null : (
        <span className={styles.tabCount}>{count}</span>
      )}
      {waits ? (
        <span
          aria-label={t(`${PREFIX}.tabs.needsAttention`)}
          className={styles.attentionDot}
          role="img"
        />
      ) : null}
    </span>
  );

  return (
    <Citing.Provider
      value={{
        documentName: (documentId) =>
          documentId === NETWORK_DOCUMENT_ID
            ? t("bknProject.networkExisting.background.name")
            : (documents?.find((document) => document.id === documentId)?.name ??
              t(`${PREFIX}.tabs.documents`)),
        openDocument: (documentId, range) => setViewing({ documentId, range }),
      }}
    >
      <div className={styles.page}>
        <Tabs
          activeKey={activeTab}
          items={[
            {
              key: "catalogs",
              label: tabLabel(
                t(`${PREFIX}.catalogs.title`),
                project.catalogIds.length,
                catalogsWait,
              ),
              children: (
                <div className={styles.tab}>
                  <header className={styles.tabHead}>
                    <p className={styles.muted}>
                      <LightStatusTag tone="info">{t(`${PREFIX}.required`)}</LightStatusTag>{" "}
                      {t(`${PREFIX}.catalogs.description`)}
                    </p>
                    <Space>
                      {canAdd ? (
                        <AppButton onClick={() => setChanging("add")}>
                          {t("bknProject.model.catalogs.add")}
                        </AppButton>
                      ) : null}
                      {canChange ? (
                        <AppButton
                          onClick={() => setChanging("replace")}
                          type={project.catalogIds.length ? "default" : "primary"}
                        >
                          {t(
                            project.catalogIds.length
                              ? "bknProject.model.catalogs.change"
                              : "bknProject.model.catalogs.choose",
                          )}
                        </AppButton>
                      ) : null}
                    </Space>
                  </header>
                  {ownerIsCaller && catalogsFailed ? (
                    <Alert
                      action={
                        <AppButton
                          onClick={() => setCatalogReads((count) => count + 1)}
                          size="small"
                        >
                          {t("common.retry")}
                        </AppButton>
                      }
                      message={t("bknProject.model.catalogs.loadFailed")}
                      showIcon
                      type="warning"
                    />
                  ) : null}
                  {goneCatalogs ? (
                    <Alert
                      message={t(`${PREFIX}.catalogs.gone`, { count: goneCatalogs })}
                      showIcon
                      type="warning"
                    />
                  ) : null}
                  {draft?.status === "ready" && draft.items.adding ? (
                    <Alert
                      action={
                        <AppButton onClick={onGoToModel} size="small">
                          {t(`${PREFIX}.catalogs.goToModel`)}
                        </AppButton>
                      }
                      message={t("bknProject.model.catalogs.adding", {
                        count: draft.items.adding.catalogIds.length,
                      })}
                      showIcon
                      type="info"
                    />
                  ) : null}
                  {project.catalogIds.length ? (
                    <>
                      {/* Without a name to tell them apart, catalogs say so once. */}
                      {[
                        ...new Set(
                          invisible.map((catalog) =>
                            t("bknProject.understand.progress.invisible", {
                              name: catalogName(catalog.catalogId),
                            }),
                          ),
                        ),
                      ].map((text) => (
                        <p className={styles.muted} key={text}>
                          {text}
                        </p>
                      ))}
                      {understanding === null ? (
                        <Alert
                          action={
                            <AppButton onClick={() => void loadUnderstanding()} size="small">
                              {t("common.retry")}
                            </AppButton>
                          }
                          message={t(`${PREFIX}.tables.loadFailed`)}
                          showIcon
                          type="warning"
                        />
                      ) : (
                        <AppTable<TableRow>
                          columns={columns}
                          dataSource={rows}
                          loading={understanding === undefined}
                          pagination={rows.length > PAGE_SIZE ? { pageSize: PAGE_SIZE } : false}
                          rowKey="resourceId"
                          size="middle"
                        />
                      )}
                    </>
                  ) : (
                    <EmptyStatePanel
                      description={t(
                        ownerIsCaller
                          ? "bknProject.model.empty.noCatalogs"
                          : "bknProject.model.empty.noCatalogsAskOwner",
                      )}
                      title={t(`${PREFIX}.catalogs.empty`)}
                    />
                  )}
                </div>
              ),
            },
            // Professional: masked in an image without it, left out where it is hidden.
            ...(kbMode === "hidden"
              ? []
              : [
                  {
                    key: "knowledge-base",
                    forceRender: kbMounted,
                    label: tabLabel(
                      <BknProjectKbBadge>{t(`${PREFIX}.knowledgeBases.title`)}</BknProjectKbBadge>,
                      kbMounted ? kbStatus?.fileCount : null,
                      kbWaits,
                    ),
                    children: (
                      <div className={styles.tab}>
                        <p className={styles.muted}>{t(`${PREFIX}.knowledgeBases.description`)}</p>
                        <BknProjectKbSlot
                          preview={
                            <p className={styles.muted}>{t(`${PREFIX}.knowledgeBases.preview`)}</p>
                          }
                        >
                          {networkBases.length ? (
                            <section className={styles.existing} data-testid="network-bases">
                              <span className={styles.existingTitle}>
                                <ExistingDot />
                                {t("bknProject.networkExisting.knowledgeBases.title")}
                              </span>
                              <p className={styles.muted}>
                                {t("bknProject.networkExisting.knowledgeBases.description")}
                              </p>
                              <ul className={styles.existingList}>
                                {networkBases.map((name) => (
                                  <li key={name}>
                                    <ExistingDot />
                                    {name}
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ) : null}
                          {KnowledgeBaseResources ? (
                            <KnowledgeBaseResources
                              key={project.id}
                              projectId={project.id}
                              canEdit={canEdit}
                              canManageHolds={ownerIsCaller}
                              onStatusChange={setKbStatus}
                            />
                          ) : (
                            <p className={styles.muted}>
                              {t(`${PREFIX}.knowledgeBases.comingSoon`)}
                            </p>
                          )}
                        </BknProjectKbSlot>
                      </div>
                    ),
                  },
                ]),
            {
              key: "documents",
              label: tabLabel(t(`${PREFIX}.tabs.documents`), documents?.length, false),
              children: (
                <div className={styles.documents}>
                  {background ? (
                    <div className={styles.existing} data-testid="network-background">
                      <span className={styles.existingTitle}>
                        <ExistingDot />
                        {t("bknProject.networkExisting.background.title")}
                      </span>
                      <p className={styles.muted}>
                        {t("bknProject.networkExisting.background.description")}
                      </p>
                      <div className={styles.existingRow}>
                        <span>
                          <ExistingDot />
                          {t("bknProject.networkExisting.background.name")}
                        </span>
                        <AppButton
                          onClick={() => setViewing({ documentId: NETWORK_DOCUMENT_ID })}
                          size="small"
                          type="link"
                        >
                          {t("bknProject.networkExisting.background.view")}
                        </AppButton>
                      </div>
                    </div>
                  ) : null}
                  {documentsFailed && documents === null ? (
                    <Alert
                      action={
                        <AppButton onClick={() => void loadDocuments()} size="small">
                          {t("common.retry")}
                        </AppButton>
                      }
                      message={t(`${PREFIX}.documents.loadFailed`)}
                      showIcon
                      type="error"
                    />
                  ) : documents === null ? (
                    <Spin />
                  ) : (
                    <RequirementDocuments
                      canEdit={canEdit}
                      documents={documents}
                      onChanged={() => void loadDocuments()}
                      projectId={project.id}
                    />
                  )}
                </div>
              ),
            },
          ]}
          onChange={(tab) =>
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              next.set("tab", tab);
              return next;
            })
          }
        />

        {changing && catalogs ? (
          <ProjectCatalogsModal
            catalogs={catalogs}
            mode={changing}
            onCancel={() => setChanging(null)}
            onSaved={(next, adding) => {
              setChanging(null);
              onProjectChange(next);
              message.success(
                t(
                  changing === "add"
                    ? "bknProject.model.catalogs.added"
                    : "bknProject.model.catalogs.saved",
                ),
              );
              // The draft names the catalogs being added.
              if (adding) {
                setDraft(adding);
              }
            }}
            onStale={() => void loadDraft()}
            project={project}
          />
        ) : null}
        {viewing ? (
          <DocumentViewer
            documentId={viewing.documentId}
            onClose={() => setViewing(null)}
            projectId={project.id}
            range={viewing.range}
          />
        ) : null}
      </div>
    </Citing.Provider>
  );
}
