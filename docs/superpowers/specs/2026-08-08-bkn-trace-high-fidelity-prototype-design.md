# BKN Trace High-Fidelity Prototype Design

## Goal

Create an isolated, interactive high-fidelity prototype for business provenance analysis using the real trace facts from conversation `conv_73fc12a00ac46933c3d8015616a1b1b3`.

The prototype validates two complementary views:

- **Timeline view**: explains when each interaction and OpenBKN operation happened, what it did, and how long it took.
- **Knowledge-network view**: explains where observed operations land in the Business Knowledge Network, then progressively expands objects, relations, and adjacent objects.

Both views share one collapsible detail panel. The prototype is additive and does not replace the production business-provenance page.

## Product Questions Answered

The prototype must answer the original business-provenance questions without requiring users to understand Trace internals:

- **When**: interaction start/end, operation start/end, operation duration, and gaps between observed calls.
- **Who / what**: Agent, knowledge network, object, relation, action, metric/function when actually present.
- **How**: tool name, input conditions, resource, SQL or structured query, and result summary needed to reproduce the operation.
- **Why it matters**: reveal excessive schema exploration, repeated queries, unobserved relationship use, and slow interaction paths without automatically generating AI recommendations.

## Verified Data Capability

The prototype uses only fields already available from current APIs and the actual BKN definition.

### Trace facts

- Agent: Codex
- Conversation: `conv_73fc12a00ac46933c3d8015616a1b1b3`
- Interaction 1: 97.9 seconds, 8 OpenBKN operations
- Interaction 2: 30.7 seconds, 1 OpenBKN operation
- Every `run_sql` operation has a Query Artifact containing resource IDs and SQL.
- `search_schema` returned 28 knowledge-network candidates.

### Deterministic BKN resolution

The existing BKN export supports this join:

```text
Query Artifact.resource_id
  -> ObjectType.data_source.id
  -> ObjectType
  -> RelationType.source_object_type_id / target_object_type_id
  -> adjacent RelationType and ObjectType
```

Verified mappings used by the prototype include:

| Resource usage | BKN object | Relevant BKN relation context |
| --- | --- | --- |
| Inventory SQL | 库存 | 物料关联库存 |
| Purchase-order SQL | 采购订单 | 采购订单关联供应商、采购订单关联物料请购单 |
| Purchase-request SQL | 物料请购单 | 采购订单关联物料请购单 |
| BOM SQL | 产品BOM | 产品关联产品BOM、产品BOM关联物料 |
| Object-instance query | 物料 | 物料关联库存、产品BOM关联物料 |

The UI must distinguish deterministic resource binding from an actually invoked BKN relation. A relation may be shown as network context without claiming that the Agent traversed it.

## Page Structure

```text
Business provenance analysis
Codex · 2 interactions · 9 OpenBKN operations · complete

[ Timeline view | Knowledge-network view ]       [ Collapse detail ]

┌────────────────────────────────────┬──────────────────────────┐
│ Main interactive view              │ Shared detail panel      │
│                                    │                          │
│ Timeline or progressive BKN graph  │ What                     │
│                                    │ How                      │
│ Select operation / object / link ──┼─> Result                 │
│                                    │ Reproduce                │
│                                    │ Technical details        │
└────────────────────────────────────┴──────────────────────────┘
```

The detail panel is approximately 38% of the workspace and collapses to a narrow rail. View switching preserves the currently selected operation when it has a representation in both views.

## Timeline View

The timeline replaces a generic request table. It groups events by interaction and shows real relative time.

Each interaction contains:

- user question;
- interaction duration and operation count;
- chronological operation nodes;
- observed gap before each operation;
- operation duration, status, business target, and concise input condition;
- final answer summary.

Operation types use business language:

- `list_knowledge_networks` -> 查找业务知识网络
- `search_schema` -> 探索知识网络结构
- `run_sql` -> 查询业务数据, with resolved object/resource and condition
- `query_object_instance` -> 查询业务对象

The timeline may state arithmetic facts such as "97.9 seconds total, 3.5 seconds in OpenBKN operations". It must not label the remaining interval as Agent thinking because that is not directly observed.

Selecting an operation opens the same detail panel used by the knowledge-network view.

## Knowledge-Network View

The view uses a progressive four-column expansion rather than a full free-form graph:

```text
Knowledge network -> Observed objects -> Relations -> Adjacent objects
```

### Initial state

Show the knowledge-network node and the objects deterministically resolved from this conversation:

- 物料
- 库存
- 采购订单
- 物料请购单
- 产品BOM

### Expansion

- Selecting the network expands or collapses observed objects.
- Selecting an object expands its real adjacent relations.
- Selecting a relation reveals its other endpoint.
- Selecting any node opens its detail in the shared panel.

### Visual states

Only three states are used:

- **Observed**: directly queried object or deterministically resolved from an accessed resource.
- **Network context**: real BKN relation or adjacent object not directly invoked in Trace.
- **Exploration candidate**: returned by `search_schema` but not later observed; hidden behind a single "28 exploration candidates" control by default.

No relation is presented as "used" unless Trace directly records that relation operation.

## Shared Detail Panel

The panel changes by selection type but keeps one information order:

1. **What happened**
   - business operation or BKN element name;
   - Agent and interaction;
   - status and duration for operations.
2. **Business target**
   - knowledge network;
   - object, relation, or data resource;
   - binding status: observed, deterministic binding, or network context.
3. **How it was called**
   - structured business conditions;
   - selected fields and grouping summary where useful.
4. **Result**
   - row/result count when available;
   - controlled result summary.
5. **Reproduce**
   - complete SQL or structured input in a collapsible section.
6. **Technical details**
   - request, operation, resource, artifact, and trace identifiers collapsed by default.

## Prototype Scope

In scope:

- hidden direct URL under the existing BKN Trace module;
- real conversation snapshot data with source IDs preserved;
- interactive view switch;
- progressive knowledge-network expansion;
- selection synchronization;
- collapsible shared detail panel;
- responsive desktop layout suitable for review;
- component tests for the core interactions.

Out of scope:

- replacing the production business-provenance page;
- new Foundry APIs;
- AI-generated optimization recommendations;
- graph pan/zoom/minimap;
- arbitrary conversation loading;
- editing BKN schema;
- security or redaction redesign.

## Technical Approach

- React and TypeScript components inside `src/modules/bkn-trace/prototype/`.
- Ant Design controls for segmented view switching, tags, collapsible details, and typography.
- CSS Grid and lightweight SVG/CSS connectors; no new graph dependency.
- A typed fixture assembled from the real Trace, Query Artifacts, BKN object bindings, and relation definitions.
- A hidden direct route; no production navigation item.

The typed fixture proves the interface with real data while avoiding premature integration coupling. Every displayed field maps to an existing source field documented in the fixture.

## Acceptance Criteria

- The prototype opens through a direct localhost URL.
- It displays both real interactions and all 9 operations.
- Timeline nodes use actual timestamps, durations, targets, and SQL conditions.
- Switching to knowledge-network view shows the verified objects and progressively expands real relations.
- Context relations are visually different from observed operations.
- `search_schema` candidates are not labelled as evidence or actual use.
- Selecting an operation, object, or relation updates the same right-side panel.
- The detail panel expands and collapses without losing selection.
- Raw SQL and technical IDs are available but not the primary visual content.
- No UI element depends on a field or API that does not currently exist.
