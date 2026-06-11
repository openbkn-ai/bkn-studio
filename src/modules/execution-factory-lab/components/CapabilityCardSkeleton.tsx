import { Card, Skeleton } from "antd";

import gridStyles from "../scenes/capability-lab.module.css";
import styles from "./capability-card.module.css";

type CapabilityCardSkeletonProps = {
  count?: number;
};

export function CapabilityCardSkeleton({ count = 6 }: CapabilityCardSkeletonProps) {
  return (
    <div className={gridStyles.grid}>
      {Array.from({ length: count }, (_, index) => (
        <Card className={styles.card} key={index} styles={{ body: { padding: 20 } }}>
          <Skeleton active avatar paragraph={{ rows: 3 }} />
        </Card>
      ))}
    </div>
  );
}
