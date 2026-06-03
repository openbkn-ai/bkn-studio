# BKN Studio 宿主接入约束

## 说明

当前 `bkn-studio` 默认按独立应用运行。

本文档不是当前开发的强制前提，而是在未来需要将项目接入宿主平台、门户系统或统一主壳时使用。

## 适用场景

只有在以下情况出现时，才需要严格落实本文档：

- 项目需要被外部主壳挂载
- 需要复用主壳提供的鉴权与导航能力
- 需要共享主壳主题、容器或业务域参数

如果当前只是普通独立项目开发，可以只了解本文档，不必提前实现全部宿主能力。

## 核心原则

- 应用必须可以脱离宿主独立启动
- 应用也必须可以接收宿主注入的运行时参数
- 所有宿主耦合逻辑必须收口在 `framework/runtime`
- 业务模块不应感知自己当前是独立运行还是被挂载运行

## 技术栈边界

宿主接入只改变运行方式，不改变项目主技术栈。

当前项目无论独立运行还是宿主挂载，都保持：

- React + TypeScript
- Vite
- React Router
- Ant Design
- axios + `framework/request`
- i18n + `framework/context`

## 运行时输入

当项目运行在宿主模式时，runtime 层建议支持接收以下标准化参数：

- `lang`
- `token`
- `userid`
- `roles`
- `permissions`
- `businessDomainID`
- `navigate`
- `history`
- `basename`
- `theme`
- `toggleSideBarShow`
- `container`

这些输入应先由 runtime 层转换成项目内部稳定结构，再暴露给业务代码。

## Token 约束

token 能力至少应支持：

- 读取当前 access token
- 刷新 token
- 认证失败后的回调处理

规则：

- request 层只消费统一 token manager
- 页面和模块不直接解析宿主传入的原始 token 结构

## 导航约束

宿主可选提供：

- `navigate(path, options)`
- `history`
- `basename`

规则：

- 只有 runtime 层知道这些对象如何接线
- 页面内部只使用项目统一的路由能力

## UI 宿主能力约束

宿主可选提供：

- popup container
- 侧边栏显隐控制
- theme 或 OEM 配置

规则：

- 这些能力统一映射到项目的 context 或 provider
- 不要在业务页面直接访问宿主对象

## 独立运行模式

当应用不是被宿主挂载时：

- runtime 使用本地默认配置
- 可以从 `sessionStorage` 读取本地 token
- 应用仍需完整可启动、可调试、可构建

## 业务域参数约束

如果宿主注入业务域参数：

- runtime 层应转换成稳定的 app context 能力
- service 层可以通过共享上下文或 helper 获取
- 页面禁止直接读取宿主 props

## 非目标

本文档不要求：

- 当前所有页面都适配宿主 UI 拼装
- 当前项目立即引入完整微前端运行时
- 因为可能接主壳，就提前把全部宿主逻辑写进业务代码

## 实施建议

如果后续确实需要宿主接入，建议按以下顺序推进：

1. 扩展 `RuntimeInput` 和 `RuntimeConfig`
2. 在 `framework/runtime` 中增加宿主适配逻辑
3. 让 `framework/request`、`framework/context` 消费统一后的运行时能力
4. 保持 `modules/*` 业务页面无感接入
