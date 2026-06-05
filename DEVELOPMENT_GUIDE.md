# BKN Studio 开发指引

## 目的

本文档约束 `bkn-studio` 的日常功能开发方式，包括：
- 新功能放哪里
- 新模块怎么建
- 哪些能力必须复用
- 文案、菜单、路由、权限如何接入
- AI 开发时哪些边界不能突破

## 默认前提

- 当前以独立应用模式开发
- 平台前端允许按模块对接多个后端服务
- 新模块默认基于现有架构继续扩展

## 默认技术栈基线

- React + TypeScript
- Vite
- React Router
- Ant Design
- axios
- react-i18next
- CSS Modules
- ESLint
- Vitest
- pnpm

## 分层规则

- `src/app/*`
  入口、壳层、全局装配、路由聚合、全局文案
- `src/framework/*`
  跨模块复用能力
- `src/modules/*`
  具体业务模块

禁止：
- 把业务逻辑写进 `framework`
- 把页面直接堆进 `app`
- 在模块里重写 request、runtime、permission 机制

## 标准模块结构

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

最低要求：
- `pages/`
- `services/`
- `types/`
- `locales/`
- `routes.tsx`

如果该模块未来需要被其他智能体整合：
- 必须补 `scenes/`
- 必须补 `contracts/`
- 必须补 `index.ts`
- 必须补 `module.manifest.ts`
- 应补 `navigation.tsx`

## 页面、场景、组件约束

### `pages`

- 路由包装器
- 只做路由参数读取、权限挂载、壳层接入
- 不作为外部复用入口

### `scenes`

- 业务场景主入口
- 表达“一个完整业务场景”
- 供其他模块或其他智能体整合使用
- 尽量通过 `props` 输入，通过回调输出

### `components`

- 细粒度业务块
- 给本模块场景拼装使用
- 如需对外复用，必须从 `index.ts` 受控导出

## 文案接入规则

### 全局文案

放在：

```text
src/app/locales/resources/
  common/
  app/
  shell/
```

约束：
- `common` 只放全局公共文案
- `app` 只放平台级品牌或应用信息
- `shell` 只放壳层文案

### 模块文案

放在：

```text
src/modules/<module>/locales/
  en-US.ts
  zh-CN.ts
```

约束：
- 用户可见文案必须走 i18n
- 模块文案必须跟模块走
- 不再把所有模块文案长期集中到 `app/locales/resources/en-US.ts` 和 `zh-CN.ts`
- 全局入口文件只负责合并资源

## 菜单接入规则

### 壳层基础导航

放在：

```text
src/app/shell/navigation/
```

这里只定义：
- 平台级一级分组
- 导航类型

### 模块菜单

放在：

```text
src/modules/<module>/navigation.tsx
```

约束：
- 模块通过 `navigation.tsx` 提供菜单片段
- 普通模块不直接改壳层总菜单树
- 只有新增平台级一级分组时，才调整 `app/shell/navigation/base-navigation.tsx`

## 路由接入规则

### 模块路由

放在：

```text
src/modules/<module>/routes.tsx
```

模块应提供：
- `RouteObject[]`
- 路由贡献对象

### 应用聚合

放在：

```text
src/app/router/module-routes.ts
```

约束：
- 模块自己声明路由
- `app` 层统一聚合
- 不再在总路由文件中长期手工堆模块 import
- 默认首页入口由模块路由贡献决定

## 权限与运行时接入规则

### 模块权限

放在：

```text
src/modules/<module>/module.manifest.ts
```

约束：
- 模块权限由模块自己声明
- 模块对外能力清单由 manifest 描述

### runtime 聚合

放在：

```text
src/framework/runtime/
  module-manifests.ts
  dev-profile.ts
  config.ts
```

约束：
- `module-manifests.ts` 统一收集模块 manifest
- `dev-profile.ts` 维护开发态默认用户和权限种子
- `config.ts` 只保留 runtime 合并逻辑
- 不再在 `config.ts` 里长期硬编码所有模块权限

## 新模块开发步骤

推荐顺序：
1. 定义 `types`
2. 定义 `contracts`
3. 编写 `services`
4. 编写 `locales`
5. 编写 `scene`
6. 用 `page` 接入路由
7. 编写 `navigation.tsx`
8. 编写 `module.manifest.ts`
9. 在 `index.ts` 统一导出
10. 补测试和文档

## service 开发约束

service 只负责：
- 请求调用
- 参数装配
- DTO 到页面模型的映射

service 不负责：
- 组件状态
- 页面交互
- 直接调 `message` / `modal`

页面和场景禁止直接创建 `axios` 实例。

## 路由约束

- 路由只做页面挂载和布局组织
- 不在路由里写业务副作用
- 页面默认懒加载

## 权限约束

- 显隐统一走 `PermissionGate`
- 判断统一走 `hasPermissions`
- 不要在 JSX 里散落原始权限字符串判断

## 样式约束

- 模块样式优先使用 CSS Modules
- 全局样式只负责壳层、主题和通用类
- 不在业务页随意覆盖全局组件行为

## AI 开发约束

### AI 可以做的事

- 在现有分层下补页面、场景、服务、类型
- 复用现有 `framework/*`
- 生成测试、文档和样式细节

### AI 不应做的事

- 自建一套 request、runtime、permission
- 继续把文案、菜单、路由、权限重新收回单一总文件
- 直接复制旧项目整页代码而不按当前结构重组
- 无理由引入新框架或重依赖
- 深层 import 其他模块私有文件

### AI 必须遵守的边界

- `pages` 不是跨智能体复用入口
- `scenes` 才是
- 新增模块时，应同步补 `locales`、`navigation.tsx`、`routes.tsx`、`module.manifest.ts`

## 自测要求

提交前至少完成：

- `pnpm lint`
- `pnpm test -- --run`
- `pnpm build`

如果无法执行，需要在提交说明里写清原因。
