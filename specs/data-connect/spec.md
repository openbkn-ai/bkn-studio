# 数据连接需求说明

## 需求标识

- Feature: `data-connect`
- Status: `draft`
- Goal: 在 `bkn-studio` 中重建“数据连接”模块，先完成需求梳理，明确前端页面范围、后端接口范围、差异清单与实现边界。

## 需求来源

本需求的参考来源有三类：

1. 旧前端实现
   - 目录：`D:\kowell\kowell-dip\web\apps\vega\src\pages\DataConnect`
   - 路由入口：`/data-connect`
2. 旧服务调用契约
   - `D:\kowell\kowell-dip\web\apps\vega\src\services\dataConnect`
   - `D:\kowell\kowell-dip\web\apps\vega\src\services\scanManagement`
3. 新项目目标后端
   - 目录：`D:\kowell\kowell-core\kowell-core\adp\bkn\bkn-backend\server`
4. 指定线上入口
   - `https://118.196.7.174/dip-hub/business-network/vega/data-connect`
   - 该地址可返回 SPA 入口 HTML，但当前未直接读取到渲染后的页面细节，因此本次以旧前端源码作为等效静态页基线。

## 参考文件

### 旧前端核心页面

- `src/pages/router.tsx`
- `src/pages/DataConnect/tabs.tsx`
- `src/pages/DataConnect/index.tsx`
- `src/pages/DataConnect/DataConnectForm/index.tsx`
- `src/pages/DataConnect/DataConnectForm/DataConnectType/index.tsx`
- `src/pages/DataConnect/DataConnectForm/DataConnectConfig/index.tsx`
- `src/pages/DataConnect/ScanManagement/index.tsx`
- `src/pages/DataConnect/ExcelForm/index.tsx`
- `src/pages/DataConnect/Components/ScanTaskConfig/index.tsx`

### 旧前端接口与类型

- `src/services/dataConnect/index.ts`
- `src/services/dataConnect/type.ts`
- `src/services/scanManagement/index.ts`
- `src/services/scanManagement/type.ts`

### 新后端现状

- `driveradapters/routers.go`
- `driveradapters/resource_handler.go`
- `interfaces/vega_backend_access.go`
- `drivenadapters/vega_backend/vega_backend_access.go`
- `main.go`

## 模块范围

旧实现里的“数据连接”实际上是一个复合模块，不是单页。

当前完整范围包括：

1. 数据连接管理页
2. 数据连接新建页
3. 数据连接编辑页
4. 数据连接详情抽屉
5. Excel 元数据创建弹窗
6. 扫描管理页
7. 新建扫描任务弹窗
8. 扫描任务详情/执行明细
9. 按表选择扫描对象弹窗

## 页面结构与流程

### 1. 数据连接管理页

页面入口：

- `/data-connect`

主结构：

- 顶部 tab
  - `数据连接管理`
  - `扫描管理`
- 列表工具栏
  - 关键词搜索
  - 刷新
  - 新建
  - 类型筛选
  - 排序
- 主表格
- 详情抽屉
- Excel 元数据配置弹窗
- 扫描任务配置弹窗

表格列：

- 名称
- 操作
- 数据源类型
- Host
- 操作人
- 更新时间
- 扫描状态

行操作：

- 查看详情
- 创建元数据
- 编辑
- 测试连接
- 创建扫描任务
- 删除

状态规则：

- 扫描状态根据 `latest_task_status` 展示徽标
- `metadata_obtain_level` 决定是否显示“扫描”或“创建元数据”动作
- 操作项受权限码控制

### 2. 数据连接新建/编辑页

页面入口：

- `/data-connect/create`
- `/data-connect/edit/:id`

主结构：

- 顶部步骤条
  - 第一步：选择连接类型
  - 第二步：数据源配置
- 底部固定按钮区

创建流程：

1. 先选择连接器类型
2. 再填写连接配置
3. 可先测试连接
4. 保存成功后返回列表

