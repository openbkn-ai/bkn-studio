/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ButtonProps } from "antd";
import type { ReactNode } from "react";

import { AppButton } from "@/framework/ui/common/AppButton";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

type OperationRecord = {
  operations?: string[];
};

export type KnowledgeNetworkResourceDetailAction = {
  danger?: boolean;
  key: string;
  label: ReactNode;
  onClick: () => void;
  operation: string;
  type?: ButtonProps["type"];
};

type KnowledgeNetworkResourceDetailActionsProps = {
  actions: KnowledgeNetworkResourceDetailAction[];
  record: OperationRecord;
};

export function KnowledgeNetworkResourceDetailActions({
  actions,
  record,
}: KnowledgeNetworkResourceDetailActionsProps) {
  const visibleActions = actions.filter((action) =>
    hasKnowledgeNetworkRecordOperation(record, action.operation),
  );

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <>
      {visibleActions.map((action) => (
        <AppButton
          danger={action.danger}
          key={action.key}
          onClick={action.onClick}
          type={action.type}
        >
          {action.label}
        </AppButton>
      ))}
    </>
  );
}
