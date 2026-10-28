/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

export function buildOpenApiToolboxTemplate(t: TFunction) {
  return `openapi: "3.0.3"
info:
  title: "${t("executionFactory.openapiTemplate.toolboxTitle")}"
  version: "1.0.0"
servers:
  - url: "http://127.0.0.1:9000"
paths:
  /sample:
    get:
      summary: "${t("executionFactory.openapiTemplate.toolboxSummary")}"
      responses:
        "200":
          description: "${t("executionFactory.openapiTemplate.successResponse")}"
`;
}
