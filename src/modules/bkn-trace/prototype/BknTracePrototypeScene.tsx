/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CaretLeftOutlined,
  CaretRightOutlined,
  CheckCircleFilled,
  CodeOutlined,
  DeploymentUnitOutlined,
} from "@ant-design/icons";
import { Segmented } from "antd";
import { useMemo, useState } from "react";

import { tracePrototypeFixture } from "@/modules/bkn-trace/prototype/bkn-trace-prototype.fixture";
import {
  getChronologicalOperations,
  getKnowledgeNetworkProjection,
} from "@/modules/bkn-trace/prototype/bkn-trace-prototype.projection";
import type {
  ProjectedObject,
  ProjectedRelation,
  TraceOperationSnapshot,
} from "@/modules/bkn-trace/prototype/bkn-trace-prototype.types";
import { TraceKnowledgeNetworkView } from "@/modules/bkn-trace/prototype/TraceKnowledgeNetworkView";
import { formatDuration } from "@/modules/bkn-trace/prototype/bkn-trace-prototype.format";
import { TraceTimelineView } from "@/modules/bkn-trace/prototype/TraceTimelineView";
import styles from "@/modules/bkn-trace/prototype/BknTracePrototypeScene.module.css";

type ViewMode = "knowledge-network" | "timeline";
type Selection =
  | { type: "object"; value: ProjectedObject }
  | { type: "operation"; value: TraceOperationSnapshot }
  | { type: "relation"; value: ProjectedRelation };

function DetailPanel({
  selection,
  objectNames,
  collapsed,
  onToggle,
}: {
  selection: Selection;
  objectNames: Map<string, string>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <aside className={styles.detailCollapsed}>
        <button type="button" aria-label="展开详情" onClick={onToggle}>
          <CaretLeftOutlined />
        </button>
        <span>调用详情</span>
      </aside>
    );
  }

  if (selection.type === "relation") {
    const relation = selection.value;
    return (
      <aside className={styles.detailPanel}>
        <header className={styles.detailHeader}>
          <div><span className={styles.detailEyebrow}>知识网络关系</span><h2>{relation.name}</h2></div>
          <button type="button" aria-label="收起详情" onClick={onToggle}><CaretRightOutlined /></button>
        </header>
        <div className={`${styles.detailStatus} ${styles.contextStatus}`}>网络上下文，未记录为实际调用</div>
        <section className={styles.detailSection}>
          <h3>它连接什么</h3>
          <p>{objectNames.get(relation.sourceObjectId)} → {objectNames.get(relation.targetObjectId)}</p>
        </section>
        <section className={styles.detailSection}>
          <h3>关联条件</h3>
          <div className={styles.conditionBox}>{relation.mappingSummary}</div>
        </section>
        <section className={styles.detailSection}>
          <h3>为什么展示</h3>
          <p>这是该对象在业务知识网络中的真实关系，用来解释可继续追溯的方向；当前 Trace 没有记录 Agent 调用过这条关系。</p>
        </section>
        <details className={styles.disclosure}>
          <summary>技术信息</summary>
          <dl className={styles.technicalList}><div><dt>Relation ID</dt><dd>{relation.id}</dd></div></dl>
        </details>
      </aside>
    );
  }

  if (selection.type === "object") {
    const object = selection.value;
    return (
      <aside className={styles.detailPanel}>
        <header className={styles.detailHeader}>
          <div><span className={styles.detailEyebrow}>本次触达对象</span><h2>{object.name}</h2></div>
          <button type="button" aria-label="收起详情" onClick={onToggle}><CaretRightOutlined /></button>
        </header>
        <div className={styles.detailStatus}><span><CheckCircleFilled /> 已触达</span><span>{object.operationIds.length} 次查询</span></div>
        <section className={styles.detailSection}>
          <h3>如何定位</h3>
          <p>{object.binding === "direct-object-query" ? "Agent 直接查询了该业务对象。" : "调用的数据资源与该对象的数据源绑定一致，因此可确定性定位到该对象。"}</p>
        </section>
        <section className={styles.detailSection}>
          <h3>业务知识网络</h3><p>{tracePrototypeFixture.network.name}</p>
        </section>
        <details className={styles.disclosure}>
          <summary>技术信息</summary>
          <dl className={styles.technicalList}><div><dt>Object ID</dt><dd>{object.id}</dd></div></dl>
        </details>
      </aside>
    );
  }

  const operation = selection.value;
  const objectName = operation.targetObjectId ? objectNames.get(operation.targetObjectId) : undefined;

  return (
    <aside className={styles.detailPanel}>
      <header className={styles.detailHeader}>
        <div>
          <span className={styles.detailEyebrow}>当前业务动作</span>
          <h2>{operation.businessLabel}</h2>
        </div>
        <button type="button" aria-label="收起详情" onClick={onToggle}>
          <CaretRightOutlined />
        </button>
      </header>

      <div className={styles.detailStatus}>
        <span><CheckCircleFilled /> 已完成</span>
        <span>{formatDuration(operation.durationMs)}</span>
      </div>

      <section className={styles.detailSection}>
        <h3>做了什么</h3>
        <p>{operation.resultSummary}</p>
      </section>

      <section className={styles.detailSection}>
        <h3>业务目标</h3>
        <dl className={styles.detailList}>
          <div><dt>知识网络</dt><dd>{tracePrototypeFixture.network.name}</dd></div>
          {objectName ? <div><dt>对象</dt><dd>{objectName}</dd></div> : null}
          {operation.resourceId ? <div><dt>定位方式</dt><dd>通过数据资源确定性映射到对象</dd></div> : null}
        </dl>
      </section>

      <section className={styles.detailSection}>
        <h3>怎么调用</h3>
        <div className={styles.conditionBox}>{operation.condition ?? "无附加查询条件"}</div>
        {operation.fields?.length ? (
          <div className={styles.fieldList}>
            {operation.fields.map((field) => <span key={field}>{field}</span>)}
          </div>
        ) : null}
      </section>

      <section className={styles.detailSection}>
        <h3>结果</h3>
        <p>{operation.resultSummary}</p>
      </section>

      {operation.sql ? (
        <details className={styles.disclosure}>
          <summary><CodeOutlined /> 复现查询</summary>
          <pre>{operation.sql}</pre>
        </details>
      ) : null}

      <details className={styles.disclosure}>
        <summary>技术信息</summary>
        <dl className={styles.technicalList}>
          <div><dt>接口</dt><dd>{operation.tool}</dd></div>
          {operation.requestId ? <div><dt>Request ID</dt><dd>{operation.requestId}</dd></div> : null}
          {operation.operationId ? <div><dt>Operation ID</dt><dd>{operation.operationId}</dd></div> : null}
          {operation.resourceId ? <div><dt>Resource ID</dt><dd>{operation.resourceId}</dd></div> : null}
        </dl>
      </details>
    </aside>
  );
}

