/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Input } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";

const PREFIX = "bknProject.model.candidates.review";
const REASON_MAX_LENGTH = 200;

/** Going through the candidates in a panel: confirming the one open, then the next. */
export type CandidateReview = {
  name: string;
  /** Adopts the candidate open over the draft made at `updateTime`, then opens the next. */
  onAdopt: (updateTime: number) => Promise<void>;
  /** Leaves it out, with why when someone said, then opens the next. */
  onExclude: (updateTime: number, reason: string) => Promise<void>;
  onNext: () => void;
};

/**
 * A panel's buttons for confirming candidates in turn. `prepare` saves what was changed in the
 * panel first and replies the update time of the draft to decide on, or null when it could not.
 */
export function ReviewActions({
  prepare,
  review,
}: {
  prepare: () => Promise<number | null>;
  review: CandidateReview;
}) {
  const { t } = useTranslation();
  const { modal } = useAppServices();
  const [busy, setBusy] = useState(false);

  const run = async (decide: (updateTime: number) => Promise<void>) => {
    setBusy(true);
    try {
      const updateTime = await prepare();
      if (updateTime !== null) {
        await decide(updateTime);
      }
    } finally {
      setBusy(false);
    }
  };

  const exclude = () => {
    let reason = "";
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: (
        <Input.TextArea
          aria-label={t(`${PREFIX}.reason`)}
          autoSize={{ maxRows: 4, minRows: 2 }}
          maxLength={REASON_MAX_LENGTH}
          onChange={(event) => (reason = event.target.value)}
          placeholder={t(`${PREFIX}.reasonPlaceholder`)}
          showCount
        />
      ),
      icon: null,
      okText: t(`${PREFIX}.confirm`),
      onOk: () => run((updateTime) => review.onExclude(updateTime, reason.trim())),
      title: t(`${PREFIX}.excludeTitle`, { name: review.name }),
    });
  };

  return (
    <>
      <AppButton disabled={busy} onClick={() => void run(review.onAdopt)}>
        {t(`${PREFIX}.adoptNext`)}
      </AppButton>
      <AppButton disabled={busy} onClick={exclude}>
        {t(`${PREFIX}.excludeNext`)}
      </AppButton>
      <AppButton disabled={busy} onClick={review.onNext} type="text">
        {t(`${PREFIX}.next`)}
      </AppButton>
    </>
  );
}
