/**
 * 领域业务知识网络（实验版）视图模型。
 *
 * 数据全部来自真实后端（ontology-manager via `@/modules/knowledge-network` 服务，
 * 内置 mock/real 切换）。只保留后端确实提供的字段，把
 *   knowledge-network → 领域网络
 *   object-type       → 实体类
 *   relation-type     → 关系类
 *   metric            → 指标（检索沙盒按其试算数据）
 * 映射成图谱呈现需要的形状。后端没有「建模状态」这一概念，故不展示状态。
 */

export type EntityProp = {
  name: string;
  type: string;
  /** 主键。 */
  pk: boolean;
  /** 该属性是否参与索引（fulltext/keyword/vector 任一启用）。 */
  indexed: boolean;
};

/** 实体类绑定的数据资源（来自 object-type detail 的 dataSource）。 */
export type BoundResource = {
  id: string;
  name: string;
  /** 实体类是否已建索引（object-type.hasIndex）。 */
  indexed: boolean;
};

/** 图谱节点（带布局坐标，坐标系 1000×720，与 compute-preview-graph-layout 对齐）。 */
export type GraphNode = {
  key: string;
  name: string;
  color: string;
  x: number;
  y: number;
};

export type EntityClass = GraphNode & {
  /** 度数最高的实体类，图谱中半径更大。 */
  hub: boolean;
  /** object-type.hasIndex。 */
  indexed: boolean;
  props: EntityProp[];
  boundResource: BoundResource | null;
  conceptGroups: string[];
};

export type RelationClass = {
  key: string;
  name: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  mappingMode: "direct" | "resource";
};

export type DomainNetworkStats = {
  objectTypes: number;
  relationTypes: number;
  conceptGroups: number;
  metrics: number;
};

/** 列表卡片用的领域网络摘要（不再附带本体缩略图，避免逐网络拉本体）。 */
export type DomainNetworkSummary = {
  id: string;
  slug: string;
  name: string;
  domain: string;
  desc: string;
  owner: string;
  updatedAt: number;
  color: string;
  stats: DomainNetworkStats;
};

/** 详情页用的完整领域网络（含实体类 / 关系类）。 */
export type DomainNetwork = DomainNetworkSummary & {
  entityClasses: EntityClass[];
  relationClasses: RelationClass[];
};

export type DomainNetworkListQuery = {
  keyword?: string;
};
