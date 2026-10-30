/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Input } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { askAboutObjectType } from "@/modules/bkn-project/services/draft.service";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import type { AskAnswer, AskSuggestion, DraftObjectType } from "@/modules/bkn-project/types/draft";

import styles from "./DraftTables.module.css";

const PREFIX = "bknProject.model.ask";

/** Ask AI takes at most this many characters, as bkn-project does. */
export const ASK_MAX_LENGTH = 500;

const ERRORS = new Set([
  "InvalidQuestion",
  "NotReady",
  "ItemNotFound",
  "AskUnavailable",
  "AskTimeout",
]);
const FIELDS = new Set(["name", "description", "identity"]);

/**
 * Ask AI about one object type of the draft: a question, its answer and at most one suggested
 * change, which the person adopts through the usual edit. Nothing is kept: each question stands
 * alone and closing the object type forgets it.
 */
export function AskAiPanel({
  canAdopt,
  objectType,
  onAdopt,
  projectId,
}: {
  canAdopt: boolean;
  objectType: DraftObjectType;
  /** Makes the change; true once the draft has it. */
  onAdopt: (suggestion: AskSuggestion) => Promise<boolean>;
  projectId: string;
}) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState<AskAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adopting, setAdopting] = useState(false);
  const [adopted, setAdopted] = useState(false);

  const ask = async () => {
    setAsking(true);
    setError(null);
    setReply(null);
    setAdopted(false);
    try {
      setReply(await askAboutObjectType(projectId, objectType.id, question.trim()));
    } catch (cause) {
      const code = projectErrorCode(cause) ?? "";
      const name = code.slice(code.lastIndexOf(".") + 1);
      setError(t(`${PREFIX}.error.${ERRORS.has(name) ? name : "other"}`));
    } finally {
      setAsking(false);
    }
  };

  const adopt = async (suggestion: AskSuggestion) => {
    setAdopting(true);
    try {
      setAdopted(await onAdopt(suggestion));
    } finally {
      setAdopting(false);
    }
  };

  const suggestion =
    reply?.suggestion && FIELDS.has(reply.suggestion.field) ? reply.suggestion : null;
  return (
    <section className={styles.stack}>
      <h3 className={styles.sectionTitle}>{t(`${PREFIX}.title`)}</h3>
      <Input.TextArea
        aria-label={t(`${PREFIX}.question`)}
        autoSize={{ maxRows: 4, minRows: 2 }}
        maxLength={ASK_MAX_LENGTH}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder={t(`${PREFIX}.placeholder`)}
        showCount
        value={question}
      />
      <div>
        <AppButton
          disabled={!question.trim()}
          loading={asking}
          onClick={() => void ask()}
          type="primary"
        >
          {t(`${PREFIX}.${asking ? "asking" : "submit"}`)}
        </AppButton>
      </div>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      {reply ? (
        <div className={styles.stack}>
          <p className={styles.answer}>{reply.answer}</p>
          {suggestion ? (
            <Alert
              action={
                canAdopt ? (
                  <AppButton
                    disabled={adopted}
                    loading={adopting}
                    onClick={() => void adopt(suggestion)}
                    size="small"
                    type="primary"
                  >
                    {t(`${PREFIX}.${adopted ? "adopted" : "adopt"}`)}
                  </AppButton>
                ) : null
              }
              description={suggestion.reason || undefined}
              message={
                suggestion.field === "identity"
                  ? t(`${PREFIX}.suggest.identity`, {
                      properties: suggestion.properties.join(" + "),
                    })
                  : t(`${PREFIX}.suggest.${suggestion.field}`, { value: suggestion.value })
              }
              showIcon
              type="info"
            />
          ) : null}
          <p className={styles.muted}>{t(`${PREFIX}.notKept`)}</p>
        </div>
      ) : null}
    </section>
  );
}
