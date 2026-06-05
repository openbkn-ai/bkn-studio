import { ApiOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const dataConnectNavigation: ConsoleNavContribution = {
  parentKey: "general-business-knowledge-network",
  items: [
    {
      key: "data-connection",
      labelKey: "shell.items.dataConnection",
      icon: <ApiOutlined />,
      path: "/data-connect",
    },
  ],
};
