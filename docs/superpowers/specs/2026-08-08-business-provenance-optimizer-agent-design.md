# 业务溯源优化 BKN Agent 设计

## 1. 目标

使用现有 `bkn-agent` 对一个当前 Interaction 的事实 Markdown 做一次独立诊断，按证据输出少量、具体、可验证的 BKN、MCP、SDK 或 Agent 修改建议。

0.1.4 只验证最小闭环：

```text
当前 Interaction Markdown
→ 固定 BKN Agent
→ 现有 Context Loader 核验源 BKN / Skill
→ 严格结构化结果
→ Studio 渲染建议 Markdown
```

不新增 BKN Agent 运行时能力，不新增 Context Loader 工具，不持久化分析历史，不自动应用建议。

## 2. 固定 Agent

运行载体是 Foundry `infra/bkn-agent`，不是已废弃的 Decision Agent，也不是 Studio 前端 Agent 循环。

固定配置：

```yaml
agent_id: business_provenance_optimizer
name: 业务溯源优化Agent
mode: task
status: published
model: "" # 使用平台默认模型
tools:
  - type: context_loader
skills:
  - <business-provenance-diagnosis-skill-id>
limits:
  max_turns: 12
  max_tool_calls: 12
  timeout_s: 180
  max_output_tokens: 8192
```

Agent 使用固定 ID，用户不能选择或覆盖模型、Prompt、Skill 和工具。部署前置条件是 Agent 与诊断 Skill 已发布；缺失时新版业务溯源页面显示“优化 Agent 未配置”。0.1.4 不新增自动创建或升级 Agent 的控制面。

## 3. 调用边界

`bkn-agent` 仅允许平台内部访问，因此 Studio 不直接调用它：

```text
Studio
→ POST /api/agent-observability/v1/business-provenance/interactions/{id}/optimization
→ agent-observability 校验源 Interaction 可读
→ POST /api/bkn-agent/v1/invoke/business_provenance_optimizer
→ 返回结构化诊断结果
→ Studio 确定性渲染 Markdown
```

代理必须：

- 将复制和下载使用的同一份 Interaction Markdown 原样放入 `message`；
- 透传最终用户 `Authorization`，使 Context Loader 继续按用户权限查询源 BKN；
- 添加 `bkn-agent` 所需的平台内部账户头；
- 固定传入本设计第 5 节的 `response_format`；
- 校验输出中的 `source_interaction_id` 与路径参数一致；
- 不修改、不摘要、不补写源 Markdown。

请求：

```json
{
  "interaction_markdown": "# 业务溯源交互轮次 I1\n..."
}
```

成功响应：

```json
{
  "task_id": "...",
  "source_interaction_id": "int_...",
  "result": {
    "analysis_status": "completed",
    "categories": {},
    "verification_records": [],
    "recommendations": [],
    "missing_information": []
  }
}
```

0.1.4 使用同步 `/invoke`，不增加任务轮询和结果历史。超时、Agent 不可用或输出无效时返回明确错误，源 Markdown 的复制与下载不受影响。

## 4. 诊断 Skill

Skill 名称：`business-provenance-diagnosis`。

### 4.1 输入

唯一业务输入是当前 Interaction Markdown。不得引入其他 Interaction、历史分析结果或源业务问题的新执行结果。

agent-observability 代理为本轮实际调用过的接口装配最小只读核验上下文：API / MCP 工具输入输出 Schema、生产者模块、Trace / Artifact 合同版本与 Artifact link role。它们只用于判断缺失发生在接口、调用生产者、Trace 合同还是展示层，不得改写源 Markdown，也不得扩展为通用源码分析。

### 4.2 允许使用的现有工具

```text
search_schema
get_kn_detail
get_object_types
get_relation_types
find_skills
list_skills
get_skill_content
read_skill_file
```

不得调用：

```text
query_object_instance
query_instance_subgraph
get_logic_properties_values
query_metric
run_sql
execute_action
execute_skill
```

0.1.4 通过 Skill 约束和 Eval 验证该行为，不修改 `bkn-agent` 工具装载机制。

### 4.3 固定步骤

1. 校验 Markdown 是否包含 Interaction ID、时间、输入、调用时间链和输出；
2. 从源事实中识别可直接观察的异常，不从最终回答反推调用结果；
3. 对缺失字段依次核验“API / MCP 是否接收 → SDK / Trace 合同是否可表达 → 调用生产者是否写入 → 读取投影是否返回”；
4. 只针对已定位 Operation 涉及的 BKN 元素或 Skill 定向核验；
5. 判定主要归属为 BKN、MCP、SDK 或 Agent；
6. 证据不足时将类别标为 `not_evaluable`；
7. 只有能定位修改位置并给出具体修改内容时才生成建议；
8. 返回符合固定 JSON Schema 的对象，不输出自由文本。

### 4.4 归属规则

- BKN 已有正确对象或关系，但源 Agent 未采用：不归因到 BKN；
- 源 Agent 的错误行为可以从 BKN / Skill 核验中证明：归因到 Agent 或 Skill；
- MCP 已接收字段、Trace 合同也可表达，但 MCP 调用生产者未写入对应 Artifact：归因到 MCP 生产者；
- MCP 未接收必要字段：归因到 MCP / API 合同；
- MCP 已接收字段但当前 Trace / Artifact 合同无法表达：归因到 SDK / Trace；
- Trace 与 Artifact 已返回完整事实，但页面投影遗漏：归因到 Studio 解析器，不生成 MCP / SDK 建议；
- 缺少当前 MCP Schema 或 SDK / Trace 合同，无法完成上述判断：对应类别为 `not_evaluable`；
- 同一问题只有一个主要类别，不在多个类别重复建议。

