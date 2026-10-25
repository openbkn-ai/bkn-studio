/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DownOutlined } from "@ant-design/icons";
import { AutoComplete, Button, Input, Typography } from "antd";
import type { InputRef } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { listRootServices } from "./trace-analysis.service";
import type { RootServiceOptionsQuery } from "./trace-analysis.types";

type Props = { value?: string; onChange?: (value: string) => void; query: RootServiceOptionsQuery };

export function RootServicePicker({ value, onChange, query }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>();
  const input = useRef<InputRef>(null);
  const request = useRef<AbortController | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = useCallback(() => {
    request.current?.abort();
    clearTimeout(timer.current);
  }, []);
  const close = useCallback(() => {
    stop();
    setExpanded(false);
    setEntries([]);
    setFeedback(undefined);
  }, [stop]);
  useEffect(() => {
    close();
    return stop;
  }, [query, close, stop]);
  const load = async (q: string) => {
    stop();
    const controller = new AbortController();
    request.current = controller;
    setEntries([]);
    setFeedback("loading");
    try {
      const result = await listRootServices({ ...query, q: q || undefined }, controller.signal);
      if (controller.signal.aborted) return;
      setEntries(result.entries);
      setFeedback(
        result.hasMore ? "more" : result.entries.length ? "scope" : q ? "noMatches" : "empty",
      );
    } catch {
      if (!controller.signal.aborted) setFeedback("failed");
    }
  };
  const popupOpen = expanded && entries.length > 0;
  return (
    <div>
      <AutoComplete
        value={value}
        filterOption={false}
        defaultActiveFirstOption={false}
        open={popupOpen}
        options={entries.map((entry) => ({ value: entry, label: entry }))}
        onChange={(nextValue) => onChange?.(nextValue)}
        onSearch={(search) => {
          if (!expanded) return;
          stop();
          setEntries([]);
          setFeedback("loading");
          timer.current = setTimeout(() => {
            void load(search);
          }, 250);
        }}
        onSelect={close}
        onBlur={close}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
          if (event.key === "Enter" && expanded && entries.length) event.preventDefault();
        }}
      >
        <Input
          ref={input}
          allowClear
          placeholder={t("bknTrace.traceWorkspace.filters.service")}
          suffix={
            <Button
              type="text"
              size="small"
              icon={<DownOutlined />}
              aria-label={t("bknTrace.traceWorkspace.serviceOptions.open")}
              aria-expanded={popupOpen}
              disabled={feedback === "loading"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (popupOpen) close();
                else {
                  input.current?.focus();
                  setExpanded(true);
                  void load(value ?? "");
                }
              }}
            />
          }
        />
      </AutoComplete>
      {feedback ? (
        <div role="status">
          <Typography.Text type={feedback === "failed" ? "warning" : "secondary"}>
            {t(`bknTrace.traceWorkspace.serviceOptions.${feedback}`)}
          </Typography.Text>
        </div>
      ) : null}
    </div>
  );
}
