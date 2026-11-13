/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { KINETIC, logicKindText } from "@/modules/bkn-project/components/kinetic/kineticMessages";
import { InNetworkDot } from "@/modules/bkn-project/components/kinetic/KineticNeedPanel";
import { implementationPath, openInNewTab } from "@/modules/bkn-project/components/kinetic/needs";
import { useListPage } from "@/modules/bkn-project/components/useListPage";
import type { LogicNeedView, LogicNetworkItem } from "@/modules/bkn-project/types/kinetic";

import styles from "./Kinetic.module.css";

const NETWORK = `${KINETIC}.network`;

/**
 * What the network had before the project: its action types, functions, Skills and metrics,
 * grouped by the object they act on, each marked with a small dot. They are read-only here and
 * open in the network; the needs each covers open as needs do.
 */
export function KineticNetworkItems({
  items,
  needs,
  networkId,
  objectName,
  onOpenNeed,
  reason,
}: {
  items: LogicNetworkItem[];
  needs: LogicNeedView[];
  networkId: string;
  /** The name of an object type by its id; the id when no name is known. */
  objectName: (id: string) => string;
  onOpenNeed: (needId: string) => void;
  /** Why some could not be read; empty when all were. */
  reason: string;
}) {
  const { t } = useTranslation();
  const groups = new Map<string, LogicNetworkItem[]>();
  for (const item of items) {
    groups.set(item.ownerObjectTypeId, [...(groups.get(item.ownerObjectTypeId) ?? []), item]);
  }
  // Items on an object come first, by its name; those on none last.
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === "" ? 1 : b === "" ? -1 : objectName(a).localeCompare(objectName(b)),
  );
  // The list pages its items, 20 a page; an object's items split over two pages are named on each.
  const listPage = useListPage(items.length);
  const paged: [string, LogicNetworkItem[]][] = [];
  for (const item of listPage.slice(ordered.flatMap(([, group]) => group))) {
    const last = paged.at(-1);
    if (last && last[0] === item.ownerObjectTypeId) {
      last[1].push(item);
    } else {
      paged.push([item.ownerObjectTypeId, [item]]);
    }
  }
  const groupName = (id: string, group: LogicNetworkItem[]) =>
    id === ""
      ? t(`${NETWORK}.noObject`)
      : objectName(id) !== id
        ? objectName(id)
        : (groups.get(id) ?? group).find((item) => item.ownerObjectTypeName)?.ownerObjectTypeName ||
          id;

  return (
    <section aria-label={t(`${NETWORK}.title`)} className={styles.block}>
      <h4 className={styles.blockTitle}>
        <span className={styles.row}>
          <InNetworkDot />
          {t(`${NETWORK}.title`)}
        </span>
      </h4>
      <p className={styles.muted}>{t(`${NETWORK}.readOnly`)}</p>
      {reason ? <Alert message={t(`${NETWORK}.unreadable`)} showIcon type="warning" /> : null}
      {paged.map(([id, group]) => (
        <div className={styles.block} key={id || "none"}>
          <span className={styles.muted}>{groupName(id, group)}</span>
          <ul className={styles.list}>
            {group.map((item) => {
              const path = networkId
                ? implementationPath(networkId, { ...item, at: 0, byId: "" })
                : null;
              const covered = needs.filter((need) => item.needIds.includes(need.id));
              return (
                <li className={styles.card} key={`${item.type}/${item.boxId}/${item.id}`}>
                  <span className={styles.row}>
                    <InNetworkDot />
                    <strong>{item.name || item.id}</strong>
                    <LightStatusTag tone="info">{logicKindText(t, item.kind)}</LightStatusTag>
                    <span className={styles.spacer} />
                    {path ? (
                      <AppButton
                        aria-label={t(`${NETWORK}.viewItem`, { name: item.name || item.id })}
                        onClick={() => openInNewTab(path)}
                        size="small"
                        type="link"
                      >
                        {t(`${NETWORK}.view`)}
                      </AppButton>
                    ) : null}
                  </span>
                  {item.description ? (
                    <span className={styles.muted}>{item.description}</span>
                  ) : null}
                  {covered.length ? (
                    <span className={styles.row}>
                      <span className={styles.muted}>{t(`${NETWORK}.covers`)}</span>
                      {covered.map((need) => (
                        <AppButton
                          aria-label={t(`${NETWORK}.openNeed`, { name: need.name })}
                          key={need.id}
                          onClick={() => onOpenNeed(need.id)}
                          size="small"
                          type="link"
                        >
                          {need.name}
                        </AppButton>
                      ))}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {listPage.pagination ? <TablePaginationBar {...listPage.pagination} /> : null}
    </section>
  );
}