## 5. 输出合同

### 5.1 类别状态

四类都必须返回状态，但不要求都有建议：

- `change_required`：证据完整且存在具体修改；
- `no_change`：完成相关核验，未发现需要修改；
- `not_evaluable`：缺少必要信息，无法判断。

### 5.2 最小结构

```json
{
  "analysis_status": "completed",
  "source_interaction_id": "int_...",
  "categories": {
    "bkn": "change_required",
    "mcp": "not_evaluable",
    "sdk": "not_evaluable",
    "agent": "no_change"
  },
  "verification_records": [
    {
      "id": "V-BKN-1",
      "tool": "get_object_types",
      "target": "HD供应链业务知识网络_v3 / purchase_order",
      "fact": "对象描述未包含按物料编号查询采购记录的路径"
    }
  ],
  "recommendations": [
    {
      "id": "REC-BKN-01",
      "category": "bkn",
      "target": {
        "scope": "HD供应链业务知识网络_v3",
        "entity": "purchase_order",
        "location": "description"
      },
      "finding": "采购订单对象描述未说明按物料编号查询采购记录的路径",
      "change": {
        "operation": "replace",
        "current_value": "...",
        "proposed_value": "建议修改后的完整文本"
      },
      "source_evidence": ["I1-O3", "I1-O4"],
      "verification_evidence": ["V-BKN-1"],
      "acceptance_test": "同一问题下首次检索后直接采用正确对象与属性"
    }
  ],
  "missing_information": [
    "MCP：未取得本轮工具的当前 Schema",
    "SDK：未取得当前 Trace 采集合同"
  ]
}
```

正式 `response_format` 使用 JSON Schema 严格限定以上字段、枚举、必填项和 `additionalProperties: false`。

### 5.3 结果校验

agent-observability 代理在返回 Studio 前执行：

- `source_interaction_id` 必须等于当前 Interaction；
- `source_evidence` 必须存在于输入 Markdown；
- `verification_evidence` 必须存在于 `verification_records`；
- `change_required` 至少有一条同类别建议；
- `no_change` 和 `not_evaluable` 不得包含同类别建议；
- 当前轮次存在调用输入缺失、但又没有取得 SDK / Trace 采集合同时，SDK 只能输出 `not_evaluable`，不得仅凭部分 `run_sql` 证据判为 `no_change`；
- 建议必须包含精确位置、具体修改内容和验收用例；
- “优化、完善、增强、建议考虑”等没有具体变更值的内容判为无效；
- 全部建议无效时只显示“本次分析没有产生有效建议”。

Studio 不重复解释模型输出，只消费代理返回的有效结构并确定性渲染 Markdown。

## 6. Markdown 呈现

Studio 从结构化结果确定性生成 Markdown，不展示模型自由文本：

````markdown
# 业务溯源优化建议

- 源 Interaction：int_...

## 分类结论

- BKN：需要修改
- MCP：无法判断
- SDK：无法判断
- Agent：无需修改

## 修改建议

### REC-BKN-01

- 修改位置：HD供应链业务知识网络_v3 / purchase_order / description
- 问题：采购订单对象描述未说明按物料编号查询采购记录的路径
- 证据：I1-O3、I1-O4、V-BKN-1

#### 建议内容

```text
建议修改后的完整文本
```

- 验收：同一问题下首次检索后直接采用正确对象与属性。

## 无法判断

- MCP：未取得本轮工具的当前 Schema。
- SDK：未取得当前 Trace 采集合同。
````

不显示评分、置信度、趋势、长篇总结或通用最佳实践。

## 7. 页面交互

- 当前 Interaction 摘要卡提供“交给 BKN Agent 分析”；
- 点击后打开独立宽抽屉；
- 分析中只显示“正在分析”，不伪造内部阶段；
- 成功后展示建议 Markdown，并提供复制和下载；
- 失败时显示明确错误，保留源 Interaction Markdown 的复制和下载；
- 关闭抽屉后保留时间链或知识网络视图位置；
- 0.1.4 不提供分析历史、对话追问和自动应用。

## 8. 最小 Eval

必须验证：

1. BKN 缺少明确描述时，建议精确到元素和字段；
2. BKN 已有能力但 Agent 未使用时，不错误修改 BKN；
3. 无 MCP Schema 时输出 `not_evaluable`，不编造 MCP 建议；
4. 无 SDK / Trace 合同时输出 `not_evaluable`，不猜采集责任；
5. 建议缺少证据、修改位置或具体内容时被拒绝；
6. 无问题时不生成建议；
7. Skill 不调用实例查询、SQL、行动或 Skill 执行工具；
8. 真实 Interaction Markdown 的复制、下载和 Agent `message` 完全一致。

首个真实回归样本：`conv_73fc12a00ac46933c3d8015616a1b1b3` / `int_41d61bc56f7e5488171fa395ba73f58b`。

## 9. 0.1.4 之外

- Context Loader 工具白名单；
- MCP Schema 和 SDK / Trace 合同专用核验工具；
- 优化知识网络；
- 分析任务轮询和历史版本；
- 多 Agent 分工；
- 建议自动应用或写回。
