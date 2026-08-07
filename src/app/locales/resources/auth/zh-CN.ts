/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const authZhCN = {
  auth: {
    signInSubtitle: "登录后访问业务知识网络控制台",
    signInButton: "登录",
    devTokenToggle: "使用 Token 登录（开发模式）",
    callbackProcessing: "正在完成登录...",
    callbackErrorTitle: "登录失败",
    backToSignIn: "返回登录",
    logout: "退出登录",
    devTokenAccessRequired: "请填写 Access Token",
    devTokenTitle: "开发环境 Token 配置",
    devTokenDescription:
      "当前为远程联调模式（Mock 已关闭）。请粘贴从测试环境获取的 Bearer Token，保存后即可访问 API。",
    devTokenEnvPrefix: "也可在",
    devTokenEnvMiddle: "中设置",
    devTokenEnvSuffix: "，重启 dev server 后自动生效。",
    devTokenAccessPlaceholder: "粘贴 access_token（不含 Bearer 前缀）",
    devTokenRefreshLabel: "Refresh Token（可选）",
    devTokenRefreshPlaceholder: "可选，用于 token 过期后刷新",
    devTokenSave: "保存并进入",
  },
} as const;
