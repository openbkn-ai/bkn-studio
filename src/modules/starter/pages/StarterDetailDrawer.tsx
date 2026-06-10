import { Drawer, Space, Typography } from "antd";

import type { StarterRecord } from "@/modules/starter/types/starter";

type StarterDetailDrawerProps = {
  onClose: () => void;
  open: boolean;
  record: StarterRecord | null;
  translations: {
    detailTitle: string;
    name: string;
    owner: string;
    status: string;
    updatedAt: string;
    statusDisabled: string;
    statusEnabled: string;
  };
};

export function StarterDetailDrawer({
  onClose,
  open,
  record,
  translations,
}: StarterDetailDrawerProps) {
  return (
    <Drawer
      onClose={onClose}
      open={open}
      title={translations.detailTitle}
      width={420}
    >
      {record ? (
        <Space direction="vertical" size={16}>
          <div>
            <Typography.Text type="secondary">{translations.name}</Typography.Text>
            <Typography.Paragraph>{record.name}</Typography.Paragraph>
          </div>
          <div>
            <Typography.Text type="secondary">{translations.owner}</Typography.Text>
            <Typography.Paragraph>{record.owner}</Typography.Paragraph>
          </div>
          <div>
            <Typography.Text type="secondary">{translations.status}</Typography.Text>
            <Typography.Paragraph>
              {record.status === "enabled"
                ? translations.statusEnabled
                : translations.statusDisabled}
            </Typography.Paragraph>
          </div>
          <div>
            <Typography.Text type="secondary">{translations.updatedAt}</Typography.Text>
            <Typography.Paragraph>{record.updatedAt}</Typography.Paragraph>
          </div>
        </Space>
      ) : null}
    </Drawer>
  );
}

