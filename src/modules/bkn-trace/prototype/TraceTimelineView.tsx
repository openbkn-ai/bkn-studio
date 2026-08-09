/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckCircleFilled, ClockCircleOutlined } from "@ant-design/icons";

import type {
  TraceInteractionSnapshot,
  TraceOperationSnapshot,
} from "@/modules/bkn-trace/prototype/bkn-trace-prototype.types";
import { formatDuration } from "@/modules/bkn-trace/prototype/bkn-trace-prototype.format";
import styles from "@/modules/bkn-trace/prototype/BknTracePrototypeScene.module.css";

interface TraceTimelineViewProps {
  interactions: TraceInteractionSnapshot[];
  selectedOperationId: string;
  onSelectOperation: (operation: TraceOperationSnapshot) => void;
  objectNames: Map<string, string>;
}

function toMilliseconds(timestamp: string): number {
  return new Date(timestamp).getTime();
}

function formatClock(timestamp: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function TimelineOperation({
  operation,
  previousTimestamp,
  selected,
  objectName,
  onSelect,
}: {
  operation: TraceOperationSnapshot;
  previousTimestamp: string;
  selected: boolean;
  objectName?: string;
  onSelect: () => void;
}) {
  const gapMs = Math.max(0, toMilliseconds(operation.startedAt) - toMilliseconds(previousTimestamp));

  return (
    <div className={styles.timelineStep} data-testid="timeline-operation">
      <div className={styles.gapLabel}>+{formatDuration(gapMs)} 后</div>
      <span className={styles.timelineDot} aria-hidden="true" />
      <button
        type="button"
        className={`${styles.operationCard} ${selected ? styles.operationCardSelected : ""}`}
        aria-label={`${operation.businessLabel}，${formatDuration(operation.durationMs)}`}
        onClick={onSelect}
      >
        <span className={styles.operationMain}>
          <span className={styles.operationTitle}>{operation.businessLabel}</span>
          {objectName ? <span className={styles.targetPill}>{objectName}</span> : null}
        </span>
        <span className={styles.operationCondition}>{operation.condition ?? operation.resultSummary}</span>
        <span className={styles.operationMeta}>
          <span>{formatClock(operation.startedAt)}</span>
          <span><ClockCircleOutlined /> {formatDuration(operation.durationMs)}</span>
          <span className={styles.successMeta}><CheckCircleFilled /> 完成</span>
        </span>
      </button>
    </div>
  );
}

export function TraceTimelineView({
  interactions,
  selectedOperationId,
  onSelectOperation,
  objectNames,
}: TraceTimelineViewProps) {
  return (
    <div className={styles.timeline}>
      {interactions.map((interaction, interactionIndex) => {
        const operationDuration = interaction.operations.reduce(
          (total, operation) => total + operation.durationMs,
          0,
        );

        return (
          <section className={styles.interaction} key={interaction.id}>
            <header className={styles.interactionHeader}>
              <div>
                <span className={styles.interactionEyebrow}>第 {interactionIndex + 1} 轮交互</span>
                <h2>{interaction.question}</h2>
              </div>
              <div className={styles.interactionStats}>
                <strong>{formatDuration(interaction.durationMs)}</strong>
                <span>{interaction.operations.length} 次调用 · 调用耗时 {formatDuration(operationDuration)}</span>
              </div>
            </header>

            <div className={styles.timelineRail}>
              <div className={styles.questionMarker}>
                <span className={styles.questionDot}>问</span>
                <span>{formatClock(interaction.startedAt)} · 交互开始</span>
              </div>
              {interaction.operations.map((operation, operationIndex) => (
                <TimelineOperation
                  key={operation.id}
                  operation={operation}
                  previousTimestamp={operationIndex === 0
                    ? interaction.startedAt
                    : interaction.operations[operationIndex - 1].completedAt}
                  selected={selectedOperationId === operation.id}
                  objectName={operation.targetObjectId
                    ? objectNames.get(operation.targetObjectId)
                    : undefined}
                  onSelect={() => onSelectOperation(operation)}
                />
              ))}
              <div className={styles.answerMarker}>
                <span className={styles.answerDot}>答</span>
                <div>
                  <strong>Agent 输出</strong>
                  <p>{interaction.answerSummary}</p>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
