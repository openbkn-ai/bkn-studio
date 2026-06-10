import type { KnowledgeNetworkActionTypeKind } from "@/modules/knowledge-network/types/knowledge-network";

/** Vega ActionTypeEnum: add / modify / delete */
export const ACTION_TYPE_KIND_FORM_VALUES = [
  "create",
  "update",
  "delete",
] as const satisfies readonly KnowledgeNetworkActionTypeKind[];

export function buildActionTypeKindSelectOptions(t: (key: string) => string) {
  return ACTION_TYPE_KIND_FORM_VALUES.map((value) => ({
    label:
      value === "create"
        ? t("knowledgeNetwork.actionTypeKindCreate")
        : value === "update"
          ? t("knowledgeNetwork.actionTypeKindUpdate")
          : t("knowledgeNetwork.actionTypeKindDelete"),
    value,
  }));
}
