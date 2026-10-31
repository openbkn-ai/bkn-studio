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

import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import type { ObjectMetricAnswerModel } from "@/modules/knowledge-network/services/object-metric-models.service";

import styles from "./AiPromptComposer.module.css";

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
    options: ObjectMetricAnswerModel[];
    unavailable: boolean;
  };
  onStop: () => void;
  onSubmit: (prompt: string) => void;
  placeholder: string;
  /** Sets the input, as an example clicked does. */
  promptRequest?: { revision: number; value: string };
  sendLabel: string;
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
            <Tooltip
              title={model.unavailable ? objectMetricText("aiModelListUnavailable") : undefined}
            >
              <Select
                aria-label={objectMetricText("aiAnswerModel")}
                className={styles.aiModelSelect}
                disabled={generating || checking || model.locked}
                id="metric-ai-model"
                loading={model.loading}
                onChange={(value: string) => model.onChange(value || undefined)}
                options={[
                  {
                    label: (
                      <span className={styles.aiModelOption}>
                        <CodeSandboxOutlined aria-hidden="true" />
                        <span>{objectMetricText("aiPlatformDefaultModel")}</span>
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
            aria-label={generating ? objectMetricText("mca4d973c0b00") : sendLabel}
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
