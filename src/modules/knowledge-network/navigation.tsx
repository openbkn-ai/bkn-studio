import { DeploymentUnitOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const knowledgeNetworkNavigation: ConsoleNavContribution = {
  items: [
    {
      key: "domain-knowledge-network",
      labelKey: "shell.items.domainKnowledgeNetwork",
      icon: <DeploymentUnitOutlined />,
      path: "/knowledge-network",
    },
  ],
};
