import { useTranslation } from "react-i18next";

import type { IndexState } from "@/modules/data-catalog/types/data-catalog";

import styles from "./shared.module.css";

const STATE_CLASS: Record<string, string> = {
  none: styles.taskPending,
  building: styles.taskRunning,
  rebuilding: styles.taskRunning,
  listening: styles.modeStreaming,
  paused: styles.taskPending,
  built: styles.taskSucceeded,
  failed: styles.taskFailed,
};

type IndexStateTagProps = {
  showProgress?: boolean;
  state: IndexState;
};

export function IndexStateTag({ showProgress, state }: IndexStateTagProps) {
  const { t } = useTranslation();

  if (state.key === "failed-stale") {
    return (
      <span className={styles.chipRow}>
        <span className={[styles.tag, styles.taskFailed].join(" ")}>
          {t("dataCatalog.indexState.rebuildFailed")}
        </span>
        <span className={[styles.tag, styles.taskSucceeded].join(" ")}>
          {t("dataCatalog.indexState.staleServing")}
        </span>
      </span>
    );
  }

  let label = t(`dataCatalog.indexState.${state.key}`);

  if (
    showProgress &&
    (state.key === "building" || state.key === "rebuilding") &&
    state.latest &&
    state.latest.totalCount > 0
  ) {
    const percent = Math.min(
      100,
      Math.round((state.latest.vectorizedCount / state.latest.totalCount) * 100),
    );
    label = `${label} ${percent}%`;
  }

  return (
    <span className={[styles.tag, STATE_CLASS[state.key] ?? styles.taskPending].join(" ")}>
      {label}
    </span>
  );
}
