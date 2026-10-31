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
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { OntologyGraphView } from "@/modules/knowledge-network/components/preview/OntologyGraphView";
import { OntologyInspectorPanel } from "@/modules/knowledge-network/components/preview/OntologyInspectorPanel";
import {
  spreadParallelEdges,
  typeColors,
} from "@/modules/knowledge-network/components/preview/ontology-graph-data";
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

const EMPTY_GROUP_MAP = new Map<string, string>();

type OntologyGraphCardProps = {
  emptyDescription?: string;
  /** Types and relations drawn faint and dashed: shown for context, not part of the model. */
  fadedIds?: ReadonlySet<string>;
  fillAvailableHeight?: boolean;
  /** A click opens something over the page: the graph leaves the maximized view first. */
  leaveMaximizedOnSelect?: boolean;
  /** Replaces the header's key to the drawing, for a graph whose marks mean something else. */
  legend?: ReactNode;
  loadConceptGroups?: boolean;
  logicalGrouping?: boolean;
  networkId: string;
  objectTypes?: KnowledgeNetworkObjectTypeRecord[];
  onExpandNode?: (id: string) => void;
  onSelectedIdChange?: (id: string | null) => void;
  /** Draws relations between the same two types apart, rather than as one line over another. */
  parallelEdges?: boolean;
  relationTypes?: KnowledgeNetworkRelationTypeRecord[];
  selectedId?: string | null;
  showInspector?: boolean;
  title?: string;
};

export function OntologyGraphCard({
  emptyDescription,
  fadedIds,
  fillAvailableHeight = false,
  leaveMaximizedOnSelect,
  legend,
  loadConceptGroups = true,
  logicalGrouping = true,
  networkId,
  objectTypes: objectTypesProp,
  onExpandNode,
  onSelectedIdChange,
  parallelEdges = false,
  relationTypes: relationTypesProp,
  selectedId: selectedIdProp,
  showInspector = true,
  title,
}: OntologyGraphCardProps) {
  const { t } = useTranslation();
  const [uncontrolledSelectedId, setUncontrolledSelectedId] = useState<string | null>(null);
  const selectionControlled = selectedIdProp !== undefined;
  const selectedId = selectedIdProp === undefined ? uncontrolledSelectedId : selectedIdProp;

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
    if (!selectionControlled) {
      setUncontrolledSelectedId(null);
    }
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
  }, [controlled, networkId, selectionControlled]);

  const rawObjectTypes = controlled ? objectTypesProp : fetchedObjectTypes;
  // One colour per type for the graph and the panel beside it: its own, or a palette slot.
  const objectTypes = useMemo(() => {
    const colors = typeColors(rawObjectTypes);
    return rawObjectTypes.map((item) => ({ ...item, color: colors.get(item.id) ?? item.color }));
  }, [rawObjectTypes]);
  const relationTypes = controlled ? relationTypesProp : fetchedRelationTypes;

  const graph = useMemo(() => {
    const drawn = buildModelingPreviewGraph(objectTypes, relationTypes);
    const built = parallelEdges ? spreadParallelEdges(drawn) : drawn;
    if (!fadedIds?.size) {
      return built;
    }
    return {
      edges: built.edges.map((edge) => (fadedIds.has(edge.id) ? { ...edge, faded: true } : edge)),
      nodes: built.nodes.map((node) => (fadedIds.has(node.id) ? { ...node, faded: true } : node)),
    };
  }, [fadedIds, objectTypes, parallelEdges, relationTypes]);

  const indexedIds = useMemo(
    () => new Set(objectTypes.filter((item) => item.hasIndex).map((item) => item.id)),
    [objectTypes],
  );

  const handleSelect = (id: string | null) => {
    if (selectedIdProp === undefined) {
      setUncontrolledSelectedId(id);
    }
    onSelectedIdChange?.(id);
    if (id && id !== selectedId) {
      onExpandNode?.(id);
    }
  };

  // Concept-group membership from node to group ID for logical-group clustering. Group details supply member object types.
  const inlineGroups = useMemo(() => {
    const membership = new Map<string, string>();
    const names = new Map<string, string>();
    objectTypes.forEach((objectType) => {
      const groups = objectType.conceptGroupIds
        .map((id, index) => ({ id, name: objectType.conceptGroupNames[index] ?? id }))
        .sort(
          (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
        );
      if (groups[0]) membership.set(objectType.id, groups[0].id);
      groups.forEach((group) => names.set(group.id, group.name));
    });
    return { membership, names };
  }, [objectTypes]);
  const [fetchedGroupOf, setFetchedGroupOf] = useState<Map<string, string>>(new Map());
  const [fetchedGroupNames, setFetchedGroupNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!logicalGrouping || !loadConceptGroups || inlineGroups.membership.size > 0) {
      setFetchedGroupOf(new Map());
      setFetchedGroupNames(new Map());
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
        setFetchedGroupOf(map);
        setFetchedGroupNames(new Map(groups.map((group) => [group.id, group.name])));
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedGroupOf(new Map());
          setFetchedGroupNames(new Map());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [inlineGroups.membership.size, loadConceptGroups, logicalGrouping, networkId]);

  const groupOf = logicalGrouping
    ? inlineGroups.membership.size > 0
      ? inlineGroups.membership
      : fetchedGroupOf
    : EMPTY_GROUP_MAP;
  const groupNames = logicalGrouping
    ? inlineGroups.membership.size > 0
      ? inlineGroups.names
      : fetchedGroupNames
    : EMPTY_GROUP_MAP;

  return (
    <div className={`${styles.graphCard} ${fillAvailableHeight ? styles.graphCardFill : ""}`}>
      <div className={styles.graphHeader}>
        <h3 className={styles.graphTitle}>{title ?? t("knowledgeNetwork.previewCanvas")}</h3>
        <span className={styles.graphLegend}>
          <DeploymentUnitOutlined />
          {legend ?? t("knowledgeNetwork.previewGraphLegend")}
        </span>
      </div>

      {loading ? (
        <div className={styles.emptyPanel}>
          <Spin />
        </div>
      ) : graph.nodes.length === 0 ? (
        <div className={styles.emptyPanel}>
          <Empty description={emptyDescription ?? t("knowledgeNetwork.previewEmpty")} />
        </div>
      ) : (
        <div
          className={`${styles.graphLayout} ${showInspector ? "" : styles.graphLayoutWithoutInspector}`}
        >
          <div className={styles.graphCanvas}>
            <OntologyGraphView
              graph={graph}
              indexedIds={indexedIds}
              groupOf={groupOf}
              groupNames={groupNames}
              selectedId={selectedId}
              onSelect={handleSelect}
              leaveMaximizedOnSelect={leaveMaximizedOnSelect}
            />
          </div>
          {showInspector ? (
            <aside className={styles.graphAside}>
              <OntologyInspectorPanel
                networkId={networkId}
                objectTypes={objectTypes}
                relationTypes={relationTypes}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}
