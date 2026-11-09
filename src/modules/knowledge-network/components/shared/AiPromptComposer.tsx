/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ArrowUpOutlined,
  CodeSandboxOutlined,
  DownOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { Button, Input, Select, Tooltip } from "antd";
import { useEffect, useState } from "react";

import styles from "./AiPromptComposer.module.css";

export interface AiPromptModelOption {
  id: string;
  name: string;
}

/**
 * The input of an AI conversation pane: the prompt, the answer model, and send or stop. Shared by
 * the object metric designer and the ontology editors so both converse the same way.
 */
export function AiPromptComposer({
  checking,
  generating,
  inputLabel,
  model,
  onStop,
  onSubmit,
  placeholder,
  promptRequest,
  sendLabel,
  stopLabel,
}: {
  checking: boolean;
  generating: boolean;
  /** Names the input for assistive technology. */
  inputLabel: string;
  /** The answer model to choose; absent where the platform's default answers. */
  model?: {
    id?: string;
    loading: boolean;
    locked: boolean;
    onChange: (modelId?: string) => void;
    options: AiPromptModelOption[];
    unavailable: boolean;
    /** Accessible name of the model selector. */
    ariaLabel: string;
    /** Label of the empty value that delegates model choice to the platform. */
    defaultLabel: string;
    /** Tooltip shown while the model list is unavailable. */
    unavailableLabel: string;
  };
  onStop: () => void;
  onSubmit: (prompt: string) => void;
  placeholder: string;
  /** Sets the input, as an example clicked does. */
  promptRequest?: { revision: number; value: string };
  sendLabel: string;
  stopLabel: string;
}) {
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (promptRequest) setPrompt(promptRequest.value);
  }, [promptRequest]);

  const submit = () => {
    const value = prompt.trim();
    if (!value || generating || checking) return;
    setPrompt("");
    onSubmit(value);
  };

  return (
    <div className={styles.aiComposerShell}>
      <Input.TextArea
        aria-label={inputLabel}
        autoFocus
        autoSize={{ minRows: 2, maxRows: 5 }}
        disabled={generating || checking}
        maxLength={1200}
        onChange={(event) => setPrompt(event.target.value)}
        onPressEnter={(event) => {
          if (!event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        value={prompt}
        variant="borderless"
      />
      <div className={styles.aiComposerFooter}>
        <div className={styles.aiComposerActions}>
          {model ? (
            <Tooltip title={model.unavailable ? model.unavailableLabel : undefined}>
              <Select
                aria-label={model.ariaLabel}
                className={styles.aiModelSelect}
                disabled={generating || checking || model.locked}
                loading={model.loading}
                onChange={(value: string) => model.onChange(value || undefined)}
                options={[
                  {
                    label: (
                      <span className={styles.aiModelOption}>
                        <CodeSandboxOutlined aria-hidden="true" />
                        <span>{model.defaultLabel}</span>
                      </span>
                    ),
                    value: "",
                  },
                  ...model.options.map((option) => ({
                    label: (
                      <span className={styles.aiModelOption}>
                        <CodeSandboxOutlined aria-hidden="true" />
                        <span>{option.name}</span>
                      </span>
                    ),
                    value: option.id,
                  })),
                ]}
                popupMatchSelectWidth={false}
                suffixIcon={<DownOutlined aria-hidden="true" />}
                value={model.id ?? ""}
              />
            </Tooltip>
          ) : null}
          <Button
            aria-label={generating ? stopLabel : sendLabel}
            className={styles.aiComposerSubmit}
            danger={generating}
            disabled={!generating && (checking || !prompt.trim())}
            icon={generating ? <StopOutlined /> : <ArrowUpOutlined />}
            onClick={generating ? onStop : submit}
            shape="circle"
            type={generating ? "default" : "primary"}
          />
        </div>
      </div>
    </div>
  );
}
