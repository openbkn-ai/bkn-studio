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

## 连接真实后端调试

默认 `VITE_USE_MOCK=true`，前端走内置 mock 数据，无需后端即可启动。要连真实后端（通过 Vite dev server 代理转发，免跨域）：

1. 复制环境模板：

   ```bash
   cp .env.example .env.local
   ```

2. 在 `.env.local` 中配置：

   ```text
   VITE_USE_MOCK=false                       # 关闭 mock，所有请求走真实 HTTP
   VITE_API_BASE_URL=/api                    # 前端发同源 /api/...，由 dev proxy 转发
   VITE_DEV_AUTH_ORIGIN=http://<网关地址>     # 后端网关 origin（代理目标）
   VITE_DEV_ACCESS_TOKEN=                    # 可选：填则跳过登录直接带 token
   VITE_DEV_REFRESH_TOKEN=
   ```

   也可单独用 `VITE_PROXY_TARGET=<url>` 覆盖代理目标（优先级高于 `VITE_DEV_AUTH_ORIGIN`）。

3. 启动 dev server：`corepack pnpm dev`，访问 `http://localhost:8000`。

   `VITE_USE_MOCK=false` 时，dev server 把以下路径代理到上面配置的 origin：

   | 路径 | 用途 |
   | --- | --- |
   | `/api` | 业务接口 |
   | `/oauth2`、`/.well-known`、`/userinfo` | OAuth2 / OIDC 登录流程 |

4. 登录：未填 token 时走浏览器内 OAuth 登录（需要网关的 hydra 已为 `openbkn-studio` 客户端登记 redirect_uri `http://localhost:8000/callback`）；填了 token 则直接进入，token 失效时页面会弹出表单可现场粘贴新 token。

注意事项：

- 端口锁定 `8000`（`strictPort`），被占用会直接报错而非漂移——因为 OAuth redirect_uri 是写死的。
- `.env.local` 改动后**必须重启 dev server**，Vite 仅在启动时读取环境变量。
- 后端代码改动需先部署到目标网关，否则前端连的仍是旧行为。

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
