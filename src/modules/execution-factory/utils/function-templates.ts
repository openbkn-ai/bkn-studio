/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type FunctionTemplateId = "standard" | "pydantic";

/**
 * sandbox_sdk `@tool` usage: write a normal typed function and let the SDK
 * unpack event payloads into function parameters. Backend parameter inference
 * uses the signature, annotations, and docstring, so type annotations matter.
 */
const STANDARD_TEMPLATE = `from sandbox_sdk import tool

@tool
def my_function(param: str, count: int = 1) -> dict:
    """Describe what this function does and returns so the Agent knows when to call it."""
    # Type annotations are inferred as input declarations; default values are optional inputs.
    print("debug:", param)  # print output goes to stdout
    return {"result": param, "count": count}
`;

/** Use a pydantic model for nested input structures; it infers nested sub_parameters. */
const PYDANTIC_TEMPLATE = `from sandbox_sdk import tool
from pydantic import BaseModel

class MyInput(BaseModel):
    name: str
    count: int = 1

@tool
def my_function(data: MyInput) -> dict:
    """Describe what this function does and returns so the Agent knows when to call it."""
    return {"name": data.name, "count": data.count}
`;

export const FUNCTION_TEMPLATES: Record<FunctionTemplateId, string> = {
  standard: STANDARD_TEMPLATE,
  pydantic: PYDANTIC_TEMPLATE,
};

export const DEFAULT_FUNCTION_TEMPLATE = STANDARD_TEMPLATE;
