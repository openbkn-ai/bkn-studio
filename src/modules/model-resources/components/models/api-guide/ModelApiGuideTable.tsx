import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { AppTable } from "@/framework/ui/common/AppTable";

import { ModelApiGuideCopyButton } from "./ModelApiGuideCopyButton";
import styles from "./ModelApiGuideDrawer.module.css";

export type ModelApiGuideTableRow = {
  arguments: string;
  id: string;
  required?: boolean;
  value: string;
};

type ModelApiGuideTableProps = {
  dataSource: ModelApiGuideTableRow[];
};

export function ModelApiGuideTable({ dataSource }: ModelApiGuideTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnsType<ModelApiGuideTableRow>>(
    () => [
      {
        title: t("modelResources.models.apiGuide.arguments"),
        dataIndex: "arguments",
        width: 160,
        render: (_value, row) => (
          <span>
            {row.arguments}
            {row.required ? <span style={{ color: "#ff4d4f", marginLeft: 8 }}>*</span> : null}
          </span>
        ),
      },
      {
        title: t("modelResources.models.apiGuide.value"),
        dataIndex: "value",
        render: (_value, row) => (
          <div className={styles.valueCell}>
            {row.value}
            <ModelApiGuideCopyButton className={styles.valueCopyButton} text={row.value} />
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <AppTable
      bordered
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      rowKey="id"
      size="small"
      style={{ marginTop: 12 }}
    />
  );
}
