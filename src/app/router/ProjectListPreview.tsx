/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Card, Skeleton, Typography } from "antd";
import { useTranslation } from "react-i18next";

/** What project management looks like, drawn behind the upgrade mask: shapes, no data. */
export function ProjectListPreview() {
  const { t } = useTranslation();
  return (
    <div style={{ display: "grid", gap: 16, padding: 24 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {t("shell.items.bknProject")}
      </Typography.Title>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <Card key={card}>
            <Skeleton active={false} paragraph={{ rows: 3 }} title />
          </Card>
        ))}
      </div>
    </div>
  );
}