export function BknTracePrototypeScene() {
  const operations = useMemo(
    () => getChronologicalOperations(tracePrototypeFixture),
    [],
  );
  const objectNames = useMemo(
    () => new Map(tracePrototypeFixture.objects.map((object) => [object.id, object.name])),
    [],
  );
  const networkProjection = useMemo(
    () => getKnowledgeNetworkProjection(tracePrototypeFixture),
    [],
  );
  const [view, setView] = useState<ViewMode>("timeline");
  const initialOperation = operations.find((operation) => operation.id === "op-inventory-sql")
    ?? operations[0];
  const [selection, setSelection] = useState<Selection>({ type: "operation", value: initialOperation });
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const selectedOperation = selection.type === "operation" ? selection.value : initialOperation;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.titleLine}>
            <DeploymentUnitOutlined />
            <h1>业务溯源分析</h1>
            <span className={styles.completeBadge}>完整</span>
          </div>
          <p>{tracePrototypeFixture.agentName} · 2 轮交互 · 9 次业务调用 · {tracePrototypeFixture.network.name}</p>
        </div>
        <div className={styles.conversationMeta}>
          <span>真实会话快照</span>
          <code>{tracePrototypeFixture.conversationId}</code>
        </div>
      </header>

      <div className={styles.toolbar}>
        <Segmented<ViewMode>
          value={view}
          onChange={setView}
          options={[
            { label: "时间链视图", value: "timeline" },
            { label: "知识网络视图", value: "knowledge-network" },
          ]}
        />
        <p>{view === "timeline"
          ? "按真实发生顺序查看每轮问题、业务调用和结果"
          : "从知识网络逐步展开本次会话实际触达的对象"}</p>
      </div>

      <div className={`${styles.workspace} ${detailCollapsed ? styles.workspaceCollapsed : ""}`}>
        <section className={styles.mainPanel}>
          {view === "timeline" ? (
            <TraceTimelineView
              interactions={tracePrototypeFixture.interactions}
              selectedOperationId={selectedOperation.id}
              onSelectOperation={(operation) => setSelection({ type: "operation", value: operation })}
              objectNames={objectNames}
            />
          ) : (
            <TraceKnowledgeNetworkView
              networkName={tracePrototypeFixture.network.name}
              projection={networkProjection}
              allObjects={tracePrototypeFixture.objects}
              initialObjectId={selectedOperation.targetObjectId}
              onSelectObject={(object) => setSelection({ type: "object", value: object })}
              onSelectRelation={(relation) => setSelection({ type: "relation", value: relation })}
            />
          )}
        </section>
        <DetailPanel
          selection={selection}
          objectNames={objectNames}
          collapsed={detailCollapsed}
          onToggle={() => setDetailCollapsed((collapsed) => !collapsed)}
        />
      </div>
    </main>
  );
}
