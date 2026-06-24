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
http://localhost:8000/studio
```

访问 `http://localhost:8000/` 会自动重定向到 `/studio`。

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

3. 启动 dev server：`corepack pnpm dev`，访问 `http://localhost:8000/studio`。

   `VITE_USE_MOCK=false` 时，dev server 把以下路径代理到上面配置的 origin：

   | 路径 | 用途 |
   | --- | --- |
   | `/api` | 业务接口 |
   | `/oauth2`、`/.well-known`、`/userinfo` | OAuth2 / OIDC 登录流程 |

4. 登录：未填 token 时走浏览器内 OAuth 登录（需要网关的 hydra 已为 `openbkn-studio` 客户端登记 redirect_uri `http://localhost:8000/studio/callback`）；填了 token 则直接进入，token 失效时页面会弹出表单可现场粘贴新 token。

注意事项：

- 端口锁定 `8000`（`strictPort`），被占用会直接报错而非漂移——因为 OAuth redirect_uri 是写死的。
- `.env.local` 改动后**必须重启 dev server**，Vite 仅在启动时读取环境变量。
- 后端代码改动需先部署到目标网关，否则前端连的仍是旧行为。

## 部署

`bkn-studio` 是纯静态 SPA（Vite 产物），与 BKN Foundry 同源通信：浏览器发同源 `/api`、`/oauth2`、`/.well-known`、`/userinfo`，由网关路由到 `bkn-safe` 与后端。部署的核心就是**保证 studio 与这些路径在同一个 origin**。

### 产物

`release-studio.yml`（打 `v*` tag 触发）一条流水线产出两样，推到 GHCR：

| 产物 | 地址 |
| --- | --- |
| 镜像（多阶段：`vite build` → `nginx:alpine`，静态资源在 `/studio`） | `ghcr.io/openbkn-ai/bkn-studio:<version>` |
| Helm chart（只加 `/studio` 一条 ingress，class-443） | `oci://ghcr.io/openbkn-ai/charts/bkn-studio:<version>` |

镜像 tag 与 chart version 共用同一 `v*` 版本号，chart 永远指向匹配镜像。

### 两种安装方式（`deploy/install.sh`）

**1. 本地（指一个远端 Foundry 地址）** —— studio 跑在与 Foundry 不同的机器上：

```bash
deploy/install.sh local --foundry https://10.211.55.4 --port 8080 [--register]
```

起一个 docker 容器，容器内 nginx 既发 `/studio` 静态，又把 `/api`、`/oauth2`、`/.well-known`、`/userinfo` **反向代理**到 `--foundry`。这样浏览器对本地容器同源（无跨域，OAuth token 交换在本地解析）——本质是把 dev server 的代理产品化。默认走 `docker compose`（有的话），否则 `docker run`，`--no-compose` 强制后者。

**2. 同集群（直接装进 Foundry 的 k8s）：**

```bash
deploy/install.sh cluster --version 0.1.0 [--namespace openbkn] [--chart <ref>]
```

`helm upgrade --install` 把 chart 装进集群，`/studio` ingress 并入现有网关，与 `/api`、`/oauth2` 同 host 天然同源。

**卸载：**

```bash
deploy/install.sh uninstall local   [--name bkn-studio]
deploy/install.sh uninstall cluster [--namespace openbkn]
```

### OAuth 回调注册（关键）

hydra 按 `redirect_uri` 精确匹配，**浏览器所在 origin 的 `/studio/callback` 必须在 `openbkn-studio` 客户端白名单里**，否则登录直接报 `redirect_uri mismatch`。按部署形态分三档：

| 形态 | 回调 | 要不要注册 |
| --- | --- | --- |
| `cluster`（同网关 host） | `https://<网关host>/studio/callback` | **不用** —— `bkn-safe` 装机时按 `accessAddress` 已 seed |
| `local --port 8000` | `http://localhost:8000/studio/callback` | **不用** —— `clientSeed.extraWebRedirectUris` 默认已 seed |
| `local` 其它 origin | `http://<本机>:<port>/studio/callback` | **要**（见下） |

需要注册时三选一：

1. `deploy/install.sh local ... --register` —— 调 `bkn-safe` admin API `POST /api/safe/v1/admin/clients/openbkn-studio/redirect-uris`，token 取自 `$BKN_ADMIN_TOKEN` 或 `openbkn auth token`（需 super-admin）。**临时** —— `bkn-safe` 下次 `helm upgrade` 重新 seed 会冲掉。
2. 永久：把地址写进 `bkn-safe` chart 的 `clientSeed.extraWebRedirectUris` + `helm upgrade`（在 kowell-core，扛升级）。
3. 用已 seed 的 `--port 8000`，零注册。

> 详见 `bkn-safe/docs/oauth-redirect-uris.md`（kowell-core）。

### 无 bkn-safe（免鉴权直接用）

部署若**不带 bkn-safe**（没有鉴权服务），加 `--no-auth` 关掉 studio 自带的 OAuth 登录门，以默认 `local-admin`（满权）用户**免登录直接跑**：

```bash
deploy/install.sh local   --foundry https://10.211.55.4 --no-auth
deploy/install.sh cluster --version 0.1.0 --no-auth
```

原理：镜像里 `public/config.js` 默认是空 no-op（标准部署 = 自带 OAuth）；index.html 在主 bundle 前加载它。`--no-auth` 用一份 `window.__BKN_STUDIO_RUNTIME__ = { mode: "hosted" }` **覆盖** config.js（local 走 docker 挂载，cluster 走 chart `auth.enabled=false` 生成的 ConfigMap 挂载）—— 不重打镜像，只换运行时配置。`mode: "hosted"` 让 `shouldUseOAuthGate` 返回 false，[AuthGate](src/framework/auth/AuthGate.tsx) 直接渲染、不走登录、不调 OAuth。

chart 里对应开关（**配置文件中体现**）：

```yaml
auth:
  enabled: true   # false = 关 OAuth 门、免登录（无 bkn-safe 时用）
```

> 免鉴权下 studio 不带 token、不走登录，但仍会请求后端 `/api` —— 需该部署的后端也不强制鉴权。

### 注意事项

- **同源是硬约束**：studio 与 `/api`、`/oauth2` 必须同一公网 host，否则 CORS + OAuth 全断。`local` 模式靠容器内反代满足；`cluster` 模式靠共享网关满足。
- **base 路径 `/studio`** 接在三处必须一致：vite `base`、ingress path、hydra redirect_uri `<origin>/studio/callback`。改一处要改三处。
- **镜像与环境无关**：配置走相对 `/api`，不按环境重打镜像。某环境真要不同配置，用 `window.__BKN_STUDIO_RUNTIME__` 注入，别重打。

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
