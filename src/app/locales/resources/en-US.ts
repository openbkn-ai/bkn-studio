import { appEnUS } from "@/app/locales/resources/app/en-US";
import { authEnUS } from "@/app/locales/resources/auth/en-US";
import { commonEnUS } from "@/app/locales/resources/common/en-US";
import { shellEnUS } from "@/app/locales/resources/shell/en-US";
import { dataCatalogEnUS } from "@/modules/data-catalog/locales/en-US";
import { dataConnectEnUS } from "@/modules/data-connect/locales/en-US";
import { executionFactoryEnUS } from "@/modules/execution-factory/locales/en-US";
import { knowledgeNetworkEnUS } from "@/modules/knowledge-network/locales/en-US";
import { modelResourcesEnUS } from "@/modules/model-resources/locales/en-US";

export const enUS = {
  ...commonEnUS,
  ...appEnUS,
  ...authEnUS,
  ...shellEnUS,
  ...dataConnectEnUS,
  ...dataCatalogEnUS,
  ...knowledgeNetworkEnUS,
  ...executionFactoryEnUS,
  ...modelResourcesEnUS,
} as const;