编辑流程：

- 直接进入第二步
- 回填已有配置
- 密码默认脱敏，占位为 `********`
- 是否更新密码由再次聚焦密码框触发

#### 连接类型选择页

包含：

- 类型 tabs
- 类型搜索
- 卡片式连接器列表

选择结果：

- 选中某个 connector 后进入配置页

#### 数据源配置页字段

通用字段：

- 数据源名称
- 连接协议
- 备注

按连接器类型动态出现的字段：

- 存储介质
- 数据库名
- schema 名
- host
- port
- 认证方式
- token
- 用户名 / 用户 ID
- 密码
- 部署方式
- 副本集名称
- 存储路径

校验规则：

- 名称必填，长度上限 128
- 名称只允许字母、数字、下划线、中文、中划线
- host、port、用户、密码等按类型动态必填
- 不同连接器类型决定字段显隐

### 3. 详情抽屉

展示内容：

- 基础配置分组
- 连接信息
- 更新人、更新时间
- 元数据管理区
- 数据库表结构区
- 扫描任务区

特殊分支：

- Excel 类型展示 ExcelTable
- 非 Excel 类型展示 DatabaseTable
- 支持扫描的数据源展示 ScanTask

### 4. Excel 元数据创建弹窗

触发入口：

- 对 `metadata_obtain_level === 3` 的连接执行“创建元数据”

字段：

- 文件选择
- 元数据名称
- sheet 多选
- 单元格范围
- 字段配置方式
  - 首行作为字段名
  - 自定义
- sheet 名是否作为新字段

校验规则：

- 文件必选
- 元数据名称必填并符合命名规则
- sheet 必选
- 起止单元格都必填且格式合法
- 结束单元格不能在开始单元格之前

### 5. 扫描管理页

tab 入口：

- `扫描管理`

主结构：

- 工具栏
  - 搜索任务名
  - 新建扫描任务
  - 状态筛选
  - 排序
- 表格
- 新建任务弹窗
- 详情弹窗
- 定时任务编辑弹窗

表格列：

- 名称
- 操作
- 任务类型
- 任务状态
- 扫描状态
- 扫描进度
- 创建人
- 创建时间

行操作：

- 查看
- 编辑（仅定时任务）

### 6. 扫描任务配置弹窗

支持两种模式：

- 立即扫描
- 定时扫描

字段：

- 扫描类型
- 定时表达式
  - 固定频率
  - cron 表达式
- 扫描策略
  - 仅扫描新表
  - 仅扫描变更表
  - 仅清理失效表
- 任务开关

行为：

- 创建模式支持批量创建多个扫描任务
- 编辑模式支持更新定时任务配置和开关

## 旧接口契约

### 数据连接接口

旧前端依赖的核心接口：

- `GET /api/data-connection/v1/datasource`
- `GET /api/data-connection/v1/datasource/:id`
- `POST /api/data-connection/v1/datasource`
- `PUT /api/data-connection/v1/datasource/:id`
- `DELETE /api/data-connection/v1/datasource/:ids`
- `GET /api/data-connection/v1/datasource/connectors`
- `POST /api/data-connection/v1/datasource/test`

### 扫描管理接口

- `GET /api/data-connection/v1/metadata/scan`
- `POST /api/data-connection/v1/metadata/scan`
- `POST /api/data-connection/v1/metadata/scan/batch`
- `GET /api/data-connection/v1/metadata/scan/status/:taskId`
- `POST /api/data-connection/v1/metadata/scan/status`
- `POST /api/data-connection/v1/metadata/scan/retry`
- `GET /api/data-connection/v1/metadata/data-source/:id`
- `GET /api/data-connection/v1/metadata/table/:tableId`
- `GET /api/data-connection/v1/metadata/scan/info/:taskId`
- `GET /api/data-connection/v1/metadata/scan/schedule/:scheduleId`
- `GET /api/data-connection/v1/metadata/scan/schedule/task/:scheduleId`
- `PUT /api/data-connection/v1/metadata/scan/schedule/status`
- `PUT /api/data-connection/v1/metadata/scan/schedule`

