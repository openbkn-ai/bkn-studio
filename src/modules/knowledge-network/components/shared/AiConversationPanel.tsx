/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { RobotOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";

import styles from "./AiConversationPanel.module.css";

export type AiConversationMessage = {
  id: string;
  role: "assistant" | "user";
  content: ReactNode;
  tone?: "error";
};

type AiConversationPanelProps = {
  ariaLabel: string;
  title: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  notice?: ReactNode;
  description?: ReactNode;
  descriptionVisibility?: "always" | "empty";
  welcomeMessage?: ReactNode;
  messages: AiConversationMessage[];
  generating: boolean;
  generatingText: ReactNode;
  examplesLabel?: ReactNode;
  examples?: string[];
  onExample?: (example: string) => void;
  composer: ReactNode;
  children?: ReactNode;
  className?: string;
  contentTestId?: string;
  as?: "aside" | "section" | "div";
};

/**
 * Shared visual framework for AI-assisted creation flows. Domain-specific proposals are rendered
 * through children while the conversation, examples and composer stay consistent everywhere.
 */
export function AiConversationPanel({
  ariaLabel,
  title,
  subtitle,
  headerActions,
  notice,
  description,
  descriptionVisibility = "empty",
  welcomeMessage,
  messages,
  generating,
  generatingText,
  examplesLabel,
  examples = [],
  onExample,
  composer,
  children,
  className,
  contentTestId,
  as: Root = "section",
}: AiConversationPanelProps) {
  const empty = messages.length === 0 && !generating;
  const showConversation = welcomeMessage !== undefined || !empty;
  const rootClassName = className ? `${styles.frame} ${className}` : styles.frame;

  return (
    <Root aria-label={ariaLabel} className={rootClassName}>
      <header className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon} aria-hidden="true">
            <RobotOutlined />
          </span>
          <div>
            <strong>{title}</strong>
            {subtitle !== undefined ? <span>{subtitle}</span> : null}
          </div>
        </div>
        {headerActions ? <div className={styles.headerActions}>{headerActions}</div> : null}
      </header>

      <div
        className={`${styles.content} ${empty ? styles.contentEmpty : ""}`}
        data-testid={contentTestId}
      >
        {notice}

        {description && (descriptionVisibility === "always" || empty) ? (
          <p className={styles.description}>{description}</p>
        ) : null}

        {showConversation ? (
          <div className={styles.conversation} aria-live="polite">
            {welcomeMessage !== undefined ? (
              <div className={`${styles.message} ${styles.assistantMessage}`}>{welcomeMessage}</div>
            ) : null}
            {messages.map((item) => (
              <div
                className={`${styles.message} ${
                  item.role === "user" ? styles.userMessage : styles.assistantMessage
                } ${item.tone === "error" ? styles.errorMessage : ""}`}
                key={item.id}
              >
                {item.content}
              </div>
            ))}
            {generating ? (
              <div className={`${styles.message} ${styles.assistantMessage}`}>
                <span className={styles.thinking} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {generatingText}
              </div>
            ) : null}
          </div>
        ) : null}

        {children}

        {empty && examples.length ? (
          <div className={styles.examples}>
            {examplesLabel !== undefined ? <span>{examplesLabel}</span> : null}
            {examples.map((example) => (
              <button key={example} onClick={() => onExample?.(example)} type="button">
                {example}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.composer}>{composer}</div>
    </Root>
  );
}
