# BKN Studio 架构说明

## 目标

本文档描述当前 `bkn-studio` 的前端架构，以及后续业务模块如何接入现有结构。

它关注的是当前真实项目，而不是抽象母版。

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
- 全局 Provider 装配
- 路由注册与聚合
- 应用壳层
- 顶部栏、左侧导航、工作区布局
- 全局文案装配

规则：
- 这里只做启动、装配和壳层
- 不放具体业务实现
- 不承载模块私有规则

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
- 模块页面
- 模块场景
- 模块服务
- 模块文案
- 模块菜单
- 模块路由
- 模块权限与能力清单

规则：
- 模块可以依赖 `framework/*`
- 模块之间不能直接依赖彼此内部实现

## 当前关键组织方式

### 1. 文案按全局与模块拆分

全局文案：

```text
src/app/locales/resources/
  common/
  app/
  shell/
```

模块文案：

```text
src/modules/<module>/locales/
```

规则：
- 全局公共文案放 `common`
- 平台级品牌或应用信息放 `app`
- 壳层文案放 `shell`
- 模块文案必须跟模块走
- `app/locales/resources/en-US.ts` 和 `zh-CN.ts` 只负责合并，不负责长期堆积业务文案

### 2. 左侧导航按“壳层分组 + 模块贡献”组织

壳层基础导航：

```text
src/app/shell/navigation/
  base-navigation.tsx
  types.ts
```

模块菜单片段：

```text
src/modules/<module>/navigation.tsx
```

规则：
- 壳层只定义平台级分组和导航类型
- 模块自己提供菜单项
- 新模块默认通过 `navigation.tsx` 挂入现有分组
- 只有新增平台级一级分组时，才修改 `base-navigation.tsx`

### 3. 路由按模块贡献聚合

模块路由：

```text
src/modules/<module>/routes.tsx
```

应用聚合：

```text
src/app/router/
  types.ts
  module-routes.ts
  create-router.tsx
```

规则：
- 模块自己声明路由
- 模块自己声明路由贡献对象
- `app` 层统一聚合，不再手工在总路由文件里长期堆模块 import
- 默认首页入口由模块路由贡献决定

### 4. 运行时默认权限按模块 manifest 聚合

模块能力清单：

```text
src/modules/<module>/module.manifest.ts
```

运行时聚合：

```text
src/framework/runtime/
  module-manifests.ts
  dev-profile.ts
  config.ts
```

规则：
- 模块权限由模块自己声明
- 开发态默认用户由运行时聚合所有模块权限种子
- `config.ts` 只保留 runtime 合并逻辑
- 不再在 `config.ts` 中长期手写所有模块权限数组

## 标准模块结构

推荐业务模块采用如下结构：

```text
src/modules/<module-name>/
  components/
  contracts/
  locales/
  pages/
  scenes/
  services/
  types/
  index.ts
  module.manifest.ts
  navigation.tsx
  routes.tsx
```

其中：
- `pages/`
  路由页包装器，只负责接路由和壳层
- `scenes/`
  面向复用的完整业务场景，是未来给其他智能体整合引用的主入口
- `components/`
  业务块组件，供场景拼装
- `contracts/`
  对外稳定输入输出契约
- `locales/`
  模块中英文文案
- `navigation.tsx`
  模块菜单贡献
- `routes.tsx`
  模块路由和路由贡献
- `module.manifest.ts`
  模块能力清单、权限和服务依赖
- `index.ts`
  模块统一公开出口

## 可组合架构约束

### 1. `pages` 不是复用入口

- `pages/*` 只能作为路由页
- 不允许把外部智能体的整合建立在深层页面 import 上
- 路由页应该尽量薄，只负责接入场景

### 2. `scenes` 才是可整合入口

- 外部智能体如果要整合某个业务能力，应优先引用 `scenes/*`
- `scene` 应该表达“一段完整业务场景”

### 3. 模块必须有稳定出口

- 每个模块通过 `index.ts` 对外暴露稳定入口
- 其他智能体不得直接依赖深层私有文件

### 4. 模块需要能力清单

`module.manifest.ts` 至少描述：
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
- 聚合模块 manifest 和开发态默认 profile

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
- 后续如通用组件数量继续增长，可再按 `layout / feedback / form / data-display` 分组

### `framework/scaffold`

- 页面结构骨架
- 仅提供通用结构，不承载具体业务语义

## 新功能接入原则

- 页面落到 `src/modules/<module>/pages`
- 复用场景落到 `src/modules/<module>/scenes`
- 模块文案落到 `src/modules/<module>/locales`
- 模块菜单落到 `src/modules/<module>/navigation.tsx`
- 模块路由落到 `src/modules/<module>/routes.tsx`
- 接口逻辑落到 `src/modules/<module>/services`
- 类型和契约落到 `src/modules/<module>/types` 与 `contracts`
- 权限和能力清单落到 `src/modules/<module>/module.manifest.ts`
- 跨模块公共能力优先沉淀到 `framework/*`

## 宿主接入原则

- 宿主耦合统一收口到 `framework/runtime`
- 模块与页面不直接感知宿主实现细节
- 不为未来可能的宿主场景，把复杂兼容逻辑提前散落进业务页面
