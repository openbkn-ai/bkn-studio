# BKN Studio 前端架构说明

## 目标

本文档描述当前 `bkn-studio` 项目的前端架构。

重点不是抽象讨论，而是说明当前项目已经采用的结构、各层职责，以及后续功能开发应如何接入现有框架。

## 项目定位

- 独立运行优先的中后台前端项目
- 支持未来扩展宿主接入，但当前默认按独立应用开发
- 业务代码持续沉淀在统一分层下，而不是散落式开发

## 默认技术栈

- React + TypeScript
- Vite
- React Router
- Ant Design
- axios
- react-i18next
- CSS Modules + 全局主题样式
- Vitest
- pnpm

## 总体分层

项目按以下 3 个主层级组织：

### 1. `app`

职责：

- 应用入口
- 路由注册
- 全局 provider 装配
- 主题与国际化初始化
- 应用壳层

规则：

- 这里只负责启动和装配
- 不承载具体业务实现

### 2. `framework`

职责：

- 运行时配置
- 请求封装
- 全局上下文
- 通用 hooks
- 权限判断
- 通用 UI 组件
- 页面骨架能力

规则：

- 这里只放跨模块复用能力
- 不直接写具体业务逻辑

### 3. `modules`

职责：

- 具体业务模块
- 页面实现
- 模块服务
- 模块内类型和局部组件

规则：

- 模块可以依赖 `framework/*`
- 模块之间不能直接依赖彼此内部实现

## framework 细分说明

### `framework/runtime`

职责：

- 统一收口运行时输入
- 管理独立运行和未来宿主接入的差异
- 管理运行时用户、权限、主题、路由基路径等配置

当前实现：

- `startStandaloneApp`
- `mountApp / unmountApp`
- `createRuntimeConfig`

### `framework/request`

职责：

- 统一创建 HTTP 客户端
- 注入语言头和鉴权头
- 处理 401 刷新逻辑
- 统一请求入口

规则：

- 页面和模块禁止直接创建 axios 实例
- 所有接口调用必须走这一层

### `framework/context`

职责：

- 暴露应用级共享能力
- 提供 `message`、`modal`、`runtimeConfig`
- 提供读取运行时配置和 app services 的 hooks

规则：

- 这里只放应用级上下文
- 不放页面局部状态

### `framework/hooks`

职责：

- 沉淀跨页面的通用 hooks
- 当前已包含分页、查询参数等页面状态管理能力

规则：

- 只要不是强业务耦合的 hook，都优先沉淀到这里

### `framework/permission`

职责：

- 统一权限判断逻辑
- 提供权限显隐组件

当前实现：

- `hasPermissions`
- `PermissionGate`

规则：

- 页面中不要散落原始权限判断
- 权限逻辑统一复用这一层

### `framework/ui`

职责：

- 通用 UI 包装组件
- UI provider
- 未来继续沉淀复用组件

当前实现：

- `AppButton`
- `AppTable`
- `PageContainer`
- `AntdProviders`

### `framework/scaffold`

职责：

- 提供页面结构骨架
- 降低新模块开发时的重复布局成本

当前实现：

- `CrudListPage`
- `CrudFormPage`

规则：

- 这里沉淀结构，不沉淀具体业务字段

## 建议目录结构

```text
src/
  app/
    router/
    providers/
    theme/
    locales/
  framework/
    runtime/
    request/
    context/
    hooks/
    permission/
    ui/
    scaffold/
  modules/
    <module-name>/
      pages/
      services/
      components/
      hooks/
      types/
      locales/
```

## 路由策略

- 路由文件只负责页面挂载和布局组织
- 页面按模块注册
- 页面采用懒加载
- 详情等次级内容可进一步按需加载
- 如果未来接入宿主，`basename` 由 runtime 层统一处理

## 状态管理策略

状态优先级建议如下：

1. 组件局部 state
2. 通用 hook 状态
3. 全局 context 中的应用级能力
4. 真正跨页面共享的全局 store

当前项目默认不引入 Redux/Saga。

## 样式策略

- 全局样式只负责基础布局、主题氛围和通用类
- 模块样式优先使用 CSS Modules
- 不在业务页面中随意覆盖全局组件行为

## 独立运行策略

当前项目默认按独立应用模式运行：

- 可以直接本地启动
- 不依赖宿主注入导航对象
- 不依赖微前端生命周期
- 页面默认按普通中后台应用设计

## 宿主接入策略

如果未来需要宿主挂载，应遵守：

- 宿主耦合逻辑统一收口到 `framework/runtime`
- 业务页面不感知运行模式差异
- 不把宿主能力散落到模块页面内部

## 新功能接入原则

新增功能应直接接入现有结构：

- 页面放到 `src/modules/<module>/pages`
- 接口放到 `src/modules/<module>/services`
- 公共能力优先复用 `framework/*`
- 连续在多个页面重复出现的结构或组件，应评估是否上提
