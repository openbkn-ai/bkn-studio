/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren, ReactNode } from "react";

import { Space, Typography } from "antd";

import { PageContainer } from "@/framework/ui/common/PageContainer";

type CrudListPageProps = PropsWithChildren<{
  description?: string;
  title?: string;
  toolbar?: ReactNode;
}>;

export function CrudListPage({
  children,
  title,
  description,
  toolbar,
}: CrudListPageProps) {
  return (
    <PageContainer>
      <Space className="page-section" direction="vertical" size={20}>
        {title ? (
          <div className="page-title-block">
            <Typography.Title level={3}>{title}</Typography.Title>
            {description ? (
              <Typography.Paragraph className="page-description">
                {description}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
        {toolbar ? <div className="page-toolbar">{toolbar}</div> : null}
        <div className="page-body">{children}</div>
      </Space>
    </PageContainer>
  );
}
