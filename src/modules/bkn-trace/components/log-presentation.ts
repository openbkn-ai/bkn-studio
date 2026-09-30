/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { LogRecord } from "@/modules/bkn-trace/services/observability.service";
import {
  formatAuditUserDisplay,
  type AuditUserDisplayInput,
} from "@/framework/audit/audit-user-display";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type LogText = { primary: string; secondary?: string };

export function isAgentConversationCreated(record: LogRecord) {
  return record.eventName === "conversation.created" && record.target.type === "conversation";
}

export function presentLogAction(record: LogRecord, t: Translate) {
  if (isAgentConversationCreated(record))
    return t("bknTrace.logs.auditActions.startAgentConversation");
  const semanticAction = semanticActionKey(record);
  if (semanticAction) {
    const label = t(`bknTrace.logs.semanticActions.${semanticAction}`, { defaultValue: "" });
    if (label && label !== `bknTrace.logs.semanticActions.${semanticAction}`) return label;
  }
  if (record.logCategory === "access.user") {
    const key = `bknTrace.logs.accessActions.${record.action}`;
    const label = t(key, { defaultValue: "" });
    if (label && label !== key) return label;
  }
  if (record.businessModule === "system_management") {
    const targetType = normalizedSystemTargetType(record.target.type);
    const key = `bknTrace.logs.systemManagementActions.${record.action}${targetType}`;
    const label = t(key, { defaultValue: "" });
    if (label && label !== key) return label;
  }
  if (record.businessModule === "domain_knowledge_network") {
    const actionKey = `bknTrace.logs.domainAuditActions.${record.action}`;
    const target = t(`bknTrace.logs.targetTypes.${record.target.type}`, {
      defaultValue: record.target.type,
    });
    const action = t(actionKey, { defaultValue: "", target });
    if (!action || action === actionKey) {
      const fallback = t(`bknTrace.logs.auditActions.${record.action}`, {
        defaultValue: record.action,
      });
      return `${fallback} ${target}`;
    }
    if (record.action === "add_members" || record.action === "remove_members") return action;
    return t("bknTrace.logs.domainAction", { action, target });
  }
  return t(`bknTrace.logs.auditActions.${record.action}`, { defaultValue: record.action });
}

function normalizedSystemTargetType(value: string) {
  const types: Record<string, string> = {
    "api-keys": "ApiKey",
    api_key: "ApiKey",
    license: "License",
    licenses: "License",
    role: "Role",
    roles: "Role",
    user: "User",
    users: "User",
  };
  return types[value] ?? "";
}

export function presentLogTarget(record: LogRecord, t: Translate): LogText {
  if (!isAgentConversationCreated(record)) {
    const targetName = normalizedText(record.target.name);
    const targetID = normalizedText(record.target.id);
    const semanticTarget = semanticTargetKey(record);
    if (
      semanticTarget &&
      (!targetName || isTechnicalTargetName(targetName, targetID, record.target.type))
    ) {
      const label = t(`bknTrace.logs.targetTypes.${semanticTarget}`, {
        defaultValue: t("bknTrace.logs.unnamedTarget"),
      });
      return { primary: label, secondary: targetID || undefined };
    }
    return { primary: targetName || targetID, secondary: targetID };
  }
  const agentName = conversationAgentName(record) || t("bknTrace.logs.unnamedAgent");
  return {
    primary: `${agentName}${t("bknTrace.logs.businessConversationSuffix")}`,
    secondary: `${t("bknTrace.logs.conversationId")} · ${shortIdentifier(record.conversationId || record.target.id)}`,
  };
}

export function presentLogActor(
  record: LogRecord,
  t: Translate,
  currentUser?: AuditUserDisplayInput["currentUser"],
): LogText {
  const actorID = normalizedText(record.actor.id);
  if (record.actor.type === "anonymous" || actorID === "anonymous") {
    return {
      primary: t("bknTrace.logs.actorTypes.anonymous"),
      secondary: presentAuthMethod(record.authMethod, t),
    };
  }
  if (record.actor.type === "service_account" || actorID.startsWith("system:")) {
    const actorName = normalizedText(record.actor.name);
    return {
      primary:
        actorName && actorName !== actorID ? actorName : t("bknTrace.logs.actorTypes.service"),
      secondary: presentAuthMethod(record.authMethod, t),
    };
  }
  return {
    primary: formatAuditUserDisplay({ currentUser, id: record.actor.id, name: record.actor.name }),
    secondary: presentAuthMethod(record.authMethod, t),
  };
}

function semanticActionKey(record: LogRecord) {
  const semanticTarget = semanticTargetKey(record);
  if (record.eventName === "authorization.decided" || semanticTarget === "authorization_decision") {
    return "authorization_decided";
  }
  if (semanticTarget === "permission_request" && record.action === "get") {
    return "permission_request_read";
  }
  return "";
}

function isTechnicalTargetName(name: string, id: string, targetType: string) {
  if (name === id) return true;
  return (
    name.startsWith(`${targetType}:`) ||
    name.startsWith("decision:") ||
    name.startsWith("permission_request:")
  );
}

function semanticTargetKey(record: LogRecord) {
  const targetType = normalizedText(record.target.type);
  const targetID = normalizedText(record.target.id);
  const targetName = normalizedText(record.target.name);
  const hasTargetPrefix = (prefix: string) =>
    targetID.startsWith(prefix) || targetName.startsWith(prefix);

  if (
    targetType === "authorization_decision" ||
    ((record.eventName === "authorization.decided" ||
      (record.logCategory === "audit.security" && record.action === "check")) &&
      hasTargetPrefix("decision:"))
  ) {
    return "authorization_decision";
  }
  if (targetType === "permission_request" || hasTargetPrefix("permission_request:")) {
    return "permission_request";
  }
  if (targetType === "session" && record.logCategory === "access.user") {
    return "session";
  }
  return "";
}

export function presentAuthMethod(value: string, t: Translate) {
  return t(`bknTrace.logs.authMethods.${value || "unknown"}`, { defaultValue: value || "unknown" });
}

export function presentTargetType(record: LogRecord, t: Translate) {
  if (isAgentConversationCreated(record)) return t("bknTrace.logs.targetTypes.agentConversation");
  const semanticTarget = semanticTargetKey(record);
  if (semanticTarget) return t(`bknTrace.logs.targetTypes.${semanticTarget}`);
  return t(`bknTrace.logs.targetTypes.${record.target.type}`, { defaultValue: record.target.type });
}

function conversationAgentName(record: LogRecord) {
  const attributeName =
    typeof record.attributes.agent_name === "string" ? record.attributes.agent_name.trim() : "";
  if (attributeName) return attributeName;
  const projectedName = normalizedText(record.target.name);
  if (
    !projectedName ||
    projectedName === record.target.id ||
    projectedName.startsWith("mcp:") ||
    projectedName === "Agent business conversation"
  )
    return "";
  return projectedName;
}

function shortIdentifier(value: unknown) {
  const normalized = normalizedText(value);
  return normalized.length > 8 ? `${normalized.slice(0, 8)}…` : normalized || "-";
}

function normalizedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
