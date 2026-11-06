/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export { knowledgeNetworkModuleManifest } from "@/modules/knowledge-network/module.manifest";
export type {
  KnowledgeNetworkListSceneProps,
  KnowledgeNetworkWorkspaceSceneProps,
  KnowledgeNetworkWorkspaceSection,
} from "@/modules/knowledge-network/contracts/scenes";
export { KnowledgeNetworkListScene } from "@/modules/knowledge-network/scenes/KnowledgeNetworkListScene";
export {
  actionTypeCreatedState,
  readActionTypeContext,
} from "@/modules/knowledge-network/lib/action-type-context";
export type { ActionTypeNavigationContext } from "@/modules/knowledge-network/lib/action-type-context";
export {
  objectMetricCreatedState,
  readObjectMetricContext,
} from "@/modules/knowledge-network/lib/object-metric-context";
export type { ObjectMetricNavigationContext } from "@/modules/knowledge-network/lib/object-metric-context";
export { ObjectMetricDetailScene } from "@/modules/knowledge-network/scenes/ObjectMetricDetailScene";
export { ObjectMetricFormScene } from "@/modules/knowledge-network/scenes/ObjectMetricFormScene";
export { KnowledgeNetworkWorkspaceScene } from "@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene";
export type * from "@/modules/knowledge-network/types/knowledge-network";
export type * from "@/modules/knowledge-network/types/object-metric";
