/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useContext } from "react";

import { capabilityState } from "@/framework/entitlement/capability-state";
import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import {
  FALLBACK_ENTITLEMENT,
  type CapabilityState,
  type Entitlement,
} from "@/framework/entitlement/types";

/**
 * 原始快照(可能为 null)+ loading + refresh。
 *
 * 需要区分「未知」和「已知不可用」的地方用它——版本页的「你的集群」列、整页守卫的骨架。
 * 只想知道某个能力能不能用的地方用 `useCapability`,别自己去翻 `snapshot.capabilities`,
 * 那等于把判定逻辑复制一份。
 */
export function useEntitlementContext() {
  return useContext(EntitlementContext);
}

/**
 * 快照的展示读数,缺席时给社区版兜底。**只用于展示**(档位芯片、版本页当前档):它把
 * 「没拿到」和「确实是社区版」抹平成同一个值,判定不能用它。
 */
export function useEntitlement(): Entitlement {
  return useEntitlementContext().snapshot ?? FALLBACK_ENTITLEMENT;
}

/**
 * 重新拉取授权快照。导入 / 激活 / 删除授权成功后调用——后端承诺补证下一个请求即生效,
 * 前端就不该要求用户按 F5。
 */
export function useRefreshEntitlement() {
  return useEntitlementContext().refresh;
}

/**
 * 单个能力的状态。这是**唯一**该被用来做显隐判断的入口。
 *
 * 返回四态而不是布尔:调用方常常要区分「藏起来」和「藏起来但告诉他可以买」,压成布尔
 * 就只能再去翻一次快照。
 */
export function useCapability(capability: string): CapabilityState {
  return capabilityState(capability, useEntitlementContext().snapshot);
}
