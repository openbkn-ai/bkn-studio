/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext } from "react";

import { FALLBACK_ENTITLEMENT, type Entitlement } from "@/framework/entitlement/types";

/**
 * 默认值就是社区版兜底,而不是 `null`。Provider 没挂上时(单测、微前端宿主直接挂
 * 某个场景)读到的是「社区版 + 无证」,付费入口自然不显示,不需要每个调用点判空。
 */
export const EntitlementContext = createContext<Entitlement>(FALLBACK_ENTITLEMENT);
