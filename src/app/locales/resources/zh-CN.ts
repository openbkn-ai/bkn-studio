import { appZhCN } from "@/app/locales/resources/app/zh-CN";
import { authZhCN } from "@/app/locales/resources/auth/zh-CN";
import { commonZhCN } from "@/app/locales/resources/common/zh-CN";
import { shellZhCN } from "@/app/locales/resources/shell/zh-CN";
import { dataCatalogZhCN } from "@/modules/data-catalog/locales/zh-CN";
import { dataConnectZhCN } from "@/modules/data-connect/locales/zh-CN";
import { executionFactoryZhCN } from "@/modules/execution-factory/locales/zh-CN";
import { knowledgeNetworkZhCN } from "@/modules/knowledge-network/locales/zh-CN";
import { modelResourcesZhCN } from "@/modules/model-resources/locales/zh-CN";

export const zhCN = {
  ...commonZhCN,
  ...appZhCN,
  ...authZhCN,
  ...shellZhCN,
  ...dataConnectZhCN,
  ...dataCatalogZhCN,
  ...knowledgeNetworkZhCN,
  ...executionFactoryZhCN,
  ...modelResourcesZhCN,
} as const;
