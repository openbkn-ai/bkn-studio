import { DatabaseOutlined, ThunderboltOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const dataCatalogNavigation: ConsoleNavContribution = {
  parentKey: "general-business-knowledge-network",
  items: [
    {
      key: "data-catalog",
      labelKey: "shell.items.dataCatalog",
      icon: <DatabaseOutlined />,
      path: "/data-catalog",
    },
    {
      key: "index-build",
      labelKey: "shell.items.indexBuild",
      icon: <ThunderboltOutlined />,
      path: "/index-builds",
    },
  ],
};
