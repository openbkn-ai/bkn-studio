/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowLeftOutlined } from "@ant-design/icons";
import type { PropsWithChildren, ReactNode } from "react";

import { Button, Space, Typography } from "antd";

import { PageContainer } from "@/framework/ui/common/PageContainer";

type CrudFormPageProps = PropsWithChildren<{
  actions?: ReactNode;
  description?: string;
  onBack?: () => void;
  title?: string;
}>;

export function CrudFormPage({
  actions,
  children,
  description,
  onBack,
  title,
}: CrudFormPageProps) {
  return (
    <PageContainer>
      <Space className="page-section" direction="vertical" size={20}>
        {title || onBack ? (
          <div className="page-title-block">
            <Space align="center" size={4}>
              {onBack ? (
                <Button
                  aria-label="back"
                  icon={<ArrowLeftOutlined />}
                  onClick={onBack}
                  type="text"
                />
              ) : null}
              {title ? (
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {title}
                </Typography.Title>
              ) : null}
            </Space>
            {description ? (
              <Typography.Paragraph className="page-description">
                {description}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
        <div className="page-body">{children}</div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </Space>
    </PageContainer>
  );
}
