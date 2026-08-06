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
      // 档位门控的文案。与 noPermission 分开:权限不足是「你不行」,档位不足是
      // 「这套部署没买」——前者找管理员,后者找商务,混成一句话谁都不知道该找谁。
      upgradeHint: "该功能属于付费版本,当前集群的授权未包含它",
      notLicensedTitle: "当前授权未包含该功能",
      notLicensedDescription:
        "这套部署具备该功能,但当前证书的版本不覆盖它。导入更高版本的证书后即可使用,无需重启服务。",
      unknownTitle: "无法确认授权状态",
      unknownDescription: "读取集群授权状态失败,付费功能暂时不可用。请稍后重试。",
      /**
       * 档位名跟对外版本说明逐字一致(飞书《OpenBKN 版本、服务与销售》):产品名不翻译,
       * 客户拿着报价单对产品页,两边写法不同会被当成两回事。
       */
      editions: {
        community: "Community",
        professional: "Professional",
        enterprise: "Enterprise Standard",
        industry: "Industry Solution",
      },
      /** 侧栏徽标位只有一个词的宽度,取档位名的首词——仍是同一套名字,不另造中文短名。 */
      editionsShort: {
        community: "Community",
        professional: "Professional",
        enterprise: "Enterprise",
        industry: "Industry",
      },
      upgrade: "升级",
      banner: {
        unlicensed: "当前没有可用授权,社区能力照常使用。导入授权文件可解锁付费能力。",
        action: "去处理",
      },
    },
  },
} as const;
