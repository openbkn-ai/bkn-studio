/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext } from "react";

import { FALLBACK_ENTITLEMENT, type Entitlement } from "@/framework/entitlement/types";

/**
 * `loading` 只在首次拉取完成前为真。它不是「有没有授权」——那看 `licensed`——而是
 * 「这份快照可不可信」:未知与已知不可用必须分得开,否则企业镜像每次刷新都要先按社区版
 * 渲染一遍再跳回来,而付费入口一闪一灭比慢半拍更糟。
 *
 * 刷新(导证之后)不回到 loading:旧快照仍然可信,只是即将被新的取代。
 */
export type EntitlementStatus = "loading" | "ready";

export type EntitlementContextValue = {
  entitlement: Entitlement;
  /** 重新拉取。导入/激活/删除授权后调用——后端承诺补证免重启,前端就不能要求刷新页面。 */
  refresh: () => void;
  status: EntitlementStatus;
};

/**
 * 默认值是社区版兜底 + `ready`,而不是空值 + `loading`。Provider 没挂上时(单测、
 * 微前端宿主直接挂某个场景)读到的是「社区版 + 无证」,付费入口自然不显示,不需要每个
 * 调用点判空;`ready` 是因为那种场景下没有任何请求在飞,永远等不到第二个值。
 */
export const EntitlementContext = createContext<EntitlementContextValue>({
  entitlement: FALLBACK_ENTITLEMENT,
  refresh: () => {},
  status: "ready",
});
