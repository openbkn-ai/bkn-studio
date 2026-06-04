# BKN Studio 架构说明

## 目标

本文档描述当前 `bkn-studio` 的前端架构，以及后续业务模块如何接入现有结构。

它关注的是当前真实项目，而不是抽象模板。

## 项目定位

- `bkn-studio` 是 `bkn` 平台的统一前端
- 前端允许按业务模块对接平台内多个后端服务
- 当前默认以独立应用模式运行
- 如未来接入宿主，宿主差异统一收口到 `runtime`

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

### `app`

职责：

- 应用入口
- 路由装配
- 全局 Provider
- 应用壳层
- 顶部栏、左侧导航、工作区布局

规则：

- 这里只做启动、装配和壳层
- 不放具体业务实现

### `framework`

职责：

- `runtime`
- `request`
- `context`
- `permission`
- `hooks`
- `ui`
- `scaffold`

规则：

- 这里只放跨模块复用能力
- 不写具体业务语义

### `modules`

职责：

- 具体业务模块
- 业务页面
- 业务场景
- 业务服务
- 模块类型和契约

规则：

- 模块可以依赖 `framework/*`
- 模块之间不能直接依赖彼此内部实现

## 标准模块结构

推荐业务模块采用如下结构：

```text
src/modules/<module-name>/
  components/
  contracts/
  pages/
  scenes/
  services/
  types/
  index.ts
  module.manifest.ts
  routes.tsx
```

其中：

- `pages/`
  路由页包装器，只负责接路由和壳层。
- `scenes/`
  面向复用的完整业务场景，是未来给其他智能体整合引用的主入口。
- `components/`
  业务块组件，供场景拼装。
- `contracts/`
  对外稳定输入输出契约。
- `module.manifest.ts`
  模块能力清单。
- `index.ts`
  模块统一公开出口。

## 可组合架构约束

这是当前架构新增的重点约束。

### 1. `pages` 不是复用入口

- `pages/*` 只能作为路由页
- 不允许把外部智能体的整合建立在深层页面 import 上
- 路由页应该尽量薄，只负责接入场景

### 2. `scenes` 才是可整合入口

- 外部智能体如果要整合某个业务能力，应优先引用 `scenes/*`
- `scene` 应该表达“一个完整业务场景”
- 例如：
  - `DataConnectListScene`
  - `DataConnectScanScene`

### 3. 场景必须尽量受控

- 输入走 `props`
- 输出走回调
- 导航行为可注入或可替换
- 不假设一定跑在当前页面路由里
- 不把外部宿主必须控制的状态全部藏在内部

### 4. 模块必须有稳定出口

- 每个模块通过 `index.ts` 对外暴露稳定入口
- 其他智能体不得直接依赖深层私有文件
- 模块公开内容应包括：
  - `scene`
  - `types`
  - `contracts`
  - `manifest`

### 5. 模块需要能力清单

`module.manifest.ts` 应至少描述：

- 模块 id
- 模块名称
- 提供的场景
- 场景输入
- 依赖权限
- 依赖服务
- 是否要求壳层
- 是否支持嵌入模式

## framework 关键职责

### `framework/runtime`

- 统一收口运行模式差异
- 提供当前用户、权限、语言、主题等运行时配置

### `framework/request`

- 统一 HTTP 客户端
- 注入鉴权和语言头
- 统一处理 401 刷新和请求失败

### `framework/context`

- 提供全局 `message`、`modal`、`runtimeConfig`

### `framework/permission`

- 统一权限判断
- 统一权限显隐

### `framework/ui`

- 通用 UI 包装组件
- UI Provider

### `framework/scaffold`

- 页面结构骨架
- 仅提供通用结构，不承载具体业务语义

## 路由策略

- 路由层只做挂载和布局组织
- 页面默认按模块注册
- 页面采用懒加载
- 未来如果接宿主，`basename` 和挂载差异由 `runtime` 处理

## 状态管理策略

优先级如下：

1. 组件局部 state
2. 通用 hook
3. 应用级 context
4. 真正需要跨场景共享时再引入更重的状态机制

当前项目默认不引入 Redux/Saga。

## 新功能接入原则

- 页面落到 `src/modules/<module>/pages`
- 复用场景落到 `src/modules/<module>/scenes`
- 接口逻辑落到 `src/modules/<module>/services`
- 类型和契约落到 `src/modules/<module>/types` 与 `contracts`
- 跨模块公共能力优先沉淀到 `framework/*`

## 宿主接入原则

- 宿主耦合统一收口到 `framework/runtime`
- 模块与页面不直接感知宿主实现细节
- 不为未来可能的宿主场景，把复杂兼容逻辑提前散落进业务页面
