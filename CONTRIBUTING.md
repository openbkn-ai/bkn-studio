# BKN Studio 协作约定

## 目的

本文档只描述 `bkn-studio` 的多人协作流程。

架构和模块开发规则请统一参考：

- [ARCHITECTURE.md](D:/openbkn/bkn-studio/ARCHITECTURE.md)
- [DEVELOPMENT_GUIDE.md](D:/openbkn/bkn-studio/DEVELOPMENT_GUIDE.md)
- [AGENT_COMPOSITION_CHARTER.md](D:/openbkn/bkn-studio/AGENT_COMPOSITION_CHARTER.md)

## 基本原则

- 不直接在 `main` 上开发
- 所有功能性改动建议通过 PR 合并
- 公共能力和模块对外契约改动的评审要求高于普通页面样式调整
- 任何 AI 生成代码都必须经过人工 review

## 分支约定

- `main`
  稳定主分支
- `feature/<name>`
  新功能开发
- `fix/<name>`
  问题修复
- `refactor/<name>`
  重构
- `docs/<name>`
  文档更新

规则：

- 一个分支只做一类改动
- 避免一个分支同时修改壳层、多个业务模块和大量文档

## 提交约定

推荐格式：

```text
feat(data-connect): refine workspace experience
fix(request): retry original request after token refresh
refactor(runtime): simplify standalone config merge
docs(architecture): add agent composition rules
```

## Pull Request 要求

PR 描述至少包含：

- 背景
- 主要改动
- 影响范围
- 验证方式
- 未完成项或风险点

如果改动涉及可组合能力，还必须补充：

- 是否修改了 `index.ts` 对外出口
- 是否修改了 `contracts/*`
- 是否修改了 `module.manifest.ts`
- 是否影响其他智能体整合方式

## 评审要求

### 普通页面或样式改动

- 至少 1 人 review

### 框架层改动

以下目录默认高风险：

- `src/framework/*`
- `src/app/router/*`
- `src/app/shell/*`
- `src/framework/runtime/*`
- `src/framework/request/*`

这类改动建议：

- 至少 1 名熟悉当前架构的人 review
- 在 PR 中明确为什么不能只在模块层解决

### 模块对外能力改动

以下改动同样按高风险处理：

- `src/modules/*/index.ts`
- `src/modules/*/contracts/*`
- `src/modules/*/module.manifest.ts`
- `src/modules/*/scenes/*`

因为这些文件会直接影响其他智能体的整合方式。

评审时必须确认：

- 对外入口是否仍然稳定
- 是否新增了深层私有依赖
- 是否破坏了场景层可组合性

## 自测要求

提交前至少完成：

- `pnpm lint`
- `pnpm test -- --run`
- `pnpm build`

## 文档同步要求

如果改动涉及以下内容，需同步更新文档：

- 目录结构
- 壳层结构
- request/runtime/permission 规则
- 模块公开出口
- 场景、契约、清单结构

常见对应文档：

- [README.md](D:/openbkn/bkn-studio/README.md)
- [ARCHITECTURE.md](D:/openbkn/bkn-studio/ARCHITECTURE.md)
- [DEVELOPMENT_GUIDE.md](D:/openbkn/bkn-studio/DEVELOPMENT_GUIDE.md)
- [AGENT_COMPOSITION_CHARTER.md](D:/openbkn/bkn-studio/AGENT_COMPOSITION_CHARTER.md)
