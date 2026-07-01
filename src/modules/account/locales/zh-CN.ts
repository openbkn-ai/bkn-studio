/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const accountZhCN = {
  account: {
    title: "个人中心",
    description: "查看个人资料、修改密码与管理 API 密钥。",
    tabs: {
      profile: "资料",
      security: "安全",
      keys: "API 密钥",
    },
    profileSoon: "个人资料编辑开发中，敬请期待。",
    securitySoon: "自助修改密码开发中，敬请期待。",
    profile: {
      basicTitle: "基本信息",
      basicHint: "可自助修改姓名、邮箱与手机号，立即生效。",
      name: "姓名",
      namePlaceholder: "输入姓名",
      nameRequired: "请输入姓名",
      nameMax: "姓名不能超过 255 个字符",
      email: "邮箱",
      emailPlaceholder: "name@example.com（留空可清除）",
      emailInvalid: "请输入有效的邮箱地址（不含显示名）",
      telephone: "手机号",
      telephonePlaceholder: "输入手机号",
      telephoneMax: "手机号不能超过 64 个字符",
      submit: "保存修改",
      saved: "资料已更新",
      invalid: "信息校验未通过，请检查后重试",
      saveFailed: "保存失败，请重试。",
      accountTitle: "账号信息",
      accountHint: "由管理员维护，只读。",
      account: "登录账号",
      accountType: "账号类型",
      status: "状态",
      enabled: "启用",
      disabled: "停用",
      departments: "部门",
      roles: "角色",
      updatedAt: "更新于",
    },
    security: {
      title: "修改密码",
      hint: "验证当前密码后直接生效，无需重新登录。",
      current: "当前密码",
      currentPlaceholder: "输入当前密码",
      currentRequired: "请输入当前密码",
      next: "新密码",
      nextPlaceholder: "输入新密码",
      nextRequired: "请输入新密码",
      nextMin: "新密码至少 8 位",
      sameAsOld: "新密码不能与当前密码相同",
      confirm: "确认新密码",
      confirmPlaceholder: "再次输入新密码",
      confirmRequired: "请再次输入新密码",
      mismatch: "两次输入的新密码不一致",
      submit: "更新密码",
      success: "密码已更新",
      oldWrong: "当前密码不正确",
      failed: "修改密码失败，请重试。",
    },
  },
} as const;
