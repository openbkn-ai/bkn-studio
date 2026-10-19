/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { AgentConfigListScene } from "@/modules/system-admin/scenes/AgentConfigListScene";
import { AgentConfigScene } from "@/modules/system-admin/scenes/AgentConfigScene";

export function AgentConfigPage() {
  return <AgentConfigListScene />;
}

export function AgentConfigDetailPage() {
  const { agentId = "" } = useParams();
  // Keyed so switching Agents starts from a clean form.
  return <AgentConfigScene agentId={agentId} key={agentId} />;
}
