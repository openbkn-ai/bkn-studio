/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, CopyOutlined, DatabaseOutlined, ThunderboltFilled } from "@ant-design/icons";
import { Empty, Input, Spin, Tooltip } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  createBknLifecycle,
  lifecycleEnv,
  memoryConversationStore,
  withManagedTurn,
  type BknLifecycle,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import {
  fetchKnDetail,
  fetchObjectInstances,
  type ContextLoaderEnv,
  type KnDetail,
  type KnObjectType,
  type KnRelationType,
  type McpAuth,
  type RequestDataAssistantKind,
} from "@/modules/knowledge-network/services/context-loader.service";

import styles from "./ExperienceScene.module.css";

const DETAIL_LOAD_TIMEOUT_MS = 15_000;

function formatPreviewValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

/** 从单个 JSON Schema 属性生成可编辑示例值。 */

function ObjectTypeCard({
  ot,
  onFillField,
  onFillResource,
  onFillTest,
  showObjectType,
  showResource,
  copy,
  env,
  auth,
  lifecycle,
}: {
  ot: KnObjectType;
  onFillField: (key: string, value: string) => void;
  onFillResource: (resourceId: string) => void;
  /** 用该对象类型的真实样本行填充当前接口；仅在当前接口按对象类型取数时传入。 */
  onFillTest?: (ot: KnObjectType) => Promise<void>;
  showObjectType: boolean;
  showResource: boolean;
  copy: (text: string, label?: string) => void;
  env: ContextLoaderEnv;
  /** 401 自动刷新 token 用（OAuth 续期）。 */
  auth?: McpAuth;
  /** 面板级受管生命周期：样本行预览也是受管业务调用。 */
  lifecycle: BknLifecycle;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filling, setFilling] = useState(false);
  const res = ot.data_source ?? null;
  const props = ot.data_properties ?? [];

  // 样本行预览（按需拉取 query_object_instance）
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const togglePreview = () => {
    const next = !previewOpen;
    setPreviewOpen(next);
    if (next && previewRows === null && !previewLoading) {
      setPreviewLoading(true);
      setPreviewError(null);
      withManagedTurn(lifecycle, t("knowledgeNetwork.contextLoaderPanel.dataBrowser.previewTurn", { id: ot.id }), (turn) =>
        fetchObjectInstances(env, ot.id, 5, auth, undefined, turn ?? undefined),
      )
        .then((rows) => setPreviewRows(rows))
        .catch((error) =>
          setPreviewError(error instanceof Error ? error.message : t("knowledgeNetwork.contextLoaderPanel.dataBrowser.previewFailed")),
        )
        .finally(() => setPreviewLoading(false));
    }
  };

  const previewColumns =
    props.length > 0
      ? props.map((p) => p.name)
      : previewRows && previewRows[0]
        ? Object.keys(previewRows[0]).filter((k) => !k.startsWith("_"))
        : [];

  return (
    <div className={styles.dbCard}>
      <div className={styles.dbCardHead}>
        <span className={styles.dbOtName} title={ot.name || ot.id}>
          {ot.name || ot.id}
        </span>
        {onFillTest && res?.id ? (
          <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.fillTestTooltip")}>
            <button
              type="button"
              className={styles.dbTestBtn}
              disabled={filling}
              onClick={() => {
                if (filling) return;
                setFilling(true);
                void onFillTest(ot).finally(() => setFilling(false));
              }}
            >
              {filling ? <Spin size="small" /> : <ThunderboltFilled />}{" "}
              {t("knowledgeNetwork.contextLoaderPanel.dataBrowser.fillTest")}
            </button>
          </Tooltip>
        ) : null}
        <button
          type="button"
          className={`${styles.dbFields} ${open ? styles.dbFieldsOpen : ""}`}
          onClick={() => setOpen((value) => !value)}
          disabled={props.length === 0}
        >
          {t("knowledgeNetwork.contextLoaderPanel.dataBrowser.fieldCount", { count: props.length })}{" "}
          <span className={styles.dbChev}>▾</span>
        </button>
      </div>

      {showObjectType ? (
        <div className={styles.dbRow}>
          <span className={styles.dbRowLabel}>{t("knowledgeNetwork.contextLoaderPanel.dataBrowser.objectType")}</span>
          <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.fillOtIdTooltip")}>
            <button type="button" className={styles.dbChip} onClick={() => onFillField("ot_id", ot.id)}>
              {ot.id}
            </button>
          </Tooltip>
          <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.copyOtId")}>
            <button type="button" className={styles.dbCopy} onClick={() => copy(ot.id, t("knowledgeNetwork.contextLoaderPanel.dataBrowser.copiedOtId"))}>
              <CopyOutlined />
            </button>
          </Tooltip>
        </div>
      ) : null}

      {showResource ? (
        <div className={styles.dbRow}>
          <span className={styles.dbRowLabel}>{t("knowledgeNetwork.contextLoaderPanel.dataBrowser.dataResource")}</span>
          {res?.id ? (
            <>
              <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.fillResourceTooltip", { resource: "resource" })}>
                <button type="button" className={styles.dbRes} onClick={() => onFillResource(res.id)}>
                  <DatabaseOutlined /> {res.name || t("knowledgeNetwork.contextLoaderPanel.dataBrowser.resourceFallback")} · {res.id}
                </button>
              </Tooltip>
              <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.copyResourceId")}>
                <button type="button" className={styles.dbCopy} onClick={() => copy(res.id, t("knowledgeNetwork.contextLoaderPanel.dataBrowser.copiedResourceId"))}>
                  <CopyOutlined />
                </button>
              </Tooltip>
            </>
          ) : (
            <span className={styles.dbNoRes}>{t("knowledgeNetwork.contextLoaderPanel.dataBrowser.noBinding")}</span>
          )}
        </div>
      ) : null}

      {open && props.length > 0 ? (
        <div className={styles.dbPropList}>
          <div className={styles.dbPropHead}>{t("knowledgeNetwork.contextLoaderPanel.dataBrowser.fieldsHeader")}</div>
          {props.map((prop) => (
            <Tooltip key={prop.name} title={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.copyFieldName", { name: prop.name })}>
              <button
                type="button"
                className={styles.dbProp}
                onClick={() => copy(prop.name, t("knowledgeNetwork.contextLoaderPanel.dataBrowser.copiedFieldName", { name: prop.name }))}
              >
                <span className={styles.dbPropName}>{prop.name}</span>
                {prop.display_name && prop.display_name !== prop.name ? (
                  <span className={styles.dbPropDisp}>{prop.display_name}</span>
                ) : null}
                <span className={styles.dbPropType}>{prop.type || "—"}</span>
                <CopyOutlined className={styles.dbPropCopy} />
              </button>
            </Tooltip>
          ))}
        </div>
      ) : null}

      <div className={styles.dbRow}>
        <span className={styles.dbRowLabel}>{t("knowledgeNetwork.contextLoaderPanel.dataBrowser.sampleData")}</span>
        <button
          type="button"
          className={`${styles.dbFields} ${previewOpen ? styles.dbFieldsOpen : ""}`}
          onClick={togglePreview}
        >
          {previewOpen
            ? t("knowledgeNetwork.contextLoaderPanel.dataBrowser.collapsePreview")
            : t("knowledgeNetwork.contextLoaderPanel.dataBrowser.previewData")}{" "}
          <span className={styles.dbChev}>▾</span>
        </button>
      </div>

      {previewOpen ? (
        <div className={styles.dbPreview}>
          {previewLoading ? (
            <div className={styles.dbPreviewMsg}>
              <Spin size="small" /> {t("knowledgeNetwork.contextLoaderPanel.dataBrowser.loading")}
            </div>
          ) : previewError ? (
            <div className={styles.dbPreviewErr}>{previewError}</div>
          ) : previewRows && previewRows.length > 0 && previewColumns.length > 0 ? (
            <div className={styles.dbPreviewTableWrap}>
              <table className={styles.dbPreviewTable}>
                <thead>
                  <tr>
                    {previewColumns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {previewColumns.map((col) => {
                        const value = row[col];
                        const text = formatPreviewValue(value);
                        return (
                          <td key={col} title={text}>
                            {text}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.dbPreviewMsg}>{t("knowledgeNetwork.contextLoaderPanel.dataBrowser.noData")}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function DataBrowserPanel({
  active,
  env,
  assistantKind,
  onFillField,
  onFillResource,
  onFillConceptGroup,
  onFillTest,
  onFillRelation,
  copy,
  auth,
}: {
  active: boolean;
  env: ContextLoaderEnv;
  assistantKind: RequestDataAssistantKind | null;
  onFillField: (key: string, value: string) => void;
  onFillResource: (resourceId: string) => void;
  onFillConceptGroup: (groupId: string) => void;
  /** 当前接口按对象类型取数时传入，使每张卡片可一键填充测试请求。 */
  onFillTest?: (ot: KnObjectType) => Promise<void>;
  /** 当前接口为 query_instance_subgraph 时传入，使关系卡可一键填入子图路径。 */
  onFillRelation?: (rel: KnRelationType) => void;
  copy: (text: string, label?: string) => void;
  /** 401 自动刷新 token 用（OAuth 续期）。 */
  auth?: McpAuth;
}) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<KnDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const loadedRef = useRef(false);

  /**
   * 数据浏览器读的 get_kn_detail / query_object_instance 都是受管业务工具，
   * 不带 bkn_context 会被 Context Loader 挡回。这里不是对话，会话按本次挂载算一条。
   */
  const lifecycle = useMemo(
    () => createBknLifecycle(lifecycleEnv(env.base, env.knId), auth, { conversationStore: memoryConversationStore() }),
    [env.base, env.knId, auth],
  );

  // 懒加载：首次切到「数据浏览器」标签时拉一次 schema，之后常驻不再重拉，保留预览/筛选上下文。
  useEffect(() => {
    if (!active || loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), DETAIL_LOAD_TIMEOUT_MS);
    setLoading(true);
    setError(null);
    withManagedTurn(lifecycle, t("knowledgeNetwork.contextLoaderPanel.dataBrowser.loadStructureTurn"), (turn) =>
      fetchKnDetail(env, auth, controller.signal, turn ?? undefined),
    )
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            controller.signal.aborted
              ? t("knowledgeNetwork.contextLoaderPanel.dataBrowser.loadTimeout")
              : err instanceof Error
                ? err.message
                : t("knowledgeNetwork.contextLoaderPanel.dataBrowser.loadFailed"),
          );
          loadedRef.current = false; // 失败可重试
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [active, auth, env, reloadKey, lifecycle, t]);

  const reload = () => {
    loadedRef.current = false;
    setReloadKey((value) => value + 1);
  };

  const sections = useMemo(() => {
    if (!detail) return [];
    const needle = q.trim().toLowerCase();
    const match = (ot: KnObjectType) =>
      !needle ||
      `${ot.id} ${ot.name ?? ""} ${ot.data_source?.id ?? ""} ${ot.data_source?.name ?? ""}`
        .toLowerCase()
        .includes(needle);
    const byId = new Map(detail.object_types.map((o) => [o.id, o]));
    const grouped = detail.concept_groups.map((group) => ({
      id: group.id,
      title: group.name || group.id,
      ots: (group.object_type_ids ?? []).map((oid) => byId.get(oid)).filter((o): o is KnObjectType => Boolean(o)),
    }));
    const inGroup = new Set(detail.concept_groups.flatMap((g) => g.object_type_ids ?? []));
    const ungrouped = detail.object_types.filter((o) => !inGroup.has(o.id));
    if (ungrouped.length) grouped.push({ id: "", title: t("knowledgeNetwork.contextLoaderPanel.dataBrowser.ungrouped"), ots: ungrouped });
    return grouped
      .map((section) => ({
        ...section,
        ots: section.ots.filter((ot) => match(ot) && (assistantKind !== "resource" || Boolean(ot.data_source?.id))),
      }))
      .filter((section) => section.ots.length > 0);
  }, [assistantKind, detail, q, t]);

  const conceptGroups = useMemo(() => {
    if (!detail) return [];
    const needle = q.trim().toLowerCase();
    return detail.concept_groups.filter((group) => !needle || `${group.id} ${group.name ?? ""}`.toLowerCase().includes(needle));
  }, [detail, q]);

  const relations = useMemo(() => {
    if (!detail) return [];
    const needle = q.trim().toLowerCase();
    return detail.relation_types.filter(
      (rel) =>
        !needle ||
        `${rel.id} ${rel.name ?? ""} ${rel.sourceId} ${rel.targetId}`.toLowerCase().includes(needle),
    );
  }, [detail, q]);

  return (
    <div className={styles.dbWrap}>
      <div className={styles.dbSearch}>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              assistantKind === "concept-group"
                ? t("knowledgeNetwork.contextLoaderPanel.dataBrowser.filterConceptGroup")
                : assistantKind === "relation"
                  ? t("knowledgeNetwork.contextLoaderPanel.dataBrowser.filterRelation")
                  : assistantKind === "resource"
                    ? t("knowledgeNetwork.contextLoaderPanel.dataBrowser.filterResource")
                    : t("knowledgeNetwork.contextLoaderPanel.dataBrowser.filterObjectType")
            }
            allowClear
          />
        </div>
        <div className={styles.dbList}>
          {loading ? (
            <div className={styles.dbCenter}>
              <Spin />
            </div>
          ) : error ? (
              <div className={styles.dbError}>
                <ApiOutlined />
                <div>
                  <strong>{t("knowledgeNetwork.contextLoaderPanel.dataBrowser.loadFailed")}</strong>
                  <p>{error}</p>
                  <button type="button" className={styles.dbRetry} onClick={reload}>
                    {t("knowledgeNetwork.contextLoaderPanel.dataBrowser.retry")}
                  </button>
                </div>
              </div>
          ) : assistantKind === "concept-group" ? (
            conceptGroups.length === 0 ? (
              <div className={styles.dbCenter}>
                <Empty description={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.noConceptGroup")} />
              </div>
            ) : (
              <div className={styles.dbSection}>
                {conceptGroups.map((group) => (
                  <div key={group.id} className={styles.dbCard}>
                    <div className={styles.dbCardHead}>
                      <span className={styles.dbOtName} title={group.name || group.id}>{group.name || group.id}</span>
                      <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.fillConceptGroupTooltip", { id: group.id })}>
                        <button type="button" className={styles.dbTestBtn} onClick={() => onFillConceptGroup(group.id)}>
                          <ThunderboltFilled /> {t("knowledgeNetwork.contextLoaderPanel.dataBrowser.fillConceptGroup")}
                        </button>
                      </Tooltip>
                    </div>
                    <div className={styles.dbRow}>
                      <span className={styles.dbRowLabel}>{t("knowledgeNetwork.contextLoaderPanel.dataBrowser.conceptGroupId")}</span>
                      <span className={styles.dbChip}>{group.id}</span>
                      <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.copyConceptGroupId")}>
                        <button
                          type="button"
                          className={styles.dbCopy}
                          onClick={() => copy(group.id, t("knowledgeNetwork.contextLoaderPanel.dataBrowser.copiedConceptGroupId"))}
                        >
                          <CopyOutlined />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : assistantKind === "relation" ? (
            relations.length === 0 ? (
              <div className={styles.dbCenter}>
                <Empty description={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.noRelation")} />
              </div>
            ) : (
              <div className={styles.dbSection}>
                {relations.map((rel) => (
                  <div key={rel.id} className={styles.dbCard}>
                    <div className={styles.dbCardHead}>
                      <span className={styles.dbOtName} title={rel.name || rel.id}>
                        {rel.name || rel.id}
                      </span>
                      {onFillRelation ? (
                        <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.fillSubgraphTooltip")}>
                          <button type="button" className={styles.dbTestBtn} onClick={() => onFillRelation(rel)}>
                            <ThunderboltFilled /> {t("knowledgeNetwork.contextLoaderPanel.dataBrowser.fillSubgraph")}
                          </button>
                        </Tooltip>
                      ) : null}
                    </div>
                    <div className={styles.dbRow}>
                      <span className={styles.dbRowLabel}>{t("knowledgeNetwork.contextLoaderPanel.dataBrowser.path")}</span>
                      <span className={styles.dbChip}>{rel.sourceId}</span>
                      <span className={styles.dbRelArrow}>→</span>
                      <span className={styles.dbChip}>{rel.targetId}</span>
                      <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.dataBrowser.copyRelationId")}>
                        <button type="button" className={styles.dbCopy} onClick={() => copy(rel.id, t("knowledgeNetwork.contextLoaderPanel.dataBrowser.copiedRelationId"))}>
                          <CopyOutlined />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            sections.length === 0 ? (
              <div className={styles.dbCenter}>
                <Empty
                  description={
                    assistantKind === "resource"
                      ? t("knowledgeNetwork.contextLoaderPanel.dataBrowser.noResource")
                      : t("knowledgeNetwork.contextLoaderPanel.dataBrowser.noObjectType")
                  }
                />
              </div>
            ) : (
              sections.map((section) => (
                <div key={section.title} className={styles.dbSection}>
                  <div className={styles.dbGroup}>{section.title}</div>
                  {section.ots.map((ot) => (
                    <ObjectTypeCard
                      key={ot.id}
                      ot={ot}
                      onFillField={onFillField}
                      onFillResource={onFillResource}
                      onFillTest={onFillTest}
                      showObjectType={assistantKind === "object-type"}
                      showResource={assistantKind === "resource"}
                      copy={copy}
                      env={env}
                      auth={auth}
                      lifecycle={lifecycle}
                    />
                  ))}
                </div>
              ))
            )
          )}
        </div>
      </div>
  );
}

/* ============================ 主场景 ============================ */
