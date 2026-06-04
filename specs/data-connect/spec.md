# 数据连接需求说明

## 需求标识
- Feature: `data-connect`
- Status: `draft`
- Goal: 在 `bkn-studio` 中建设新的“数据连接”模块，前端模块名保持 `data-connect`，后端能力优先对齐 `vega-backend` 中已经存在的 `catalog / connector-types / discover-schedules / discover-tasks` 模型。

## 需求来源
1. 旧前端页面与交互
   - `D:\kowell\kowell-dip\web\apps\vega\src\pages\DataConnect`
   - 线上入口：[vega data-connect](https://118.196.7.174/dip-hub/business-network/vega/data-connect)
2. 旧前端服务定义
   - `D:\kowell\kowell-dip\web\apps\vega\src\services\dataConnect`
   - `D:\kowell\kowell-dip\web\apps\vega\src\services\scanManagement`
3. 新后端现状
   - `D:\kowell\kowell-core\kowell-core\adp\vega\vega-backend\server`
   - 重点目录：
     - `driveradapters`
     - `logics/catalog`
     - `logics/connector_type`
     - `logics/discover_schedule`
     - `logics/discover_task`
     - `logics/connectors`

## 参考文件

### 旧前端
- `src/pages/router.tsx`
- `src/pages/DataConnect/tabs.tsx`
- `src/pages/DataConnect/index.tsx`
- `src/pages/DataConnect/DataConnectForm/index.tsx`
- `src/pages/DataConnect/DataConnectForm/DataConnectType/index.tsx`
- `src/pages/DataConnect/DataConnectForm/DataConnectConfig/index.tsx`
- `src/pages/DataConnect/ScanManagement/index.tsx`
- `src/pages/DataConnect/ExcelForm/index.tsx`
- `src/pages/DataConnect/Components/ScanTaskConfig/index.tsx`
- `src/services/dataConnect/index.ts`
- `src/services/dataConnect/type.ts`
- `src/services/scanManagement/index.ts`
- `src/services/scanManagement/type.ts`

### 新后端
- `driveradapters/router.go`
- `driveradapters/catalog_handler.go`
- `driveradapters/connector_type_handler.go`
- `driveradapters/discover_schedule_handler.go`
- `driveradapters/discover_task_handler.go`
- `logics/catalog/catalog_service.go`
- `logics/connector_type/connector_type_service.go`
- `logics/connectors/*`

## 需求结论

新的“数据连接”不是从零设计后端，而是要把旧 `vega` 前端里的业务入口，映射到 `vega-backend` 已经存在的新领域模型。

对应关系如下：

- 前端“数据连接实例/数据源”
  - 对应后端 `catalogs`
- 前端“连接器类型/动态配置字段”
  - 对应后端 `connector-types`
- 前端“扫描计划”
  - 对应后端 `discover-schedules`
- 前端“扫描任务记录”
  - 对应后端 `discover-tasks`
- 前端“真实连接能力”
  - 对应后端 `logics/connectors/*`

因此，本次需求文档的基线应当是：

1. 前端模块仍然叫 `data-connect`
2. 页面交互参考旧 `vega` 页面
3. 接口语义优先对齐 `vega-backend`
4. 不再以旧 `/api/data-connection/v1/*` 作为新实现的主契约

## 模块范围

旧实现里的“数据连接”实际是一个复合模块，包含：

1. 数据连接管理页
2. 数据连接新建页
3. 数据连接编辑页
4. 数据连接详情抽屉
5. 扫描管理页
6. 扫描计划配置弹窗
7. 扫描任务详情
8. Excel 元数据相关能力

但新项目不建议一次性全量重建，应该分阶段推进。

## 页面结构

### 1. 数据连接管理页
- 路由建议：`/general-business-network/data-connect`
- 主体区域包含：
  - 页面标题与描述
  - 工具栏
    - 新建
    - 搜索
    - 类型筛选
    - 刷新
  - 列表区
  - 详情抽屉

列表建议字段：
- 名称
- 连接器类型
- 类别
- 连接模式
- 启用状态
- 健康检查状态
- 最近检查时间
- 更新人
- 更新时间

行操作建议：
- 查看详情
- 编辑
- 测试连接
- 启用/禁用
- 删除
- 触发扫描

### 2. 数据连接新建页
- 路由建议：`/general-business-network/data-connect/create`
- 两步结构：
  - 第一步：选择连接器类型
  - 第二步：填写连接配置

页面行为：
- 先选择 connector type
- 再根据 `field_config` 渲染动态表单
- 支持保存前测试连接

### 3. 数据连接编辑页
- 路由建议：`/general-business-network/data-connect/:id/edit`
- 编辑态直接进入配置页
- 根据详情接口回填
- 敏感字段遵循后端脱敏策略
- `connector_type` 默认不允许变更

### 4. 数据连接详情
- 建议沿用右侧抽屉
- 展示内容：
  - 基础信息
  - 连接器信息
  - 动态连接配置
  - 健康检查状态
  - 创建/更新信息

### 5. 扫描管理页
- 可以作为二期独立页或同模块第二个子页
- 主体内容：
  - 扫描计划列表
  - 计划启停
  - 任务历史
  - 任务详情

### 6. Excel 元数据能力
- 暂不进入一期
- 只有在确认 `vega-backend` 里仍需要保留这类独立能力时再单独设计

## 后端语义映射

### 连接器类型
来源：`connector-types`

关键能力：
- 获取连接器类型列表
- 获取单个连接器类型详情
- 连接器类型启用/禁用
- 读取 `field_config`

对应前端用途：
- 新建页类型选择
- 动态表单字段渲染
- 类型筛选

### 数据连接实例
来源：`catalogs`

关键能力：
- 列表
- 详情
- 创建
- 更新
- 删除
- 启用/禁用
- 测试连接
- 健康状态查询
- 触发 discover

对应前端用途：
- 数据连接管理主列表
- 新建/编辑表单
- 详情抽屉
- 测试连接

### 扫描计划
来源：`discover-schedules`

关键能力：
- 创建计划
- 更新计划
- 删除计划
- 启停计划
- 列表与详情

对应前端用途：
- 扫描管理页
- 扫描计划配置弹窗

### 扫描任务
来源：`discover-tasks`

关键能力：
- 列表
- 详情
- 删除

对应前端用途：
- 扫描任务历史
- 扫描任务详情

## 当前前端现状

`bkn-studio` 当前已经具备：
- 控制台壳层
- 左侧导航和工作区布局
- 列表页/表单页/详情抽屉骨架
- 请求层、权限层、i18n、空态、工具栏

`bkn-studio` 当前还没有：
- `data-connect` 模块目录
- `data-connect` 模块路由
- 数据连接列表页、表单页、详情抽屉
- 对接 `vega-backend` 的 service / types

## 当前后端现状

需要明确平台关系：

1. `bkn-studio`
   - 是 `bkn平台` 的统一前端
   - 允许按业务模块对接多个平台后端
2. `vega-backend\server`
   - 当前已经提供“数据连接”所需的主链路能力
   - 包括 `catalogs`、`connector-types`、`discover-schedules`、`discover-tasks`
3. `bkn-backend\server`
   - 是平台中的另一个后端模块
   - 不是本次“数据连接”一期的主能力来源

因此本次需求基线应明确为：

- `bkn-studio` 作为平台统一前端，直接对接 `vega-backend` 属于正常架构
- “数据连接”一期以后端 `vega-backend` 为准
- `bkn-backend` 只在它自身业务归属的模块中承接前端请求

## 差异清单

### Already supported
- `bkn-studio` 已经有控制台壳层和工作区骨架
- `vega-backend` 已经有连接器、catalog、discover 的主链路能力
- 新后端已经有连接测试、启停、列表、更新等基础接口语义

### Needs frontend work
- 新增 `data-connect` 模块路由与目录
- 基于 `catalogs` 重建数据连接管理页
- 基于 `connector-types` 重建连接器选择与动态表单
- 重建详情抽屉
- 后续补扫描管理页

### Needs backend clarification
- `bkn-studio` 对接 `vega-backend` 时使用哪条实际环境路径
- 平台网关如何暴露 `vega-backend` 这一组接口
- 权限模型是否直接沿用 `vega-backend` 现有资源权限语义

### Needs explicit compromise
- 一期是否只做数据连接管理，不做扫描管理
- 是否保留旧页里的 tab 结构
- Excel 元数据能力是否继续存在于新项目

## 分期建议

### Phase 1
- 数据连接列表
- 新建/编辑
- 详情抽屉
- 测试连接
- 启用/禁用
- 删除
- 类型列表与动态表单

### Phase 2
- 扫描计划管理
- 扫描任务历史
- 手动触发扫描

### Phase 3
- Excel 元数据相关能力
- 旧模块中的特殊细节补齐

## 一期交付边界

一期只要求打通以下闭环：

1. 菜单进入“数据连接”
2. 可查询 `catalogs` 列表
3. 可读取 `connector-types`
4. 可新建、编辑、查看、删除连接
5. 可测试连接
6. 页面结构与控制台壳层风格一致

一期暂不纳入：
- 扫描管理整套流程
- Excel 元数据能力
- 按表扫描和扫描详情扩展能力
