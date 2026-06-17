import {
  AppstoreOutlined,
  ClusterOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";

import type { ConsoleNavItem } from "@/app/shell/navigation/types";

export const baseConsoleNavigation: ConsoleNavItem[] = [
  {
    key: "general-business-knowledge-network",
    labelKey: "shell.items.generalBusinessKnowledgeNetwork",
    icon: <AppstoreOutlined />,
    children: [
      {
        key: "data-quality",
        labelKey: "shell.items.dataQuality",
        icon: <SafetyCertificateOutlined />,
        disabled: true,
      },
    ],
  },
  {
    key: "execution-factory",
    labelKey: "shell.items.executionFactory",
    icon: <ClusterOutlined />,
  },
  {
    key: "model-resources",
    labelKey: "shell.items.modelResources",
    icon: <ExperimentOutlined />,
  },
  {
    key: "execution-factory-lab",
    labelKey: "shell.items.executionFactoryLab",
    icon: <ExperimentOutlined />,
  },
  {
    key: "system-management",
    labelKey: "shell.items.systemManagement",
    icon: <SettingOutlined />,
    children: [
      {
        key: "user-management",
        labelKey: "shell.items.userManagement",
        icon: <TeamOutlined />,
        path: "/system/users",
      },
      {
        key: "role-management",
        labelKey: "shell.items.roleManagement",
        icon: <SafetyCertificateOutlined />,
        path: "/system/roles",
      },
      {
        key: "log-management",
        labelKey: "shell.items.logManagement",
        path: "/system/audit",
        icon: <FileTextOutlined />,
      },
    ],
  },
];
