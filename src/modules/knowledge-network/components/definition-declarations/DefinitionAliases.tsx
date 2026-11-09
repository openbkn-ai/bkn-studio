/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tag } from "antd";
import { useTranslation } from "react-i18next";

/** The aliases of a definition on its detail page, one tag each. */
export function DefinitionAliases({
  aliases,
  emptyClassName,
  rowClassName,
}: {
  aliases: readonly string[] | undefined;
  emptyClassName?: string;
  rowClassName?: string;
}) {
  const { t } = useTranslation();
  if (!aliases?.length) {
    return (
      <span className={emptyClassName}>
        {t("knowledgeNetwork.definitionDeclarations.noAliases")}
      </span>
    );
  }
  return (
    <div className={rowClassName}>
      {aliases.map((alias) => (
        <Tag key={alias}>{alias}</Tag>
      ))}
    </div>
  );
}
