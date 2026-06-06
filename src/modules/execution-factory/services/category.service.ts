import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";

export type OperatorCategoryOption = {
  categoryType: string;
  name: string;
};

type BackendCategoryItem = {
  category_type: string;
  name: string;
};

const API_PREFIX = "/agent-operator-integration/v1";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";

const fallbackCategories: OperatorCategoryOption[] = [
  { categoryType: "other_category", name: "其他" },
  { categoryType: "system", name: "系统工具" },
];

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

export async function listOperatorCategories(): Promise<OperatorCategoryOption[]> {
  try {
    const response = await http.get<BackendCategoryItem[]>(
      `${API_PREFIX}/operator/category`,
      { headers: getBusinessDomainHeaders() },
    );

    const items = response.data ?? [];

    if (items.length === 0) {
      return fallbackCategories;
    }

    return items.map((item) => ({
      categoryType: item.category_type,
      name: item.name,
    }));
  } catch {
    return fallbackCategories;
  }
}
