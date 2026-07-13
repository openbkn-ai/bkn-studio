/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable react-refresh/only-export-components */

import { Tag, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { KnowledgeNetworkTaskState } from "@/modules/knowledge-network/types/knowledge-network";

type TaskStateTagProps = {
  state: KnowledgeNetworkTaskState;
  stateDetail?: string;
};

function getStateColor(state: KnowledgeNetworkTaskState) {
  switch (state) {
    case "running":
      return "processing";
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "canceled":
      return "warning";
    case "pending":
    default:
      return "default";
  }
}

function getStateLabel(state: KnowledgeNetworkTaskState, t: (key: string) => string) {
  switch (state) {
    case "running":
      return t("knowledgeNetwork.taskStateRunning");
    case "completed":
      return t("knowledgeNetwork.taskStateCompleted");
    case "failed":
      return t("knowledgeNetwork.taskStateFailed");
    case "canceled":
      return t("knowledgeNetwork.taskStateCanceled");
    case "pending":
    default:
      return t("knowledgeNetwork.taskStatePending");
  }
}

export function getTaskStateLabel(
  state: KnowledgeNetworkTaskState,
  t: (key: string) => string,
) {
  return getStateLabel(state, t);
}

export function TaskStateTag({ state, stateDetail }: TaskStateTagProps) {
  const { t } = useTranslation();
  const label = getStateLabel(state, t);
  const tag = <Tag color={getStateColor(state)}>{label}</Tag>;

  if ((state === "failed" || state === "canceled") && stateDetail) {
    return <Tooltip title={stateDetail}>{tag}</Tooltip>;
  }

  return tag;
}
