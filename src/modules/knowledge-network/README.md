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
  object-type/     # 列表、data-attribute/、logic-attribute/
  relation-type/   # 列表、映射编辑
  action-type/     # 列表、SourcePicker、Overview/Task、执行日志（逻辑见 utils/action-type-execution.ts）
  services/
    action-type-tool.service.ts  # 工具目录（mock / GET /tools/catalog）
  object-metric/   # 对象指标列表、条件树与表达式树编辑器
```

## 分层规则

| 层            | 职责                           | 禁止                       |
| ------------- | ------------------------------ | -------------------------- |
| `pages/`      | 读路由参数、挂壳层、渲染 scene | 承载复杂业务逻辑           |
| `scenes/`     | 完整业务流程、状态编排         | 被外部深层 import 私有组件 |
| `components/` | 供 scene 拼装的 UI 块          | 替代 scene 作为复用入口    |
| `services/`   | HTTP / mock / DTO 映射         | 在组件内直接写 fetch       |

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
  object-type.service.ts         # 对象类 CRUD / 索引配置
  object-type-resource.service.ts  # 数据视图 / legacy mdl 接口
  knowledge-network.service.ts  # 对象类、关系类及工具型逻辑属性
  shared/agent-operator-client.ts   # agent-operator 公共头与分页（复用 execution-factory headers）
  relation-type.service.ts       # 关系类 CRUD / 映射规则
  action-type.service.ts         # 行动类 CRUD / 执行日志
  concept-group.service.ts       # 概念分组 CRUD / 资源归组
  object-metric.service.ts       # 对象指标 V1 CRUD / 数据查询
  shared/runtime.ts              # useMock、wait、formatTimestamp、导入冲突等
  mappers/
    backend-types.ts             # 后端 DTO 类型
    index.ts                     # snake_case ↔ camelCase 映射
  mock/state.ts                  # 开发态 mock 数据与持久化 helper
```

## 业务子域与 Scene 映射

| 子域     | 主要 Scene                                           | 路由示例                             |
| -------- | ---------------------------------------------------- | ------------------------------------ |
| 网络列表 | `KnowledgeNetworkListScene`                          | `/knowledge-network`                 |
| 工作台   | `KnowledgeNetworkWorkspaceScene`                     | `/knowledge-network/workspace/:id/*` |
| 对象类   | `ObjectTypeFormScene` / `ObjectTypeDetailScene`      | `.../object-types/create`            |
| 概念分组 | `ConceptGroupFormScene` / `ConceptGroupDetailScene`  | `.../concept-groups/create`          |
| 关系类   | `RelationTypeFormScene` / `RelationTypeMappingScene` | `.../relation-types/create`          |
| 行动类   | `ActionTypeFormScene` / `ActionTypeExecutionScene`   | `.../action-types/create`            |
| 对象指标 | `ObjectMetricFormScene` / `ObjectMetricDetailScene`  | `.../metrics/create`                 |

## 开发 Mock

默认启用 mock（`VITE_USE_MOCK !== "false"`）。验收网络：`kn-domain-risk`。

对象类新建：`/knowledge-network/workspace/kn-domain-risk/object-types/create`

## 已移除的遗留 UI

迁移完成后，以下 Modal/Drawer 快捷编辑路径已废弃，统一使用 **独立 Page + Scene**：

- `*FormModal`（对象类 / 关系类 / 行动类 / 概念分组）
- `*DetailDrawer`（同上）

网络元信息编辑仍使用 `KnowledgeNetworkFormModal`（列表/工作台内联编辑）。

## 行动类的两个创建入口

行动类保持一个工作区菜单，新建弹窗提供对象操作、工具调用两个入口。
对象操作先选对象类，再从新建、修改、删除实例、建立关系、解除关系五种操作中选择。
两类入口复用同一个表单、执行来源选择器和参数映射表。每个行动只配置一个执行单元，
复杂业务交给所选 Function/API/MCP；前端不保存多步骤、重试、补偿或前序输出引用。

创建路由以 `?operation=object|tool` 保留入口选择，刷新后不会丢失；
旧的 `operation=relation` 链接进入同一个对象操作表单，默认选择建立关系。
关系操作的关系类是必选目标，仅查询与当前对象类相连的关系；当前对象位于起点
或终点时自动确定方向，自关联要求用户明确当前位置。
工具调用不关联对象类，工具参数从动态输入或固定值取得。
表单内可切换五种对象操作，不提供对象操作与工具调用两类入口之间的切换。
已有行动按保存的定义编辑。

### 单操作元数据契约（待后端接入）

