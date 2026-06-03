# 数据连接开发计划

## 目标

在 `bkn-studio` 中按新框架重建“数据连接”模块，并为 `bkn-backend` 补齐第一阶段所需的接口能力。

## 推荐分期

### Phase 1：数据源基础管理

目标：

- 实现数据源列表
- 实现数据源新建/编辑
- 实现数据源详情
- 实现测试连接
- 接通连接器列表与数据源 CRUD

### Phase 2：扫描管理

目标：

- 实现扫描管理 tab
- 实现立即扫描 / 定时扫描配置
- 实现扫描任务列表与详情

### Phase 3：Excel 元数据

目标：

- 实现 Excel 元数据创建弹窗
- 实现文件 / sheet / 单元格范围能力

## 第一阶段前端计划

### 计划改动区域

- `src/modules/data-connect/*`
- `src/app/router/*`
- `src/app/locales/resources/*`
- 必要时补 `src/framework/ui/*` 通用能力

### 前端结构建议

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

### 前端复用策略

优先复用：

- 控制台壳层
- 工作区标题和工具栏
- `CrudListPage`
- `CrudFormPage`
- `EmptyStatePanel`
- 请求层、权限层、i18n

需要新增：

- 双步骤表单容器
- 连接器选择卡片区
- 详情抽屉内容编排

## 第一阶段后端计划

### 计划改动区域

- `driveradapters/*`
- `logics/*`
- `interfaces/*`
- `drivenadapters/*`

### 后端结构建议

建议新增独立的数据连接模块，例如：

```text
driveradapters/
  data_connect_handler.go
  data_connect_handler_test.go

logics/
  data_connect/
    data_connect_service.go
    data_connect_service_test.go

interfaces/
  data_connect_service.go
  data_connect_access.go
  data_connect.go

drivenadapters/
  data_connect/
    data_connect_access.go
    data_connect_access_test.go
```

### 后端实现策略

第一阶段至少补齐：

- 连接器列表
- 数据源列表查询
- 数据源详情
- 数据源创建
- 数据源更新
- 数据源删除
- 测试连接

实现方式建议：

- `bkn-backend` 暴露统一接口
- 底层如需访问旧服务或 Vega 资源服务，通过新的 access 层或 `vega_backend_access` 封装
- 不要让前端继续直接依赖旧 `vega` 服务路径

## 风险

### 风险 1：旧模块范围过大

说明：

- 数据连接旧模块实际上包含数据源、元数据、扫描任务、Excel 等多块内容。

处理：

- 严格分期，第一阶段只做基础数据源管理。

### 风险 2：新后端当前没有对等模块

说明：

- 不是简单搬前端，后端需要补完整模块。

处理：

- 文档先显式把“后端为空白”写清，不假设已有接口。

### 风险 3：旧接口命名空间与新项目不一致

说明：

- 旧接口都挂在 `/api/data-connection/v1/*`。

处理：

- 第一阶段先明确是否保留兼容路径或在 `bkn-backend` 下提供新的聚合接口。

### 风险 4：连接器字段强依赖旧实现

说明：

- 不同连接器的动态字段和校验规则很多。

处理：

- 第一阶段优先支持旧实现中最常见的连接器，并把字段显隐逻辑做成类型映射配置。

## 完成定义

第一阶段完成的标准：

1. 左侧菜单可进入“数据连接”
2. 可查看数据源列表
3. 可创建、编辑、查看、删除数据源
4. 可测试连接
5. 新后端提供稳定接口并完成联调
6. 文档、类型、权限、自测都补齐
