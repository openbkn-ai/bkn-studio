import { appEnUS } from "@/app/locales/resources/app/en-US";
import { commonEnUS } from "@/app/locales/resources/common/en-US";
import { shellEnUS } from "@/app/locales/resources/shell/en-US";
import { dataConnectEnUS } from "@/modules/data-connect/locales/en-US";
import { executionFactoryEnUS } from "@/modules/execution-factory/locales/en-US";
import { knowledgeNetworkEnUS } from "@/modules/knowledge-network/locales/en-US";

export const enUS = {
  ...commonEnUS,
  ...appEnUS,
  ...shellEnUS,
  ...dataConnectEnUS,
  ...knowledgeNetworkEnUS,
  ...executionFactoryEnUS,
} as const;
