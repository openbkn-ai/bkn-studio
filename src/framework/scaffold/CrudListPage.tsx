import type { PropsWithChildren, ReactNode } from "react";

import { Space, Typography } from "antd";

import { PageContainer } from "@/framework/ui/common/PageContainer";

type CrudListPageProps = PropsWithChildren<{
  title: string;
  description?: string;
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
        <div className="page-title-block">
          <Typography.Title level={3}>{title}</Typography.Title>
          {description ? (
            <Typography.Paragraph className="page-description">
              {description}
            </Typography.Paragraph>
          ) : null}
        </div>
        {toolbar ? <div className="page-toolbar">{toolbar}</div> : null}
        <div className="page-body">{children}</div>
      </Space>
    </PageContainer>
  );
}