`ActionTypeOperationConfig` 是单个操作的前端模型；DTO 映射使用独立的
`operation_config` 字段，不复用表示权限的 `operations` 字段：

```json
{
  "object_type_id": "orders",
  "operation_config": {
    "type": "relation",
    "relation_type_id": "order_supplier",
    "relation_operation": "create",
    "anchor_role": "source",
    "other_object_condition": {
      "object_type_id": "suppliers",
      "field": "status",
      "operation": "==",
      "value_from": "const",
      "value": "active"
    }
  },
  "action_source": { "type": "tool", "box_id": "box-1", "tool_id": "link-supplier" },
  "parameters": [
    { "name": "order_id", "value_from": "source_identity" },
    { "name": "supplier_id", "value_from": "target_identity" }
  ]
}
```

`type=object|tool` 的元数据只包含 `type`。对象操作共用操作对象类与五种操作，
选择建立／解除关系后才显示关系类和方向，后续选择执行工具。
参数表的值来源可直接选择「起点对象唯一标识」「终点对象唯一标识」。
唯一标识字段由两端对象类的 `primaryKeys` 定义读取，显示为只读信息；参数只保存
`source_identity|target_identity` 的来源，不复制字段值或再保存一组独立映射。
旧的两端映射字段与兼容逻辑已移除。仅当单字段唯一标识与一个类型匹配的入参
名称完全一致且无歧义时自动带入，不覆盖固定值或手工选择。
复合唯一标识和类型不匹配的绑定暂不开放，不能自动取第一个字段。
更换工具清空参数配置，更换关系类清除原标识来源后重新匹配；保存时要求两端都有绑定。
后端接入时应同时保存、读取及校验元数据，并保证关系含义与工具参数一致；
执行时由调用方指定两端对象实例，服务依据对象类唯一标识定义取值；
元数据本身不会执行本体写入。

关系操作的 `condition` 约束当前对象实例，`other_object_condition` 约束另一端对象实例；
两者均可不填，且均不能代替运行时的具体实例身份。建立关系时不会筛选尚不存在的关系。
本轮未新增关系实例自身属性的条件编辑器；解除关系的关系属性筛选与后端求值后续接入。
更换对象类会清空关系、方向及两端条件；切回实例操作会清除关系配置及关系标识来源。

当前 Mock 可以保存并重新编辑两个入口的定义，属于 UI 预览，不证明实际关系写入成功。
真实请求继续采用现有的单工具合同：实例操作和独立工具调用按旧字段保存，
不发送新元数据；关系操作暂不可保存，
服务层也在发请求前拦截，防止旧后端忽略元数据后错误保存。
新后端接入后再替换 `canPersistActionTypeOperation` 中的兼容门控。

### 条件值来源（前端配置与待接入契约）

适用条件的比较值提供三种来源，配置行采用「属性、判断符、值来源、取值」：

| 来源     | `value_from`            | `value` 含义                                       |
| -------- | ----------------------- | -------------------------------------------------- |
| 固定值   | `const`（旧数据缺省值） | 字面量；集合及区间保存为字符串数组                 |
| 数据属性 | `property`              | 当前待判断对象实例的属性名                         |
| 动态输入 | `input`                 | 行动运行时参数名，复用执行单元中设为动态输入的参数 |

引用名保存在 `value`，不可将其转换为固定值或数组。比较值从执行前的对象快照
或同次执行的 `dynamic_params` 取得，不引用工具输出；属性引用不跨对象或隐式查询关系。
切换来源时清除旧值，「存在／不存在」不保存比较值。属性和输入参数按判断符所需
标量／数组形状及已知类型筛选；保存时重新检查引用，防止换工具后参数失效。
区间输入须为两个值，区间参数运行时也必须验证长度及端点类型。

前端 DTO 在条件树每个叶节点保留 `value_from=const|property|input`；
缺失来源的旧条件继续按固定值处理，嵌套与／或和旧式平铺条件均保留叶节点来源。
Mock 支持保存和回显这些定义，不模拟条件求值。真实服务目前仅支持固定条件值，
非固定值显示预览提示并禁止保存，服务层同时拦截创建和更新。
后端后续需完成引用校验、运行时取值、类型检查与条件求值，缺失引用应明确拒绝执行；
接通后再替换 `canPersistActionTypeCondition` 的门控。

0.2.1 的原有行动不需要前端迁移：缺少元数据时，按有无关联对象回显。
历史手工挂载转为行动需要后端迁移，本次前端优化不改写挂载数据；
原 functions/apis/mcp 地址暂保留读取入口，工作区不新增历史页签或独立行动菜单。
