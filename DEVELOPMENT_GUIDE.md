# BKN Studio 开发指南

## 目的

本文档用于约束 `bkn-studio` 的日常功能开发方式。

它整合了原先分散在多份文档中的开发规则、模块开发方式和 AI 开发边界，目标是让团队只看这一份文档，就能知道：

- 新功能应该放在哪里
- 新模块应该怎么建
- 应该复用哪些已有能力
- AI 生成代码时必须遵守什么边界

## 默认前提

- 项目按独立应用模式开发
- 新功能直接基于现有框架层继续扩展
- 微前端接入不是当前默认要求

## 默认技术栈基线

当前项目默认采用以下技术栈基线：

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

规则：

- 不随意切换到另一套主框架
- 不重新引入 Redux/Saga 作为默认状态方案
- 不因为未来可能接主壳，就提前引入完整微前端运行时

## 分层开发规则

- `src/app/*`：应用入口、路由、provider 装配
- `src/framework/*`：跨模块复用的通用能力
- `src/modules/*`：具体业务模块

禁止：

- 把业务逻辑写进 `framework`
- 把运行时逻辑散落到业务页面
- 把业务页面直接塞进 `app`

## 模块开发标准结构

建议新模块采用以下结构：

```text
src/modules/<module-name>/
  pages/
  services/
  components/
  hooks/
  types/
  routes.tsx
```

至少建议具备：

- `pages/`
- `services/`
- `types/`
- `routes.tsx`

## 新模块开发步骤

推荐顺序：

1. 定义模块 `types`
2. 编写 `services`
3. 补 `routes.tsx`
4. 实现列表页
5. 实现新建/编辑页
6. 补详情组件
7. 补测试

## 页面开发约定

### 列表页

优先复用：

- `CrudListPage`
- `AppTable`
- `AppButton`
- `usePageState`

推荐结构：

- 标题
- 查询区
- 操作栏
- 列表/表格
- 空态 / 加载态
- 详情抽屉或跳转入口

### 表单页

优先复用：

- `CrudFormPage`

推荐结构：

- 页面标题
- 基础信息区
- 高级配置区
- 提交 / 返回按钮

### 详情

详情可以采用：

- 独立详情页
- 抽屉
- 模态框

如果详情内容较重，建议按需懒加载。

## service 开发约定

service 放在：

- `src/modules/<module-name>/services/*`

service 的职责：

- 请求调用
- 参数拼装
- 数据转换
- DTO 到页面模型的映射

service 不应负责：

- 页面 UI 状态
- 组件交互
- 直接调用 message/modal

## 请求约定

- 页面和模块禁止直接创建 axios 实例
- 所有请求必须走 `src/framework/request/http.ts`
- 请求错误处理优先走统一机制
- 页面层仍需补充加载失败提示、提交失败提示和重试入口

## 类型约定

类型放在：

- `src/modules/<module-name>/types/*`

建议拆分为：

- 页面模型
- 请求参数
- 响应结构

多文件复用的类型优先放 `types/`，不要散落在多个页面文件内。

## 路由约定

- 路由只负责挂载页面和布局
- 不在路由文件中写业务副作用
- 新模块路由统一集中配置
- 页面默认采用懒加载

## UI 约定

- 可复用组件优先进入 `src/framework/ui`
- 页面骨架优先复用 `CrudListPage`、`CrudFormPage`
- 不要每个模块各自封装一套 Button、Table、Drawer、Modal、Input、Select

## 权限约定

- 权限显隐统一通过 `PermissionGate`
- 权限判断统一通过 `hasPermissions`
- 不要在 JSX 中散落权限字符串判断

## 国际化约定

- 所有用户可见文案必须走 i18n
- 不要在组件中硬编码最终显示文案

## 样式约定

- 模块样式优先使用 CSS Modules
- 全局样式只做基础布局、主题和通用类
- 不在业务页面中随意覆盖全局组件行为

## 判断是否应上提到 framework

当某个能力满足以下条件时，应评估是否上提：

- 已在 3 个以上页面重复出现
- 明显不属于单一业务模块
- 未来多个模块都可能复用

常见候选：

- 查询表单区
- 表格操作列模式
- 表单布局块
- 上传、导入导出、权限包裹

## AI 开发约束

### AI 可以做的事

- 根据当前分层补充模块页面
- 在既有约束下补 service、types、routes
- 复用现有骨架完成列表页、表单页、详情页
- 帮助补测试、补文档、补样式细节
- 帮助重构重复代码，但前提是不改变业务语义

### AI 不应做的事

- 自行引入另一套架构
- 在模块中重写 request、permission、runtime 机制
- 无理由替换现有 UI 体系
- 无理由新增重量级依赖
- 大面积重写已稳定文件
- 用“为了方便生成”为理由破坏分层

### AI 必须遵守的边界

- 不绕开现有 `framework/*`
- 不直接在页面里调用裸 `axios`
- 不在页面里散落权限字符串比较
- 不在 JSX 中硬编码最终文案
- 不在业务页面中随意覆盖全局组件行为

### AI 代码提交标准

AI 生成代码只有满足以下条件，才可以提交：

- 能解释为什么放在当前目录
- 能说明复用了哪些已有能力
- 能通过 `lint / test / build`
- 没有明显重复造轮子
- 对外部依赖新增有明确理由

### 高风险改动

以下改动即使由 AI 生成，也必须重点复审：

- `src/framework/runtime/*`
- `src/framework/request/*`
- `src/framework/context/*`
- `src/app/router/*`
- `vite.config.ts`
- `package.json`

## 自测要求

提交前至少完成：

- 本地运行通过
- `pnpm lint`
- `pnpm test -- --run`
- `pnpm build`

如果某项无法执行，需要在 PR 中说明原因。

## 示例参考

当前仓库中可参考：

- `src/modules/starter/pages/StarterListPage.tsx`
- `src/modules/starter/pages/StarterFormPage.tsx`
- `src/modules/starter/services/starter.service.ts`
- `src/modules/starter/routes.tsx`

示例模块的意义是提供结构参考，不建议把示例逻辑长期当作正式业务代码继续堆积。

