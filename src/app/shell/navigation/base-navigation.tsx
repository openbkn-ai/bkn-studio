import {
  AppstoreOutlined,
  ClusterOutlined,
  DatabaseOutlined,
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
        key: "data-resource",
        labelKey: "shell.items.dataResource",
        icon: <DatabaseOutlined />,
        disabled: true,
      },
      {
        key: "data-quality",
        labelKey: "shell.items.dataQuality",
        icon: <SafetyCertificateOutlined />,
        disabled: true,
      },
      {
        key: "dataflow",
        labelKey: "shell.items.dataflow",
        icon: <ClusterOutlined />,
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
    key: "system-management",
    labelKey: "shell.items.systemManagement",
    icon: <SettingOutlined />,
    children: [
      {
        key: "user-management",
        labelKey: "shell.items.userManagement",
        icon: <TeamOutlined />,
        disabled: true,
      },
      {
        key: "role-management",
        labelKey: "shell.items.roleManagement",
        icon: <SafetyCertificateOutlined />,
        disabled: true,
      },
      {
        key: "model-management",
        labelKey: "shell.items.modelManagement",
        icon: <AppstoreOutlined />,
        disabled: true,
      },
      {
        key: "traceai",
        labelKey: "shell.items.traceai",
        icon: <ClusterOutlined />,
        disabled: true,
      },
      {
        key: "log-management",
        labelKey: "shell.items.logManagement",
        icon: <FileTextOutlined />,
        disabled: true,
      },
    ],
  },
];
