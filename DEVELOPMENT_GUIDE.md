# BKN Studio 开发指南

## 目的

本文档约束 `bkn-studio` 的日常功能开发方式，包括：

- 新功能放哪里
- 新模块怎么建
- 哪些能力必须复用
- AI 开发时哪些边界不能突破
- 如何为其他智能体提供可组合引用能力

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
  入口、路由、壳层、全局装配
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
  pages/
  scenes/
  services/
  types/
  index.ts
  module.manifest.ts
  routes.tsx
```

最低要求：

- `pages/`
- `scenes/`
- `services/`
- `types/`
- `index.ts`
- `routes.tsx`

如果该模块未来需要被其他智能体整合：

- 必须补 `contracts/`
- 必须补 `module.manifest.ts`

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
- 如果明确要对外复用，需要从 `index.ts` 受控导出

## 新模块开发步骤

推荐顺序：

1. 定义 `types`
2. 定义 `contracts`
3. 编写 `services`
4. 编写 `scene`
5. 用 `page` 接入路由
6. 编写 `module.manifest.ts`
7. 在 `index.ts` 统一导出
8. 补测试和文档

## 可组合模块约束

如果模块将来要被其他智能体整合引用，必须遵守：

### 1. 统一公开出口

- 模块对外只通过 `src/modules/<module>/index.ts`
- 外部不得依赖模块私有深层路径

### 2. 场景可受控

- 输入参数清晰
- 允许宿主控制关键行为
- 不把所有控制都锁死在内部

### 3. 导航和副作用可替换

- 场景中涉及跳转、消息、确认框时，优先考虑是否需要暴露适配点
- 不要把场景写死为“只能运行在当前路由页”

### 4. 契约先于实现

- 先定义 `contracts/*`
- 再让 `scene` 和 `service` 对齐契约

### 5. 能力清单必须可读

`module.manifest.ts` 至少描述：

- 模块 id
- 模块名称
- 提供的场景
- 依赖权限
- 依赖后端服务
- 是否要求壳层
- 是否支持嵌入/只读模式

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

## 国际化约束

- 所有用户可见文案必须走 i18n
- 不在页面里硬编码最终显示文本

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
- 直接复制整页旧代码而不按当前结构重组
- 无理由引入新框架或重依赖
- 深层 import 其他模块私有文件

### AI 必须遵守的边界

- `pages` 不是跨智能体复用入口
- `scenes` 才是
- 新增可组合模块时，必须同步补 `contracts`、`manifest`、`index.ts`

## 自测要求

提交前至少完成：

- `pnpm lint`
- `pnpm test -- --run`
- `pnpm build`

如果无法执行，需要在提交说明里写清原因。
