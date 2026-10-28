/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import i18n from "@/app/locales/i18n";

export type CategoryOption = {
  categoryType: string;
  name: string;
};

type BackendCategoryItem = {
  category_type: string;
  name: string;
};

const API_PREFIX = "/agent-operator-integration/v1";

function getFallbackCategories(): CategoryOption[] {
  return [
    {
      categoryType: "other_category",
      name: i18n.t("executionFactory.categoryLabels.other_category"),
    },
    {
      categoryType: "system",
      name: i18n.t("executionFactory.categoryLabels.system"),
    },
  ];
}

export async function listCategories(): Promise<CategoryOption[]> {
  try {
    const response = await http.get<BackendCategoryItem[]>(`${API_PREFIX}/category`, {});

    const items = response.data ?? [];

    if (items.length === 0) {
      return getFallbackCategories();
    }

    return items.map((item) => ({
      categoryType: item.category_type,
      name: item.name,
    }));
  } catch {
    return getFallbackCategories();
  }
}
