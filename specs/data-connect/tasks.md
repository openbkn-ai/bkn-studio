# 数据连接任务拆分

## 前置确认

### D-1 确认 `vega-backend` 的接口基线
- 确认平台环境中的实际访问路径
- 确认 `catalogs` 与 `connector-types` 的字段基线

产出：
- 一份明确的接口基线说明
- service 层 path 与 DTO 约定

## 一期前端任务

### FE-1 新建数据连接模块骨架
- 新建 `src/modules/data-connect/*`
- 注册模块路由
- 左侧菜单挂载“数据连接”
- 配置路由元信息

### FE-2 定义前端类型与 DTO 映射
- 新建 `types/data-connect.ts`
- 定义 `ConnectorType`、`CatalogEntry`、`CatalogDetail`
- 定义页面模型与后端响应模型的映射函数

### FE-3 实现 service 层
- `listConnectorTypes`
- `listCatalogs`
- `getCatalogById`
- `createCatalog`
- `updateCatalog`
- `deleteCatalog`
- `enableCatalog`
- `disableCatalog`
- `testCatalogConnection`
- `getCatalogHealthStatus`

### FE-4 实现数据连接列表页
- 表格字段
- 搜索
- 类型筛选
- 刷新
- 新建按钮
- 行操作
- 加载态、空态、错误态

### FE-5 实现详情抽屉
- 基础信息
- 连接器类型
- 动态配置展示
- 健康检查状态
- 创建/更新信息

### FE-6 实现新建页
- 连接器类型选择
- 动态表单配置
- 保存前测试连接
- 提交创建

### FE-7 实现编辑页
- 详情回填
- `connector_type` 只读
- 敏感字段展示策略
- 更新提交

### FE-8 实现启用/禁用、删除、测试连接交互
- 列表页操作接线
- 操作反馈
- 错误提示

### FE-9 补齐 i18n 和权限点
- 中文文案
- 英文文案
- 页面权限码占位

## 一期后端任务

### BE-1 盘点现有 `vega-backend` 能力与字段
- 确认 `connector-types` 返回字段
- 确认 `catalogs` 列表、详情、创建、更新字段
- 确认 `test-connection` 和 `health-status` 返回结构

### BE-2 确认鉴权与网关配置
- 确认前端可访问路径
- 确认 token、语言、租户等上下文要求

### BE-3 明确错误码与字段兼容策略
- 列表分页字段
- 表单校验错误
- 测试连接失败错误
- 启停与删除失败错误

## 二期任务

### FE-10 扫描管理页
- 扫描计划列表
- 扫描任务历史

### FE-11 扫描计划配置
- 新建计划
- 编辑计划
- 启用/禁用计划

### FE-12 手动触发扫描与任务详情
- 触发 discover
- 查看任务详情

### BE-5 对接 `discover-schedules`
- 列表
- 新建
- 编辑
- 删除
- 启停

### BE-6 对接 `discover-tasks`
- 列表
- 详情
- 删除

## 联调任务

### INT-1 对齐 connector type 与动态字段
- `field_config` 渲染规则
- 敏感字段规则
- 必填和默认值规则

### INT-2 对齐 catalog DTO
- 列表字段
- 详情字段
- 表单提交字段

### INT-3 对齐交互结果
- 测试连接反馈
- 启停反馈
- 删除反馈

## 验证任务

### QA-1 页面验证
- 可进入数据连接页
- 列表可正常加载
- 空态、错误态正常

### QA-2 表单验证
- 新建正常
- 编辑正常
- 动态字段切换正常
- 校验规则生效

### QA-3 接口验证
- 列表、详情、创建、更新、删除正确
- 测试连接结果可见
- 启用/禁用可见

### QA-4 工程验证
- `pnpm lint`
- `pnpm test -- --run`
- `pnpm build`

## 推荐执行顺序

1. `D-1`
2. `BE-1`
3. `BE-2`
4. `FE-1`
5. `FE-2`
6. `FE-3`
7. `FE-4`
8. `FE-5`
9. `FE-6`
10. `FE-7`
11. `FE-8`
12. `FE-9`
13. `INT-1`
14. `INT-2`
15. `INT-3`
16. `QA-1`
17. `QA-2`
18. `QA-3`
19. `QA-4`

## 当前最小起步切片

建议先做这一刀：

1. 确认 `vega-backend` 在当前平台环境下的访问路径
2. 打通 `connector-types` 列表
3. 打通 `catalogs` 列表
4. 在 `bkn-studio` 落数据连接列表页

原因：
- 这是最小闭环
- 能最早验证新接口模型是否适合当前 UI
- 能最早发现 DTO 和动态字段问题