### Excel 配置接口

- `POST /api/data-connection/v1/gateway/excel/columns`
- `POST /api/data-connection/v1/gateway/excel/table`
- `DELETE /api/data-connection/v1/gateway/excel/table/:tableId`
- `GET /api/data-connection/v1/gateway/excel/sheet`
- `GET /api/data-connection/v1/gateway/excel/files/:catalog`

## 当前前端现状

`bkn-studio` 当前只有：

- 控制台壳层
- 框架示例模块 `starter`
- 列表页/表单页/详情抽屉/工具栏/空态等母能力

当前没有：

- 数据连接模块目录
- 数据连接路由
- 数据源列表/表单/详情/扫描页
- 对应 service / types

## 当前后端现状

`bkn-backend` 当前没有旧接口等价的 `data-connect` 模块。

已确认情况：

- `driveradapters/routers.go` 中没有 `/data-connection/*` 路由
- `driveradapters` 中没有 `data_connect_handler.go`
- `logics` 中没有数据连接 service
- `interfaces` 中没有数据连接 service / access 定义
- 当前只存在 `interfaces/vega_backend_access.go` 与 `drivenadapters/vega_backend/*`
- 说明现有后端最多只具备“访问 Vega 资源服务”的能力，不具备旧前端要求的完整数据连接业务接口

## 差异清单

### Already supported

- `bkn-studio` 已有控制台壳层，可直接挂载新模块
- `bkn-studio` 已有列表页、表单页、详情区、工作区工具栏、空态等通用骨架
- `bkn-backend` 已有标准的 `driveradapters -> logics -> drivenadapters/interfaces` 分层
- `bkn-backend` 已有 `vega_backend_access`，可作为未来对接底层资源服务的复用入口

### Needs frontend work

- 需要新增数据连接模块路由和目录结构
- 需要重建 tab 式双页结构：数据连接管理 / 扫描管理
- 需要重建数据源列表、详情、创建/编辑两步表单
- 需要重建 Excel 元数据弹窗、扫描任务配置弹窗、扫描详情视图
- 需要补齐 `services`、`types`、i18n 和状态编排

### Needs backend work

- 需要在 `bkn-backend` 新增数据连接模块的路由、handler、service、access 定义
- 需要明确数据源、连接器、扫描任务、Excel 相关接口契约
- 需要决定哪些能力由 `bkn-backend` 自己实现，哪些通过 `vega_backend_access` 或其他外部服务代理
- 需要补权限、校验、错误码和测试

### Needs explicit compromise or clarification

- 是否第一阶段完整重建旧模块全部能力，还是先只做“数据源列表 + 新建/编辑 + 详情”
- 旧模块中的“扫描管理”和“Excel 元数据”是否必须同步进入第一期
- 新后端是否继续沿用旧 `/api/data-connection/v1/*` 契约，还是统一切到 `bkn-backend` 自己的命名空间
- 是否保留旧模块中的“测试连接”“删除”“扫描任务”这些操作时序和权限模型

## 建议切分

建议不要一次性把旧模块全量复制过来，按下面顺序推进：

1. 数据连接管理列表页
2. 新建/编辑数据连接
3. 数据连接详情
4. 测试连接
5. 扫描管理
6. Excel 元数据

## 第一阶段推荐范围

第一阶段建议只交付：

1. 数据连接列表页
2. 数据连接新建/编辑页
3. 数据连接详情页或详情抽屉
4. 连接器列表接口
5. 数据源 CRUD 与测试连接接口

先不纳入第一阶段：

- 扫描管理整套流程
- Excel 元数据管理
- 按表扫描
- 扫描历史与执行详情
