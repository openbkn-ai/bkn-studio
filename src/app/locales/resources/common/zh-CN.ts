/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const commonZhCN = {
  common: {
    search: "搜索",
    reset: "重置",
    refresh: "刷新",
    create: "新建",
    import: "导入",
    copy: "复制",
    viewDetails: "查看详情",
    hideDetails: "收起详情",
    back: "返回",
    backHome: "返回首页",
    previous: "上一步",
    next: "下一步",
    save: "保存",
    confirm: "确定",
    cancel: "取消",
    ok: "确定",
    add: "添加",
    remove: "移除",
    expand: "展开",
    collapse: "收起",
    id: "ID",
    edit: "编辑",
    detail: "详情",
    delete: "删除",
    name: "名称",
    all: "全部",
    tag: "标签",
    total: "共 {{total}} 条",
    status: "状态",
    actions: "操作",
    updatedBy: "更新人",
    updateTime: "更新时间",
    basicInfo: "基础信息",
    advancedConfig: "高级配置",
    enabled: "启用",
    disabled: "停用",
    success: "操作成功",
    required: "该字段不能为空",
    notFound: "未找到对应数据",
    noPermission: "你没有访问当前能力的权限",
    pageNotFound: "页面不存在",
    notFoundDescription: "你访问的页面不存在或已被移动。",
    unexpectedError: "页面发生异常",
    reload: "重新加载",
    requestFailed: "请求失败，请稍后重试。",
    routeErrorDescription: "页面加载或渲染时发生错误，请稍后重试。",
    retry: "重试",
    description: "描述",
    category: "分类",
    mode: "模式",
    healthStatus: "健康状态",
    error: {
      code: "错误码：{{value}}",
      details: "错误详情：{{value}}",
      solution: "解决方案：{{value}}",
      link: "错误链接：{{value}}",
    },
    testConnection: "测试连接",
    dangerDelete: {
      typeNameToConfirm: "此操作高危,请输入名称「{{name}}」以确认删除。",
    },
    entitlement: {
      imageLikelyHint: "已经是{{edition}}证书,请升级{{edition}}镜像以解锁该能力。",
      imageMissingTitle: "{{edition}}授权 — 社区版镜像,需要升级",
      imageMissingHint: "已经是{{edition}}证书,请升级{{edition}}镜像以解锁该能力。",
      unlockTitle: "解锁{{edition}}能力",
      upgradeTo: "升级到{{edition}}",
      upgradeEffect: "导入授权后立即生效,无需重启服务",
      compareEditions: "查看版本对比",
      paidHint: "该能力自 {{edition}} 起提供",
      // 档位门控的文案。与 noPermission 分开:权限不足是「你不行」,档位不足是
      // 「这套部署没买」——前者找管理员,后者找商务,混成一句话谁都不知道该找谁。
      upgradeHint: "该功能属于付费版本,当前集群的授权未包含它",
      notLicensedTitle: "当前授权未包含该功能",
      notLicensedDescription:
        "这套部署具备该功能,但当前证书的版本不覆盖它。导入更高版本的证书后即可使用,无需重启服务。",
      unknownTitle: "无法确认授权状态",
      unknownDescription: "读取集群授权状态失败,付费功能暂时不可用。请稍后重试。",
      /**
       * 中文界面用中文档位名。对外版本说明(飞书《OpenBKN 版本、服务与销售》)里用的是
       * Community / Professional / Enterprise Standard / Industry Solution,对应关系
       * 一一对得上;英文界面见 en-US 那份,那里逐字用对外写法。
       */
      editions: {
        community: "社区版",
        professional: "专业版",
        enterprise: "企业版",
        industry: "行业版",
      },
      /**
       * 徽标位的短名。中文用全称三字(「专业版」而不是「专业」):档位是产品名的一部分,
       * 掉一个字读起来像另一个东西。挤得下靠的是徽标本身小一号(10px/4px padding),
       * 不是砍字。
       */
      editionsShort: {
        community: "社区版",
        professional: "专业版",
        enterprise: "企业版",
        industry: "行业版",
      },
      upgrade: "升级",
      banner: {
        unlicensed: "当前没有可用授权,社区能力照常使用。导入授权文件可解锁付费能力。",
        action: "去处理",
      },
    },
  },
} as const;
