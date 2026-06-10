import {
  AppstoreOutlined,
  BarChartOutlined,
  FundOutlined,
  StarOutlined,
} from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const modelResourcesNavigation: ConsoleNavContribution = {
  parentKey: "model-resources",
  items: [
    {
      key: "model-resource-management",
      labelKey: "shell.items.modelManagement",
      icon: <AppstoreOutlined />,
      path: "/model-resources/models",
    },
    {
      key: "quota-management",
      labelKey: "shell.items.quotaManagement",
      icon: <FundOutlined />,
      path: "/model-resources/quotas",
    },
    {
      key: "default-model",
      labelKey: "shell.items.defaultModel",
      icon: <StarOutlined />,
      path: "/model-resources/default-model",
    },
    {
      key: "model-statistics",
      labelKey: "shell.items.modelStatistics",
      icon: <BarChartOutlined />,
      path: "/model-resources/statistics",
    },
  ],
};
