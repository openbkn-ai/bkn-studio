# BKN Studio

`bkn-studio` 是一个独立运行优先的中后台前端项目。

当前仓库已经具备可运行的项目骨架、通用框架层、权限封装、页面骨架和示例模块。后续开发应直接基于现有结构继续扩展业务，而不是再搭新的基础框架。

## 项目定位

- 面向中后台业务场景
- 默认按独立应用模式运行
- 保留未来接入宿主平台的能力，但不是当前开发前提
- 通过 `app / framework / modules` 分层组织代码

## 技术栈

- React 19
- TypeScript
- Vite
- React Router
- Ant Design
- axios
- react-i18next
- Vitest
- pnpm

## 目录结构

```text
src/
  app/
    locales/
    providers/
    router/
    theme/
  framework/
    context/
    hooks/
    permission/
    request/
    runtime/
    scaffold/
    ui/
  modules/
    starter/
      pages/
      services/
      types/
```

## 当前已实现内容

- 应用入口与路由装配
- runtime 配置收口
- 统一请求层
- 全局上下文能力
- 权限判断与权限显隐组件
- 列表页骨架和表单页骨架
- 懒加载路由和按需加载的详情抽屉
- 路由级 404 / 异常兜底
- `starter` 示例模块

## 环境要求

- Node.js 20+
- 建议通过 `corepack` 使用 `pnpm`

## 环境变量

示例文件：

- [.env.example](./.env.example)

支持的变量：

- `VITE_API_BASE_URL`：接口基地址，默认 `/api`
- `VITE_USE_MOCK`：是否启用示例模块 mock，默认 `true`

如果要使用本地环境文件：

```powershell
Copy-Item .env.example .env.local
```

例如连接真实后端：

```dotenv
VITE_API_BASE_URL=http://localhost:8080
VITE_USE_MOCK=false
```

## 安装与运行

启用 `corepack`：

```bash
corepack enable
```

安装依赖：

```bash
corepack pnpm install
```

如果首次安装遇到构建脚本审批：

```bash
corepack pnpm approve-builds --all
```

启动开发环境：

```bash
corepack pnpm dev
```

默认访问地址通常为：

```text
http://localhost:5173
```

## 常用命令

开发：

```bash
corepack pnpm dev
```

代码检查：

```bash
corepack pnpm lint
```

运行测试：

```bash
corepack pnpm test -- --run
```

生产构建：

```bash
corepack pnpm build
```

预览生产包：

```bash
corepack pnpm preview
```

## 示例模块

当前仓库包含一个 `starter` 模块，用于验证项目结构和通用能力是否可用。

访问路径：

```text
/starter
```

包含能力：

- 列表查询
- 新建页
- 编辑页
- 详情抽屉
- 权限显隐
- mock 服务

## 文档索引

必须阅读：

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

按需阅读：

- [MICRO_APP_CONTRACT.md](./MICRO_APP_CONTRACT.md)
