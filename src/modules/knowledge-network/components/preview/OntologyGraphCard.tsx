/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Ontology-graph card with graph and right inspector, including selection and empty states. Reused by overview and preview.
 *
 * When objectTypes/relationTypes are absent, load them by networkId for overview pages. Use supplied
 * values directly on preview pages, where they are already loaded, to avoid duplicate requests.
 */

import { DeploymentUnitOutlined } from "@ant-design/icons";
import { Empty, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { OntologyGraphView } from "@/modules/knowledge-network/components/preview/OntologyGraphView";
import { OntologyInspectorPanel } from "@/modules/knowledge-network/components/preview/OntologyInspectorPanel";
import {
  getKnowledgeNetworkConceptGroup,
  listKnowledgeNetworkConceptGroups,
} from "@/modules/knowledge-network/services/concept-group.service";
import {
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { buildModelingPreviewGraph } from "@/modules/knowledge-network/utils/build-modeling-preview-graph";

import styles from "./OntologyGraphCard.module.css";

type OntologyGraphCardProps = {
  loadConceptGroups?: boolean;
  networkId: string;
  objectTypes?: KnowledgeNetworkObjectTypeRecord[];
  onExpandNode?: (id: string) => void;
  relationTypes?: KnowledgeNetworkRelationTypeRecord[];
};

export function OntologyGraphCard({
  loadConceptGroups = true,
  networkId,
  objectTypes: objectTypesProp,
  onExpandNode,
  relationTypes: relationTypesProp,
}: OntologyGraphCardProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const controlled = objectTypesProp !== undefined && relationTypesProp !== undefined;
  const [fetchedObjectTypes, setFetchedObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>(
    [],
  );
  const [fetchedRelationTypes, setFetchedRelationTypes] = useState<
    KnowledgeNetworkRelationTypeRecord[]
  >([]);
  const [loading, setLoading] = useState(!controlled);

  useEffect(() => {
    if (controlled) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSelectedId(null);
    Promise.all([
      listKnowledgeNetworkObjectTypes(networkId),
      listKnowledgeNetworkRelationTypes(networkId),
    ])
      .then(([objects, relations]) => {
        if (!cancelled) {
          setFetchedObjectTypes(objects);
          setFetchedRelationTypes(relations);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedObjectTypes([]);
          setFetchedRelationTypes([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [controlled, networkId]);

  const objectTypes = controlled ? objectTypesProp : fetchedObjectTypes;
  const relationTypes = controlled ? relationTypesProp : fetchedRelationTypes;

  const graph = useMemo(
    () => buildModelingPreviewGraph(objectTypes, relationTypes),
    [objectTypes, relationTypes],
  );

  const indexedIds = useMemo(
    () => new Set(objectTypes.filter((item) => item.hasIndex).map((item) => item.id)),
    [objectTypes],
  );

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    if (id && id !== selectedId) {
      onExpandNode?.(id);
    }
  };

  // Concept-group membership from node to group ID for logical-group clustering. Group details supply member object types.
  const [groupOf, setGroupOf] = useState<Map<string, string>>(new Map());
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!loadConceptGroups) {
      setGroupOf(new Map());
      setGroupNames(new Map());
      return;
    }
    let cancelled = false;
    listKnowledgeNetworkConceptGroups(networkId)
      .then(async (groups) => {
        const details = new Map<
          string,
          Awaited<ReturnType<typeof getKnowledgeNetworkConceptGroup>>
        >();
        let nextIndex = 0;
        const workers = Array.from({ length: Math.min(6, groups.length) }, async () => {
          while (nextIndex < groups.length) {
            const group = groups[nextIndex];
            nextIndex += 1;
            details.set(
              group.id,
              await getKnowledgeNetworkConceptGroup(networkId, group.id).catch(() => null),
            );
          }
        });
        await Promise.all(workers);
        if (cancelled) return;
        const map = new Map<string, string>();
        groups.forEach((group) => {
          details.get(group.id)?.objectTypes.forEach((item) => map.set(item.id, group.id));
        });
        setGroupOf(map);
        setGroupNames(new Map(groups.map((group) => [group.id, group.name])));
      })
      .catch(() => {
        if (!cancelled) {
          setGroupOf(new Map());
          setGroupNames(new Map());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadConceptGroups, networkId]);

  return (
    <div className={styles.graphCard}>
      <div className={styles.graphHeader}>
        <h3 className={styles.graphTitle}>{t("knowledgeNetwork.previewCanvas")}</h3>
        <span className={styles.graphLegend}>
          <DeploymentUnitOutlined />
          {t("knowledgeNetwork.previewGraphLegend")}
        </span>
      </div>

      {loading ? (
        <div className={styles.emptyPanel}>
          <Spin />
        </div>
      ) : graph.nodes.length === 0 ? (
        <div className={styles.emptyPanel}>
          <Empty description={t("knowledgeNetwork.previewEmpty")} />
        </div>
      ) : (
        <div className={styles.graphLayout}>
          <div className={styles.graphCanvas}>
            <OntologyGraphView
              graph={graph}
              indexedIds={indexedIds}
              groupOf={groupOf}
              groupNames={groupNames}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>
          <aside className={styles.graphAside}>
            <OntologyInspectorPanel
              networkId={networkId}
              objectTypes={objectTypes}
              relationTypes={relationTypes}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
