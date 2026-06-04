# BKN Studio

`bkn-studio` 是 `bkn` 平台的统一前端项目，用于承载平台内多个后端模块对应的管理界面与业务工作区。

当前项目已经具备统一控制台壳层、基础框架层、`data-connect` 业务模块，以及后续持续扩展所需的开发约束。

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
http://localhost:5173
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
  app/          应用入口、路由、壳层、全局装配
  framework/    跨模块复用能力
  modules/      业务模块
specs/          需求、计划、任务文档
```

## 核心文档

- [ARCHITECTURE.md](D:/openbkn/bkn-studio/ARCHITECTURE.md)
  说明当前项目分层、壳层、模块边界和运行方式。
- [DEVELOPMENT_GUIDE.md](D:/openbkn/bkn-studio/DEVELOPMENT_GUIDE.md)
  说明新功能、新模块、页面、服务、样式和 AI 开发约束。
- [AGENT_COMPOSITION_CHARTER.md](D:/openbkn/bkn-studio/AGENT_COMPOSITION_CHARTER.md)
  说明模块如何作为可组合能力被其他智能体整合引用。
- [CONTRIBUTING.md](D:/openbkn/bkn-studio/CONTRIBUTING.md)
  说明分支、提交、PR、评审和回归要求。
- [MICRO_APP_CONTRACT.md](D:/openbkn/bkn-studio/MICRO_APP_CONTRACT.md)
  仅在未来宿主接入场景下参考。

## 当前状态

- 统一控制台壳层已完成
- `data-connect` 已完成第一版业务实现
- 页面结构正在按 `vega` 数据连接工作区效果持续收敛
- 后续新增模块需遵守可组合架构约束，不再按“单页直写”方式扩展
