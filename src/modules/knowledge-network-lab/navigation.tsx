import { ExperimentOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";

export const knowledgeNetworkLabNavigation: ConsoleNavContribution = {
  items: [
    {
      key: "domain-knowledge-network-lab",
      labelKey: "shell.items.domainKnowledgeNetworkLab",
      icon: <ExperimentOutlined />,
      path: "/knowledge-network-lab",
    },
  ],
};
