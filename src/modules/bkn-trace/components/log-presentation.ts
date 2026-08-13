/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { LogRecord } from "@/modules/bkn-trace/services/observability.service";
import { getRuntimeConfig } from "@/framework/runtime/config";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type LogText = { primary: string; secondary?: string };

export function isAgentConversationCreated(record: LogRecord) {
  return record.eventName === "conversation.created" && record.target.type === "conversation";
}

export function presentLogAction(record: LogRecord, t: Translate) {
  if (isAgentConversationCreated(record)) return t("bknTrace.logs.auditActions.startAgentConversation");
  if (record.businessModule === "domain_knowledge_network") {
    const actionKey = `bknTrace.logs.domainAuditActions.${record.action}`;
    const target = t(`bknTrace.logs.targetTypes.${record.target.type}`, { defaultValue: record.target.type });
    const action = t(actionKey, { defaultValue: "", target });
    if (!action || action === actionKey) {
      const fallback = t(`bknTrace.logs.auditActions.${record.action}`, { defaultValue: record.action });
      return `${fallback} ${target}`;
    }
    if (record.action === "add_members" || record.action === "remove_members") return action;
    return t("bknTrace.logs.domainAction", { action, target });
  }
  return t(`bknTrace.logs.auditActions.${record.action}`, { defaultValue: record.action });
}

export function presentLogTarget(record: LogRecord, t: Translate): LogText {
  if (!isAgentConversationCreated(record)) {
    return { primary: record.target.name || record.target.id, secondary: record.target.id };
  }
  const agentName = conversationAgentName(record) || t("bknTrace.logs.unnamedAgent");
  return {
    primary: `${agentName}${t("bknTrace.logs.businessConversationSuffix")}`,
    secondary: `${t("bknTrace.logs.conversationId")} · ${shortIdentifier(record.conversationId || record.target.id)}`,
  };
}

export function presentLogActor(record: LogRecord, t: Translate, userDirectory?: Map<string, string>): LogText {
  const name = record.actor.name.trim();
  const id = record.actor.id.trim();
  const directoryName = userDirectory?.get(id)?.trim();
  const currentUser = getRuntimeConfig().currentUser;
  const currentUserName = currentUser.id === id ? currentUser.name?.trim() : "";
  const primary = name && name !== id
    ? name
    : directoryName || currentUserName || id || "-";
  return { primary, secondary: presentAuthMethod(record.authMethod, t) };
}

export function presentAuthMethod(value: string, t: Translate) {
  return t(`bknTrace.logs.authMethods.${value || "unknown"}`, { defaultValue: value || "unknown" });
}

export function presentTargetType(record: LogRecord, t: Translate) {
  if (isAgentConversationCreated(record)) return t("bknTrace.logs.targetTypes.agentConversation");
  return t(`bknTrace.logs.targetTypes.${record.target.type}`, { defaultValue: record.target.type });
}

function conversationAgentName(record: LogRecord) {
  const attributeName = typeof record.attributes.agent_name === "string"
    ? record.attributes.agent_name.trim()
    : "";
  if (attributeName) return attributeName;
  const projectedName = record.target.name.trim();
  if (!projectedName || projectedName === record.target.id || projectedName.startsWith("mcp:") || projectedName === "Agent business conversation") return "";
  return projectedName;
}

function shortIdentifier(value: string) {
  const normalized = value.trim();
  return normalized.length > 8 ? `${normalized.slice(0, 8)}…` : normalized || "-";
}
