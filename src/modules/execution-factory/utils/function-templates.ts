/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type FunctionTemplateId = "standard" | "pydantic";

/**
 * sandbox_sdk 的 `@tool` 写法：用普通带类型注解的函数，SDK 负责把 event 解包成形参。
 * 参数定义由后端从签名 + 注解 + docstring 推导，所以模版里的类型标注不是装饰。
 */
const STANDARD_TEMPLATE = `from sandbox_sdk import tool

@tool
def my_function(param: str, count: int = 1) -> dict:
    """一句话说清这个函数做什么、返回什么 —— Agent 靠它判断何时调用"""
    # 形参的类型注解会被推导成入参声明，带默认值的即选填
    print("debug:", param)  # print 会进 stdout
    return {"result": param, "count": count}
`;

/** 入参有嵌套结构时用 pydantic 模型声明，推导出来就是嵌套的 sub_parameters。 */
const PYDANTIC_TEMPLATE = `from sandbox_sdk import tool
from pydantic import BaseModel

class MyInput(BaseModel):
    name: str
    count: int = 1

@tool
def my_function(data: MyInput) -> dict:
    """一句话说清这个函数做什么、返回什么 —— Agent 靠它判断何时调用"""
    return {"name": data.name, "count": data.count}
`;

export const FUNCTION_TEMPLATES: Record<FunctionTemplateId, string> = {
  standard: STANDARD_TEMPLATE,
  pydantic: PYDANTIC_TEMPLATE,
};

export const DEFAULT_FUNCTION_TEMPLATE = STANDARD_TEMPLATE;
