# BKN Studio 协作约定

## 目的

本文档只描述 `bkn-studio` 的多人协作流程。

代码结构、模块开发方式、AI 开发边界请统一参考：

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)

## 基本原则

- 不直接在 `main` 上开发
- 所有功能性改动建议通过 PR 合并
- 公共能力改动的审查要求高于普通业务页面
- 任何 AI 生成代码都必须经过人工 review

## 分支约定

建议使用以下分支模型：

- `main`：稳定主分支
- `feature/<name>`：新功能开发
- `fix/<name>`：问题修复
- `refactor/<name>`：重构
- `docs/<name>`：文档更新

规则：

- 一个分支只做一类改动
- 避免一个分支同时修改框架层、多个模块和大量文档

## 提交约定

建议提交信息至少表达：

- 改了什么
- 修改范围
- 是否影响公共能力

推荐格式：

```text
feat(starter): add route-based detail actions
fix(request): retry original request after token refresh
refactor(runtime): simplify standalone config merge
docs(readme): clarify local setup
```

## Pull Request 约定

PR 描述至少包含：

- 背景
- 改动内容
- 影响范围
- 是否涉及 `framework/*`
- 验证方式
- 是否存在未完成项

如果改动较大，建议补充：

- 页面截图
- 路由变更说明
- 接口契约变化
- 风险点

## 评审约定

### 普通模块改动

- 至少 1 人 review
- 重点确认没有绕开现有 `framework/*`

### 框架层改动

以下目录默认视为高风险：

- `src/framework/*`
- `src/app/router/*`
- `src/framework/runtime/*`
- `src/framework/request/*`

这类改动建议：

- 至少 1 名熟悉当前架构的人 review
- 在 PR 中明确说明为什么不能只在模块层解决
- 明确影响哪些模块

## 自测要求

提交前至少完成：

- `pnpm lint`
- `pnpm test -- --run`
- `pnpm build`

如果某项无法执行，需要在 PR 中说明原因。

## 文档同步要求

如果改动涉及以下内容，需要同步更新文档：

- 目录结构
- runtime 输入
- request 规则
- 模块开发方式
- 协作规则

涉及文档包括但不限于：

- `README.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_GUIDE.md`
- `CONTRIBUTING.md`
- `MICRO_APP_CONTRACT.md`

