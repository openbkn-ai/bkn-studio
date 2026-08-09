/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  LinkOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";

import type {
  BknObjectSnapshot,
  KnowledgeNetworkProjection,
  ProjectedObject,
  ProjectedRelation,
} from "@/modules/bkn-trace/prototype/bkn-trace-prototype.types";
import styles from "@/modules/bkn-trace/prototype/BknTracePrototypeScene.module.css";

interface TraceKnowledgeNetworkViewProps {
  networkName: string;
  projection: KnowledgeNetworkProjection;
  allObjects: BknObjectSnapshot[];
  initialObjectId?: string;
  onSelectObject: (object: ProjectedObject) => void;
  onSelectRelation: (relation: ProjectedRelation) => void;
}
export function TraceKnowledgeNetworkView({
  networkName,
  projection,
  allObjects,
  initialObjectId,
  onSelectObject,
  onSelectRelation,
}: TraceKnowledgeNetworkViewProps) {
  const [objectsExpanded, setObjectsExpanded] = useState(true);
  const [selectedObjectId, setSelectedObjectId] = useState(
    initialObjectId ?? projection.observedObjects[0]?.id,
  );
  const [selectedRelationId, setSelectedRelationId] = useState<string>();
  const [candidatesExpanded, setCandidatesExpanded] = useState(false);
  const objectNames = useMemo(
    () => new Map(allObjects.map((object) => [object.id, object.name])),
    [allObjects],
  );
  const visibleRelations = projection.relations.filter((relation) =>
    relation.sourceObjectId === selectedObjectId || relation.targetObjectId === selectedObjectId,
  );
  const selectedRelation = projection.relations.find(
    (relation) => relation.id === selectedRelationId,
  );
  const adjacentObjectId = selectedRelation
    ? selectedRelation.sourceObjectId === selectedObjectId
      ? selectedRelation.targetObjectId
      : selectedRelation.sourceObjectId
    : undefined;
  const adjacentObject = allObjects.find((object) => object.id === adjacentObjectId);

  return (
    <div className={styles.networkCanvas}>
      <div className={styles.networkLegend}>
        <span><i className={styles.legendObserved} /> 本次会话已触达</span>
        <span><i className={styles.legendContext} /> 知识网络上下文</span>
      </div>

      <div className={styles.networkColumns}>
        <section className={styles.networkColumn}>
          <header><span>1</span> 业务知识网络</header>
          <button
            type="button"
            className={`${styles.networkNode} ${styles.networkNodeRoot}`}
            aria-label={`${networkName}，展开已触达对象`}
            onClick={() => setObjectsExpanded((expanded) => !expanded)}
          >
            <DeploymentUnitOutlined />
            <span><strong>{networkName}</strong><small>本次会话唯一知识网络</small></span>
            <RightOutlined />
          </button>
          <button
            type="button"
            className={styles.candidateControl}
            aria-label={`${projection.explorationCandidateCount} 个探索候选`}
            onClick={() => setCandidatesExpanded((expanded) => !expanded)}
          >
            <ApiOutlined /> {projection.explorationCandidateCount} 个探索候选
          </button>
          {candidatesExpanded ? (
            <p className={styles.candidateNote}>Schema 搜索返回的候选，仅用于探索；未被后续调用触达的内容不算业务依据。</p>
          ) : null}
        </section>

        <section className={styles.networkColumn}>
          <header><span>2</span> 本次触达对象</header>
          {objectsExpanded ? projection.observedObjects.map((object) => (
            <button
              type="button"
              key={object.id}
              className={`${styles.networkNode} ${styles.networkNodeObserved} ${selectedObjectId === object.id ? styles.networkNodeSelected : ""}`}
              aria-label={`${object.name}，${object.operationIds.length} 次实际查询`}
              onClick={() => {
                setSelectedObjectId(object.id);
                setSelectedRelationId(undefined);
                onSelectObject(object);
              }}
            >
              <DatabaseOutlined />
              <span><strong>{object.name}</strong><small>{object.operationIds.length} 次实际查询</small></span>
              <RightOutlined />
            </button>
          )) : <p className={styles.columnEmpty}>点击知识网络展开对象</p>}
        </section>

        <section className={styles.networkColumn}>
          <header><span>3</span> 关联关系</header>
          {visibleRelations.length ? visibleRelations.map((relation) => (
            <button
              type="button"
              key={relation.id}
              className={`${styles.networkNode} ${styles.networkNodeContext} ${selectedRelationId === relation.id ? styles.networkNodeSelected : ""}`}
              aria-label={`${relation.name}，网络上下文`}
              onClick={() => {
                setSelectedRelationId(relation.id);
                onSelectRelation(relation);
              }}
            >
              <LinkOutlined />
              <span><strong>{relation.name}</strong><small>网络上下文 · 未记录调用</small></span>
              <RightOutlined />
            </button>
          )) : <p className={styles.columnEmpty}>选择一个对象查看真实关系</p>}
        </section>

        <section className={styles.networkColumn}>
          <header><span>4</span> 相邻对象</header>
          {adjacentObject ? (
            <button
              type="button"
              className={`${styles.networkNode} ${styles.networkNodeContext}`}
              aria-label={`${adjacentObject.name}，相邻对象`}
            >
              <DatabaseOutlined />
              <span>
                <strong>{adjacentObject.name}</strong>
                <small>{objectNames.get(selectedObjectId ?? "")} 通过关系可达</small>
              </span>
            </button>
          ) : <p className={styles.columnEmpty}>选择一条关系查看另一端对象</p>}
        </section>
      </div>
    </div>
  );
}
