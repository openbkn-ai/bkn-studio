/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const apiResourceZhCN = {
  invocation: {
    filter: "指定过滤条件",
    noFilterableFields: "请在「输出字段」中为至少一个支持过滤的字段开启「允许过滤」。",
    noPagingRule: "请先在「API 信息」中配置分页规则。",
    validation: "本次保存验证输入",
    validationHint: "仅在新建资源或修改 API 定义、字段映射时用于本次验证，不保存到资源定义。",
  },
  table: {
    field: "配置项",
    variable: "变量名",
    sensitive: "敏感",
    protected: "敏感值已隐藏",
    emptyArray: "空数组",
    emptyObject: "空对象",
    emptyString: "空字符串",
    additional: "其他配置",
    responseHeaders: "响应 Header",
    schema: "响应 Schema",
    conditions: "子条件",
  },
  notConfigured: "未配置",
  pageSize: "每页条数",

  mockTestHint: "仅模拟已保存定义的示例数据，不验证未保存草稿、登录或真实上游响应。",
  mockHint:
    "Mock 演示：配置仅保存在当前页面会话，刷新页面后重置；保存与测试结果均为模拟，不访问上游服务。",
  mockSaved: "Mock 配置已保存，未执行真实上游验证。",
  emptyCatalog: "暂无 API 资源。创建只读 API 资源以配置请求与输出映射。",
  create: "创建 API 资源",
  edit: "编辑 API 资源",
  configuration: "API 资源配置",
  definition: "API 信息",
  name: "资源名称",
  mappingHint: "对象行按原始字段名映射，数组行按字段顺序映射。",
  outputFields: "输出字段",
  fieldName: "公开字段名",
  originalName: "原始字段名",
  displayName: "显示名称",
  fieldType: "字段类型",
  filterable: "允许过滤",
  decimalSettings: "精度与小数位设置",
  decimalSettingsClose: "关闭精度设置",
  precision: "精度",
  scale: "小数位数",
  addField: "添加输出字段",
  variables: "资源变量",
  variablesHint: "资源变量用于业务模板；服务地址、凭据和登录配置由所属 Catalog 管理。",
  sensitive: "敏感值",
  storedVariable:
    "已保存的敏感值不可读取。修改定义时请按后端要求重新填写；仅改元数据时保留原定义。",
  request: "业务请求",
  requestHint:
    "操作效果固定为 read，不能根据 HTTP 方法推断。POST 也必须为只读操作。模板支持 Catalog/资源变量及已声明的过滤、分页上下文。",
  response: "响应契约",
  success: "成功规则",
  paging: "分页规则",
  pagingMode: "分页模式",
  default_limit: "默认条数",
  max_limit: "最大条数",
  page_base: "起始页码",
  pagingHint:
    "请求 Query 或 Body 必须引用对应 __paging.offset / __paging.page 和 __paging.limit。调用始终只获取单页。",
  result_rows: "结果行提取路径",
  result_total: "总条数提取路径",
  extractionHint:
    "相对正文寻址，不使用 $. 前缀。结果行路径为空表示正文根节点；总条数路径必须非空。",
  saveValidate: "保存并验证",
  saveHint:
    "创建资源或修改定义/字段映射时，后端先验证候选并执行一次默认单页真实调用，成功后保存。仅改元数据不会发起业务调用。",
  savedValidated: "已保存：后端已验证当次候选及默认单页响应。",
  savedFields: "输出字段已保存。",
  savedReadbackFailed: "资源已保存，暂时无法读取最新内容。",
  retryReadback: "重试读取",
  savedMetadata: "元数据已保存；未执行新的业务验证。",
  testPaging: "显式指定单页参数",
  offset: "偏移量（留空使用缺省值）",
  limit: "条数（留空使用缺省值）",
  total: "总条数",
  unknown: "未知",
  warnings: "后端返回了查询警告，请检查资源定义和调用范围。",
  unavailable:
    "API 连接器不可用、未安装或当前版本未授权。服务端返回的连接器可用性决定是否允许操作。",
  readOnly: "当前账号无权编辑此 API 资源配置。",
  disabledCatalogHint: "目录已停用，业务验证和数据预览不可用。可以继续编辑元数据。",
  disabledHint: "资源已停用，数据预览和试跑不可用。",
  conflict: "资源版本已变化。重新加载并核对最新版本后再继续。",
  reloadTitle: "重新加载资源？",
  reloadHint: "将丢弃未保存草稿并读取最新定义。",
  stateHint: "将更新资源启用状态。",
  deleteTitle: "删除 API 资源 {{name}}？",
  deleteHint: "删除此资源定义。依赖检查和权限由后端执行。",
  errors: {
    variables:
      "资源变量名须以字母开头，每个变量都须填写非 null 的值。敏感值须为字符串，完整替换定义时请重新填写受保护值。",
    metadata: "请填写资源名称。",
    mapping: "请至少配置一个输出字段，填写原始字段名、公开字段名和显示名称。公开字段名必须唯一。",
    decimal:
      "decimal 必须显式设置正整数 precision 和整数 scale，支持 0、负 scale 及 scale 大于 precision。",
    resource: "资源不存在，或不是只读 API 资源。",
    catalog: "请选择非内置的兼容 API Catalog。",
    incomplete: "请修正图形编辑器中的无效输入。",
    paging: "显式分页值必须为非负安全整数。",
    queryUnavailable: "资源状态或查询权限已变化，请刷新。",
  },
};
