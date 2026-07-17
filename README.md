<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="help/banner-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="help/banner-light.png">
    <img src="help/banner-light.png" alt="OpenBKN" width="100%">
  </picture>
</p>

# BKN Studio

中文 | [English](README.en.md)

BKN Studio 是 OpenBKN 的统一产品工作台，面向企业知识网络、数据资源治理、模型资源管理、智能体调试和平台运维等场景，提供一套可视化、可协作、可交付的前端入口。

它不是单一功能页面集合，而是 OpenBKN 面向业务用户、实施人员、数据工程师和 AI 工程师的统一操作界面。用户可以在这里完成知识网络建模、数据资源接入、索引构建、工具能力编排、模型配置和运行调试等工作。

## 产品定位

BKN Studio 关注三类核心问题：

1. **让业务知识可建模**
   将企业中的业务对象、关系、动作、概念分组等知识结构沉淀为领域知识网络，支撑后续查询、分析、智能体调用和业务应用构建。

2. **让数据资源可治理、可检索、可使用**
   通过数据连接、数据目录、资源详情和数据索引能力，把数据库、数据视图等资源组织成可理解、可检索、可绑定的资源知识网络。

3. **让平台能力可配置、可运营、可交付**
   通过模型管理、执行工厂、Agent 调试等模块，将 OpenBKN 后端能力产品化，降低联调、验证和业务交付成本。

## 主要业务模块

### 领域知识网络

面向业务建模和知识组织场景，支持：

- 管理知识网络、对象类、关系类、动作类型和概念分组。
- 将业务对象与数据资源视图绑定，建立业务语义和数据实体之间的映射关系。
- 查看对象类、关系类、动作类型详情，以及关联资源信息。
- 通过 ContextLoader 调试台验证知识网络在智能体检索和工具调用中的表现。

### 数据资源知识网络

面向数据资源治理和检索构建场景，支持：

- 创建和管理数据连接。
- 扫描并维护数据目录、数据资源、数据视图和资源详情。
- 在数据目录侧配置全文索引和向量索引。
- 查看索引构建任务、构建状态、失败信息和重建操作。
- 为领域知识网络提供稳定的数据资源绑定来源。

### 执行工厂

面向工具能力生产和集成场景，支持：

- 管理算子、工具、工具箱和能力。
- 从 OpenAPI 或 cURL 导入接口能力。
- 预览、调试、发布和导出工具能力。
- 对接沙箱运行时，为智能体和业务流程提供可执行工具。

### 模型管理

面向大模型和小模型统一运营场景，支持：

- 管理大模型、小模型配置。
- 测试连接、设为默认、查看模型监控。
- 管理模型授权和 API 使用说明。
- 配置模型配额、额度限制和用户级用量策略。

### Agent / ContextLoader

面向智能体调试和检索验证场景，支持：

- 调试 Agent 对话和工具调用。
- 查看工具调用过程、耗时、token 等运行信息。
- 管理 MCP 工具列表和 API Key。
- 验证知识网络、数据资源和模型配置是否能被智能体正确使用。

## 技术栈

- React
- TypeScript
- Vite
- React Router
- Ant Design
- axios
- react-i18next
- CSS Modules
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

常用命令：

```bash
corepack pnpm lint
corepack pnpm test -- --run
corepack pnpm build
corepack pnpm check
```

## 安装部署

BKN Studio 随 OpenBKN / BKN Foundry 一起安装和部署。安装脚本、部署参数和环境准备说明请参考 [BKN Foundry 安装部署文档](https://github.com/openbkn-ai/bkn-foundry/blob/main/deploy/README.zh.md)。

## 🤝 加入社群

扫码加入社群，获取支持、反馈问题、了解最新动态：

<p align="center">
  <img src="help/qrcode.png" alt="加入 OpenBKN 社群" width="260" />
</p>

## 许可 / License

BKN Studio 是 OpenBKN 项目的一部分。组件和文件的权威归属以本仓库 [LICENSE](LICENSE) 为准。

- BKN Studio 采用本仓库随附的许可文件。
- BKN Foundry 和 BKN SDK 在独立仓库维护，适用各自仓库随附的许可证文件。

每个文件适用的许可证以其文件头注明为准。
