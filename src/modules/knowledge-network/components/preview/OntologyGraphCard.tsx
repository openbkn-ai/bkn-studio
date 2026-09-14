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
import { hasServingResourceIndex } from "@/modules/knowledge-network/utils/resource-index-state";
import type { ResourceLocalIndexStatus } from "@/modules/data-catalog/types/data-catalog";

import styles from "./OntologyGraphCard.module.css";

type OntologyGraphCardProps = {
  localIndexStatusByResourceId?: Map<string, ResourceLocalIndexStatus | undefined>;
  networkId: string;
  objectTypes?: KnowledgeNetworkObjectTypeRecord[];
  relationTypes?: KnowledgeNetworkRelationTypeRecord[];
  resourceIndexLoading?: boolean;
};

export function OntologyGraphCard({
  localIndexStatusByResourceId,
  networkId,
  objectTypes: objectTypesProp,
  relationTypes: relationTypesProp,
  resourceIndexLoading = false,
}: OntologyGraphCardProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const controlled = objectTypesProp !== undefined && relationTypesProp !== undefined;
  const [fetchedObjectTypes, setFetchedObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [fetchedRelationTypes, setFetchedRelationTypes] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
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

  const indexedIds = useMemo(() => {
    if (localIndexStatusByResourceId) {
      return new Set(
        objectTypes
          .filter((item) => {
            const resourceId = item.dataSource?.id;
            if (!resourceId) {
              return false;
            }
            return hasServingResourceIndex(localIndexStatusByResourceId.get(resourceId));
          })
          .map((item) => item.id),
      );
    }

    return new Set(objectTypes.filter((item) => item.hasIndex).map((item) => item.id));
  }, [localIndexStatusByResourceId, objectTypes]);

  // Concept-group membership from node to group ID for logical-group clustering. Group details supply member object types.
  const [groupOf, setGroupOf] = useState<Map<string, string>>(new Map());
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let cancelled = false;
    listKnowledgeNetworkConceptGroups(networkId)
      .then(async (groups) => {
        const details = await Promise.all(
          groups.map((group) =>
            getKnowledgeNetworkConceptGroup(networkId, group.id).catch(() => null),
          ),
        );
        if (cancelled) return;
        const map = new Map<string, string>();
        details.forEach((detail, index) => {
          detail?.objectTypes.forEach((item) => map.set(item.id, groups[index].id));
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
  }, [networkId]);

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
              onSelect={setSelectedId}
            />
          </div>
          <aside className={styles.graphAside}>
            <OntologyInspectorPanel
              localIndexStatusByResourceId={localIndexStatusByResourceId}
              networkId={networkId}
              objectTypes={objectTypes}
              relationTypes={relationTypes}
              resourceIndexLoading={resourceIndexLoading}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
