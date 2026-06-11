import { QuestionCircleOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";

import type { ReactNode } from "react";

type LabFilterHintProps = {
  label: ReactNode;
  tooltip: string;
};

export function LabFilterHint({ label, tooltip }: LabFilterHintProps) {
  return (
    <span style={{ alignItems: "center", display: "inline-flex", gap: 4 }}>
      {label}
      <Tooltip title={tooltip}>
        <QuestionCircleOutlined style={{ color: "rgba(0,0,0,0.45)", fontSize: 12 }} />
      </Tooltip>
    </span>
  );
}
