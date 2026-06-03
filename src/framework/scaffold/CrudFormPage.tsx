import type { PropsWithChildren, ReactNode } from "react";

import { Space, Typography } from "antd";

import { PageContainer } from "@/framework/ui/common/PageContainer";

type CrudFormPageProps = PropsWithChildren<{
  actions?: ReactNode;
  description?: string;
  title: string;
}>;

export function CrudFormPage({
  actions,
  children,
  description,
  title,
}: CrudFormPageProps) {
  return (
    <PageContainer>
      <Space className="page-section" direction="vertical" size={20}>
        <div className="page-title-block">
          <Typography.Title level={3}>{title}</Typography.Title>
          {description ? (
            <Typography.Paragraph className="page-description">
              {description}
            </Typography.Paragraph>
          ) : null}
        </div>
        <div className="page-body">{children}</div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </Space>
    </PageContainer>
  );
}

