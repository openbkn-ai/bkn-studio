/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Skeleton } from "antd";

import styles from "./ExecutionUnitCardSkeleton.module.css";

type ExecutionUnitCardSkeletonProps = {
  count?: number;
};

export function ExecutionUnitCardSkeleton({ count = 8 }: ExecutionUnitCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div className={styles.card} key={index}>
          <Skeleton active paragraph={{ rows: 3 }} title={{ width: "60%" }} />
        </div>
      ))}
    </>
  );
}
