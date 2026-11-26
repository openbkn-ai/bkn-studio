/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Space, Table, Typography } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import type { KnEventRuleTrialResult } from "@/modules/knowledge-network/types/event-type";

import styles from "./EventClassFormDrawer.module.css";

export type EventRuleTrialState = {
  /** Why the rule could not be tried. */
  error?: string;
  result?: KnEventRuleTrialResult;
  running: boolean;
  /** The rule changed after the shown result was found. */
  stale: boolean;
};

type EventRuleTrialProps = {
  onTry: () => void;
  state: EventRuleTrialState;
};

const PREFIX = "knowledgeNetwork.eventClasses.form";

/** Tries the rule as it stands in the form, and shows which objects it would find now. */
export function EventRuleTrial({ onTry, state }: EventRuleTrialProps) {
  const { t } = useTranslation();
  const { error, result, running, stale } = state;

  return (
    <Space direction="vertical" size={8} className={styles.block}>
      <Space wrap>
        <AppButton loading={running} onClick={onTry}>
          {t(`${PREFIX}.trial`)}
        </AppButton>
        <Typography.Text className={styles.parameterHint} type="secondary">
          {t(`${PREFIX}.trialHint`)}
        </Typography.Text>
      </Space>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      {result ? (
        <div className={stale ? styles.trialStale : undefined} data-testid="event-rule-trial">
          <Space direction="vertical" size={8} className={styles.block}>
            {stale ? <Alert message={t(`${PREFIX}.trialStale`)} showIcon type="warning" /> : null}
            <Typography.Text strong>
              {t(`${PREFIX}.trialResult`, { count: result.hit_count })}
            </Typography.Text>
            {result.limited ? (
              <Alert message={t(`${PREFIX}.trialLimited`)} showIcon type="warning" />
            ) : null}
            {result.row_filter_applied ? (
              <Alert message={t(`${PREFIX}.trialRowFilter`)} showIcon type="warning" />
            ) : null}
            {result.hits.length > 0 ? (
              <>
                {result.hit_count > result.hits.length ? (
                  <Typography.Text type="secondary">
                    {t(`${PREFIX}.trialShown`, { count: result.hits.length })}
                  </Typography.Text>
                ) : null}
                <Table
                  columns={[
                    { dataIndex: "key", key: "key", title: t(`${PREFIX}.trialKey`) },
                    { dataIndex: "name", key: "name", title: t(`${PREFIX}.trialName`) },
                  ]}
                  dataSource={result.hits}
                  pagination={false}
                  rowKey="key"
                  scroll={{ y: 240 }}
                  size="small"
                />
              </>
            ) : null}
          </Space>
        </div>
      ) : null}
    </Space>
  );
}
