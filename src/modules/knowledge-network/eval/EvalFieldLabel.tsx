/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tooltip, theme } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useEvalTranslation } from "./useEvalTranslation";
import type { ReactNode } from "react";
import styles from "./EvalCaseEditorDrawer.module.css";

export function EvalFieldLabel({
  children,
  required = false,
  hint,
}: {
  children: ReactNode;
  required?: boolean;
  hint?: ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <div className={styles.fieldLabel}>
      <span>
        {required && (
          <span
            aria-hidden="true"
            style={{
              color: token.colorError,
              marginInlineEnd: 4,
              fontSize: token.fontSize,
              fontFamily: "SimSun, sans-serif",
              lineHeight: 1,
            }}
          >
            *
          </span>
        )}
        {children}
      </span>
      {hint && (
        <EvalHelpTooltip title={hint} label={typeof children === "string" ? children : undefined} />
      )}
    </div>
  );
}

/** Field and section help stays accessible even inside a read-only form. */
export function EvalHelpTooltip({
  title,
  label,
  children,
}: {
  title: ReactNode;
  label?: string;
  children?: ReactNode;
}) {
  const { t } = useEvalTranslation();
  if (title == null || title === false || title === "") return children;
  return (
    <>
      {children}
      <Tooltip title={title} trigger={["hover", "focus", "click"]}>
        <span
          role="button"
          tabIndex={0}
          className={styles.fieldHelp}
          aria-label={`${label ?? t("knowledgeNetwork.eval.helpLabel")} ?`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.currentTarget.click();
            }
          }}
        >
          <QuestionCircleOutlined aria-hidden="true" />
        </span>
      </Tooltip>
    </>
  );
}
