/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";
import {
  knowledgeNetworkChildAuthorizationId,
  type KnowledgeNetworkChildResourceType,
} from "@/modules/knowledge-network/utils/knowledge-network-authz";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

type KnowledgeNetworkAuthorizableRecord = {
  id: string;
  name: string;
  operations?: string[];
};

type KnowledgeNetworkObjectAuthorizeDrawerProps = {
  networkId: string;
  networkName?: string;
  objectType: KnowledgeNetworkChildResourceType;
  onClose: () => void;
  open: boolean;
  record: KnowledgeNetworkAuthorizableRecord | null;
};

/** Reuses the platform object-grant drawer with the KN child resource reference. */
export function KnowledgeNetworkObjectAuthorizeDrawer({
  networkId,
  networkName,
  objectType,
  onClose,
  open,
  record,
}: KnowledgeNetworkObjectAuthorizeDrawerProps) {
  return (
    <ObjectAuthorizeDrawer
      objectAuthorized={hasKnowledgeNetworkRecordOperation(record, "authorize")}
      objId={record ? knowledgeNetworkChildAuthorizationId(networkId, record.id) : ""}
      objName={record?.name ?? ""}
      objSub={networkName ?? networkId}
      objType={objectType}
      onClose={onClose}
      open={open && Boolean(record && networkId)}
    />
  );
}
