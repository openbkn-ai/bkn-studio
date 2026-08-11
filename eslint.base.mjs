/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export const ignoreConfig = {
  ignores: ["dist", "node_modules", "scripts/**", "tests/e2e/**", "tests/execution-factory/**"],
};

export const reactPluginConfig = {
  plugins: {
    "react-hooks": reactHooks,
    "react-refresh": reactRefresh,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
  },
};

export function createTypeScriptConfig({ typeChecked }) {
  return {
    extends: [
      js.configs.recommended,
      ...(typeChecked
        ? tseslint.configs.recommendedTypeChecked
        : tseslint.configs.recommended),
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      ...(typeChecked
        ? {
            parserOptions: {
              project: ["./tsconfig.app.json", "./tsconfig.node.json"],
              tsconfigRootDir: import.meta.dirname,
            },
          }
        : {}),
    },
    ...reactPluginConfig,
    rules: {
      ...reactPluginConfig.rules,
      // 禁止按证书的 features[] 做显隐判断。
      //
      // 授权按**档位**判(服务端 entitlement.AtLeast),证书里的 features[] 只发不
      // 判——它是展示与审计核对用的原文。按它显隐等于把细粒度授权从后门放回来,
      // 而且放在最没有强制力的一层:前端那行判断谁都能改,还会在「社区镜像 + 专业
      // 证」这种真实部署下显示一个点进去必然 404 的入口(证书里有 key,镜像里没有
      // 那段代码)。10.211.55.4 现在就是这种部署。
      //
      // 服务端已经在两处写死这条纪律(API 文档、Features() 的 doc comment),这是
      // 第三处——也是唯一能自动拦住的一处。要按能力显隐,用 useCapability()。
      // 见 bkn-docs docs/shared/licensing/ee-design.md §3.2。
      //
      // 只拦得住 `x.features.includes(...)` 这种形状;解构之后的裸 `features` 拦
      // 不到。那一半由类型收口(useEntitlement 不透出 features)。
      "no-restricted-syntax": [
        "error",
        {
          message:
            "禁止按 license 的 features[] 判断显隐:授权按档位,features 只发不判。改用 useCapability() / CapabilityGate(framework/entitlement)。见 ee-design.md §3.2。",
          selector:
            "CallExpression[callee.property.name=/^(includes|indexOf|some|find|filter)$/][callee.object.property.name='features']",
        },
      ],
      ...(typeChecked
        ? {
            "@typescript-eslint/no-unsafe-argument": "warn",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-return": "warn",
            "@typescript-eslint/restrict-template-expressions": "warn",
          }
        : {}),
    },
  };
}
