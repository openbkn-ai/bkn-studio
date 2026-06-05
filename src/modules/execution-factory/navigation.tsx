import {
  ApiOutlined,
  AppstoreOutlined,
  DeploymentUnitOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const executionFactoryNavigation: ConsoleNavContribution = {
  parentKey: "execution-factory",
  items: [
    {
      key: "execution-unit-management",
      labelKey: "shell.items.executionUnitManagement",
      icon: <DeploymentUnitOutlined />,
      path: "/execution-factory/units",
    },
    {
      key: "all-execution-units",
      labelKey: "shell.items.allExecutionUnits",
      icon: <AppstoreOutlined />,
      path: "/execution-factory/catalog",
    },
    {
      key: "mcp-management",
      labelKey: "shell.items.mcpManagement",
      icon: <ApiOutlined />,
      path: "/execution-factory/mcp",
    },
    {
      key: "skill-management",
      labelKey: "shell.items.skillManagement",
      icon: <ThunderboltOutlined />,
      path: "/execution-factory/skills",
    },
  ],
};
