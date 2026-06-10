# BKN Studio

`bkn-studio` 是 `bkn` 平台的统一前端项目，用于承载平台内多个后端模块对应的管理界面与业务工作区。

当前项目已经具备：
- 统一控制台壳层
- 分层前端框架
- `data-connect` 业务模块
- 面向多人协作和智能体整合的模块化约束

## 技术栈

- React + TypeScript
- Vite
- React Router
- Ant Design
- axios
- react-i18next
- CSS Modules + 全局主题样式
- Vitest
- pnpm

## 本地运行

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

默认开发地址：

```text
http://localhost:8000
```

常用命令：

```bash
corepack pnpm lint
corepack pnpm test -- --run
corepack pnpm build
corepack pnpm check
```

## 目录概览

```text
src/
  app/          应用入口、全局装配、壳层、路由注册、全局文案
  framework/    跨模块复用能力
  modules/      业务模块
specs/          需求、计划、任务文档
```

## 当前关键组织方式

### 1. 文案按全局与模块拆分

- `src/app/locales/resources/common/*`
- `src/app/locales/resources/app/*`
- `src/app/locales/resources/shell/*`
- `src/modules/<module>/locales/*`

全局入口只负责合并资源，不再把所有中英文长期堆在一个文件里。

### 2. 左侧菜单按“壳层分组 + 模块贡献”组织

- `src/app/shell/navigation/*`
  定义壳层基础导航分组和导航类型
- `src/modules/<module>/navigation.tsx`
  模块提供自己的菜单片段

### 3. 路由按模块注册聚合

- `src/modules/<module>/routes.tsx`
  模块自身路由和路由贡献
- `src/app/router/module-routes.ts`
  聚合所有模块路由

### 4. 运行时默认权限不再集中硬编码

- `src/modules/<module>/module.manifest.ts`
  模块声明权限与能力
- `src/framework/runtime/module-manifests.ts`
  聚合模块 manifest
- `src/framework/runtime/dev-profile.ts`
  开发态默认用户与权限种子

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
- `pages/` 只做路由页包装
- `scenes/` 负责可组合的业务场景
- `locales/` 维护模块文案
- `navigation.tsx` 提供模块菜单片段
- `routes.tsx` 提供模块路由贡献
- `module.manifest.ts` 提供模块权限和能力清单

## 核心文档

- [ARCHITECTURE.md](D:/openbkn/bkn-studio/ARCHITECTURE.md)
  说明分层、壳层、模块注册方式和运行时结构
- [DEVELOPMENT_GUIDE.md](D:/openbkn/bkn-studio/DEVELOPMENT_GUIDE.md)
  说明新功能、新模块、文案、菜单、路由和权限如何接入
- [AGENT_COMPOSITION_CHARTER.md](D:/openbkn/bkn-studio/AGENT_COMPOSITION_CHARTER.md)
  说明模块如何作为可被其他智能体整合引用的能力单元
- [CONTRIBUTING.md](D:/openbkn/bkn-studio/CONTRIBUTING.md)
  说明协作流程、评审和回归要求
- [MICRO_APP_CONTRACT.md](D:/openbkn/bkn-studio/MICRO_APP_CONTRACT.md)
  仅在未来宿主接入场景下参考

## 当前状态

- 统一控制台壳层已完成
- `data-connect` 已完成第一版业务实现
- 模块文案、菜单、路由、开发态权限已改为按模块贡献组织
- 新增模块时，应继续沿用“模块自带 locales / navigation / routes / manifest”的接入方式
