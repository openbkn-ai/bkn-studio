# Knowledge Network Module

知识网络工作台模块，覆盖网络本体、概念分组、对象类、关系类、行动类、指标与任务等子域。

## 目录约定

```text
knowledge-network/
  components/          # 业务块组件（按域命名，复杂子域用子目录）
  contracts/           # 对外 scene 契约
  locales/             # 模块中英文文案（zh-CN/、en-US/ 按域拆分）
  pages/               # 路由薄包装（只接壳层 + scene）
  routes/              # route-factory、lazy-pages、standalone-routes
  scenes/              # 可复用完整业务场景（workspace/ 子目录承载工作台切片）
  services/            # API + mock（见下方拆分说明）
  types/               # 领域类型（按子域拆分，knowledge-network.ts 统一 re-export）
  index.ts             # 模块公开出口
  module.manifest.ts   # 权限与 scene 清单
  navigation.tsx       # 菜单贡献
  routes.tsx           # 路由贡献（re-export + 列表路由）
```

### Locales 子目录

```text
locales/
  zh-CN/
    network.ts
    concept-group.ts
    object-type.ts
    relation-type.ts
    action-type.ts
    metric.ts
    task.ts
    index.ts           # 聚合为 knowledgeNetworkZhCN
  en-US/               # 同上
```

对外 import 路径保持不变（根目录 `zh-CN.ts` / `en-US.ts` re-export 子目录）：

```typescript
import { knowledgeNetworkZhCN } from "@/modules/knowledge-network/locales/zh-CN";
```

### Routes 子目录

```text
routes/
  route-factory.tsx      # createKnowledgeNetworkRoute、withRouteLoading
  lazy-pages.tsx         # 懒加载 page 映射
  standalone-routes.tsx  # 独立资源页路由表
```

`routes.tsx` 仅保留列表路由与 re-export，避免单文件膨胀。

### Types 子目录

```text
types/
  network.ts
  concept-group.ts
  object-type.ts
  relation-type.ts
  action-type.ts
  metric.ts
  task.ts
  knowledge-network.ts   # 对外 re-export 入口（import 路径不变）
```

### Workspace Scene 拆分

```text
scenes/
  KnowledgeNetworkWorkspaceScene.tsx
  workspace/
    useWorkspaceData.ts
    WorkspaceOverviewSection.tsx
    WorkspacePreviewSection.tsx
    WorkspaceResourceSection.tsx
```

### Components 子目录

```text
components/
  shared/          # ResourceIconSelect、ResourceFormStepsShell、ResourceListPanel 样式等
  network/         # KnowledgeNetworkCard、KnowledgeNetworkFormModal
  concept-group/   # ConceptGroupListPanel
  object-type/     # 列表、索引设置、data-attribute/、logic-attribute/
  relation-type/   # 列表、映射编辑
  action-type/     # 列表、SourcePicker、Overview/Task、execution-utils、执行日志
  services/
    action-type-tool.service.ts  # 工具目录（mock / GET /tools/catalog）
  metric/          # MetricListPanel
  task/            # TaskListPanel、TaskStateTag
```

## 分层规则

| 层 | 职责 | 禁止 |
| --- | --- | --- |
| `pages/` | 读路由参数、挂壳层、渲染 scene | 承载复杂业务逻辑 |
| `scenes/` | 完整业务流程、状态编排 | 被外部深层 import 私有组件 |
| `components/` | 供 scene 拼装的 UI 块 | 替代 scene 作为复用入口 |
| `services/` | HTTP / mock / DTO 映射 | 在组件内直接写 fetch |

## Services 拆分

对外 import 路径保持不变：

```typescript
import { listKnowledgeNetworkObjectTypes } from "@/modules/knowledge-network/services/knowledge-network.service";
```

内部分层：

```text
services/
  knowledge-network.service.ts   # 对外 API 统一导出入口（import 路径不变）
  network.service.ts             # 网络级 CRUD / 预览 / 导入导出
  object-type.service.ts         # 对象类 CRUD / 数据属性 / 数据视图
  relation-type.service.ts       # 关系类 CRUD / 映射规则
  action-type.service.ts         # 行动类 CRUD / 执行日志
  concept-group.service.ts       # 概念分组 CRUD / 资源归组
  metric.service.ts              # 指标 CRUD / 数据查询
  task.service.ts                # 任务 CRUD / 子任务详情
  shared/runtime.ts              # useMock、wait、formatTimestamp、导入冲突等
  mappers/
    backend-types.ts             # 后端 DTO 类型
    index.ts                     # snake_case ↔ camelCase 映射
  mock/state.ts                  # 开发态 mock 数据与持久化 helper
```

## 业务子域与 Scene 映射

| 子域 | 主要 Scene | 路由示例 |
| --- | --- | --- |
| 网络列表 | `KnowledgeNetworkListScene` | `/knowledge-network` |
| 工作台 | `KnowledgeNetworkWorkspaceScene` | `/knowledge-network/workspace/:id/*` |
| 对象类 | `ObjectTypeFormScene` / `ObjectTypeDetailScene` | `.../object-types/create` |
| 概念分组 | `ConceptGroupFormScene` / `ConceptGroupDetailScene` | `.../concept-groups/create` |
| 关系类 | `RelationTypeFormScene` / `RelationTypeMappingScene` | `.../relation-types/create` |
| 行动类 | `ActionTypeFormScene` / `ActionTypeExecutionScene` | `.../action-types/create` |
| 指标 | `MetricFormScene` / `MetricDataQueryScene` | `.../metrics/create` |
| 任务 | `TaskFormScene` / `TaskDetailScene` | `.../tasks/create` |

## 开发 Mock

默认启用 mock（`VITE_USE_MOCK !== "false"`）。验收网络：`kn-domain-risk`。

对象类新建：`/knowledge-network/workspace/kn-domain-risk/object-types/create`

## 已移除的遗留 UI

迁移完成后，以下 Modal/Drawer 快捷编辑路径已废弃，统一使用 **独立 Page + Scene**：

- `*FormModal`（对象类 / 关系类 / 行动类 / 概念分组）
- `*DetailDrawer`（同上）

网络元信息编辑仍使用 `KnowledgeNetworkFormModal`（列表/工作台内联编辑）。
