/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";

import type { RelationPropertyChange } from "./RelationTypeMappingEditor";

const PREFIX = "knowledgeNetwork.relationDeclarations.mappingChange";

/**
 * Asks before a mapping change the stored relation properties would not survive: making the
 * relation direct deletes them, and a new backing resource must have the columns they read.
 */
export function useRelationPropertyGuard() {
  const { t } = useTranslation();
  const { modal } = useAppServices();

  return useCallback(
    (change: RelationPropertyChange) =>
      new Promise<boolean>((resolve) => {
        const resource = change.kind === "resource";
        void modal.confirm({
          cancelText: t("common.cancel"),
          centered: true,
          content: !resource
            ? t(`${PREFIX}.toDirect`, { count: change.count })
            : change.missing.length
              ? t(`${PREFIX}.resourceMissing`, {
                  names: change.missing
                    .map((property) => property.displayName || property.name)
                    .join(t("knowledgeNetwork.relationDeclarations.separator")),
                  resource: change.resourceName,
                })
              : t(`${PREFIX}.resourceKept`, {
                  count: change.count,
                  resource: change.resourceName,
                }),
          okButtonProps: { danger: !resource || change.missing.length > 0 },
          okText: resource ? t(`${PREFIX}.resourceOk`) : t(`${PREFIX}.toDirectOk`),
          onCancel: () => resolve(false),
          onOk: () => resolve(true),
          title: resource ? t(`${PREFIX}.resourceTitle`) : t(`${PREFIX}.toDirectTitle`),
        });
      }),
    [modal, t],
  );
}
