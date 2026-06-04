# 数据连接开发计划

## 目标

在 `bkn-studio` 中建设新的“数据连接”模块，一期先完成“连接实例管理”主链路。前端页面沿用新控制台壳层，后端语义优先对齐 `vega-backend` 的：

- `connector-types`
- `catalogs`
- `discover-schedules`
- `discover-tasks`

## 总体策略

### 策略 1：前端保留业务入口名
- 模块名仍使用 `data-connect`
- 菜单名使用“数据连接”
- 页面体验参考旧 `vega` 页面

### 策略 2：后端对齐新模型
- 不再以旧 `/api/data-connection/v1/*` 作为新一期主契约
- 一期前端直接按 `vega-backend` 的 `catalogs + connector-types` 设计页面和类型

### 策略 3：严格分期
- 一期只做连接实例管理
- 二期再做扫描计划与任务
- 三期再看 Excel 相关能力是否需要保留

## 分期

### Phase 1：连接实例管理

范围：
- 连接器类型列表
- 数据连接列表
- 数据连接详情
- 新建数据连接
- 编辑数据连接
- 删除数据连接
- 启用/禁用
- 测试连接

依赖后端：
- `GET /api/vega-backend/v1/connector-types`
- `GET /api/vega-backend/v1/catalogs`
- `GET /api/vega-backend/v1/catalogs/:id`
- `POST /api/vega-backend/v1/catalogs`
- `PUT /api/vega-backend/v1/catalogs/:id`
- `DELETE /api/vega-backend/v1/catalogs/:id`
- `POST /api/vega-backend/v1/catalogs/:id/enable`
- `POST /api/vega-backend/v1/catalogs/:id/disable`
- `POST /api/vega-backend/v1/catalogs/:id/test-connection`
- `GET /api/vega-backend/v1/catalogs/:id/health-status`

### Phase 2：扫描管理

范围：
- 扫描计划列表
- 新建/编辑扫描计划
- 启停扫描计划
- 扫描任务历史
- 手动触发扫描

依赖后端：
- `discover-schedules`
- `discover-tasks`
- `POST /catalogs/:id/discover`

### Phase 3：扩展能力

范围：
- Excel 元数据能力
- 旧页面中的特殊视图和特化交互

## 一期前端计划

### 计划改动区域
- `src/modules/data-connect/*`
- `src/app/shell/console-navigation.tsx`
- `src/app/locales/resources/*`
- 需要时补 `src/framework/ui/common/*`

### 建议目录结构

```text
src/modules/data-connect/
  pages/
    DataConnectListPage.tsx
    DataConnectFormPage.tsx
    DataConnectDetailDrawer.tsx
  components/
    ConnectorTypePicker.tsx
    DataConnectConfigForm.tsx
  services/
    data-connect.service.ts
  types/
    data-connect.ts
  routes.tsx
```

### 一期页面组织

#### 列表页
- 基于 `WorkspaceToolbar + CrudListPage`
- 支持搜索、类型筛选、刷新、新建
- 列表行提供查看、编辑、测试连接、启停、删除

#### 新建页
- 两步结构
- 第一步选择 `connector-type`
- 第二步根据 `field_config` 渲染动态表单

#### 编辑页
- 读取详情后回填
- 保持 `connector_type` 不可改
- 敏感字段按后端脱敏策略处理

#### 详情抽屉
- 展示 catalog 基础信息
- 展示连接器类型与配置
- 展示健康状态

## 一期后端计划

### 计划改动区域

本次一期默认直接对接 `vega-backend`，不额外引入“是否经由 `bkn-backend`”的前置决策。

### 后端优先复用点
- `driveradapters/catalog_handler.go`
- `driveradapters/connector_type_handler.go`
- `logics/catalog/catalog_service.go`
- `logics/connector_type/connector_type_service.go`
- `logics/connectors/*`

### 平台接入约束

`bkn-studio` 是平台统一前端，因此本模块允许直接调用 `vega-backend`。

约束重点是：
- service 层清晰声明该模块依赖 `vega-backend`
- 页面层不要直接散落后端路径
- 如果未来平台网关路径变化，只改 service 层和运行时配置

## 风险

### 风险 1：旧前端与新后端模型不完全同名

说明：
- 旧页叫 `datasource`
- 新后端叫 `catalog`

处理：
- 在前端内部保留 `data-connect` 业务语义
- 在 service 层做 DTO 映射，不把后端命名直接泄漏到页面组件

### 风险 2：动态字段配置复杂

说明：
- `field_config` 决定表单结构、必填、显示条件、敏感字段

处理：
- 一期先围绕 `connector-types` 返回结构做通用渲染器
- 避免为每种连接器写死页面

### 风险 3：平台环境下的实际访问路径可能变化

说明：
- 开发、测试、生产环境中，`vega-backend` 可能通过不同网关前缀暴露

处理：
- 前端 service 层封装路径与 DTO
- 页面层不直接依赖具体接口命名

### 风险 4：旧模块范围过大

说明：
- 扫描、Excel、任务明细都在旧模块里

处理：
- 一期只做 catalog 管理闭环

## 一期完成定义

满足以下条件即可判定一期完成：

1. 左侧菜单可进入“数据连接”
2. 可读取连接器类型列表
3. 可查看数据连接列表
4. 可创建、编辑、查看、删除数据连接
5. 可测试连接
6. 可启用/禁用
7. UI 风格融入当前控制台壳层
8. 文档、类型、接口映射、自测补齐
