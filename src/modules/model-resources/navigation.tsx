import {
  AppstoreOutlined,
  BarChartOutlined,
  FundOutlined,
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
      key: "model-statistics",
      labelKey: "shell.items.modelStatistics",
      icon: <BarChartOutlined />,
      path: "/model-resources/statistics",
    },
  ],
};
