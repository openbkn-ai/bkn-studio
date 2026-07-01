/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";

const API_PREFIX = "/agent-operator-integration/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? "bd_public";

  return { "x-business-domain": businessDomainId };
}

export async function getPythonCodeTemplate(): Promise<string> {
  if (useMock) {
    return "def handler(event):\n    \"\"\"Handle incoming event payload.\"\"\"\n    return event\n";
  }

  const response = await http.get<{
    code_template?: string;
  }>(`${API_PREFIX}/template/python`, {
    headers: getBusinessDomainHeaders(),
  });

  return response.data.code_template ?? "";
}
