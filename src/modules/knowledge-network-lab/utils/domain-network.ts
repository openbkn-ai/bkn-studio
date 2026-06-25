/** 领域业务知识网络（实验版）派生计算与展示元数据。 */

import type {
  DomainNetwork,
  EntityClass,
  RelationClass,
} from "@/modules/knowledge-network-lab/types/domain-network";

export function entityOf(net: DomainNetwork, key: string | null): EntityClass | null {
  if (!key) {
    return null;
  }
  return net.entityClasses.find((entity) => entity.key === key) ?? null;
}

export function relationsOf(net: DomainNetwork, key: string): RelationClass[] {
  return net.relationClasses.filter((relation) => relation.from === key || relation.to === key);
}

/** 与选中实体类相邻的实体类 key 集合。 */
export function neighborsOf(net: DomainNetwork, key: string | null): Set<string> {
  const neighbors = new Set<string>();
  if (!key) {
    return neighbors;
  }
  net.relationClasses.forEach((relation) => {
    if (relation.from === key) {
      neighbors.add(relation.to);
    }
    if (relation.to === key) {
      neighbors.add(relation.from);
    }
  });
  return neighbors;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** 相对时间（依赖 i18n key：time.justNow / minutesAgo / hoursAgo / daysAgo）。 */
export function formatTimeAgo(
  timestamp: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!timestamp) {
    return "—";
  }
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return t("knowledgeNetworkLab.time.justNow");
  }
  if (minutes < 60) {
    return t("knowledgeNetworkLab.time.minutesAgo", { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t("knowledgeNetworkLab.time.hoursAgo", { n: hours });
  }
  const days = Math.floor(hours / 24);
  return t("knowledgeNetworkLab.time.daysAgo", { n: days });
}
