import { appZhCN } from "@/app/locales/resources/app/zh-CN";
import { commonZhCN } from "@/app/locales/resources/common/zh-CN";
import { shellZhCN } from "@/app/locales/resources/shell/zh-CN";
import { dataConnectZhCN } from "@/modules/data-connect/locales/zh-CN";
import { executionFactoryZhCN } from "@/modules/execution-factory/locales/zh-CN";
import { knowledgeNetworkZhCN } from "@/modules/knowledge-network/locales/zh-CN";

export const zhCN = {
  ...commonZhCN,
  ...appZhCN,
  ...shellZhCN,
  ...dataConnectZhCN,
  ...knowledgeNetworkZhCN,
  ...executionFactoryZhCN,
} as const;
