/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Collapse, Form, Input, Modal, Select, Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  CodeEditor,
  type CodeEditorLanguage,
} from "@/modules/execution-factory/components/CodeEditor";
import {
  generateFunction,
  generateFunctionStream,
} from "@/modules/execution-factory/services/function.service";
import type { FunctionAiGenerateType } from "@/modules/execution-factory/types/function";
import {
  parseFunctionAiContent,
  type FunctionAiApplyResult,
} from "@/modules/execution-factory/utils/function-ai-content";

type FunctionAiGenerateModalProps = {
  initialCode?: string;
  onApply?: (result: FunctionAiApplyResult) => void;
  onClose: () => void;
  open: boolean;
};

type GenerateFormValues = {
  code?: string;
  query?: string;
  type: FunctionAiGenerateType;
};

type GenerateOutcome = {
  content: unknown;
  generateType: FunctionAiGenerateType;
};

export function FunctionAiGenerateModal({
  initialCode,
  onApply,
  onClose,
  open,
}: FunctionAiGenerateModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<GenerateFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GenerateOutcome | null>(null);
  const [streamContent, setStreamContent] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [reasoningOpen, setReasoningOpen] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const contentStartedRef = useRef(false);
  const reasoningBoxRef = useRef<HTMLDivElement | null>(null);
  /** Whether the view is still pinned to the bottom. Stop following after users scroll up to read earlier content. */
  const reasoningStickRef = useRef(true);
  const generateType = Form.useWatch("type", form) as FunctionAiGenerateType | undefined;

  const applyResult = useMemo(
    () => (outcome ? parseFunctionAiContent(outcome.generateType, outcome.content) : null),
    [outcome],
  );

  // Show streaming code while generating and the final result afterward; metadata is JSON and functions are Python.
  const resultLanguage: CodeEditorLanguage =
    outcome && outcome.generateType === "metadata_param_generator" ? "json" : "python";

  const resultText = useMemo(() => {
    if (submitting) {
      return streamContent;
    }
    if (!outcome) {
      return "";
    }
    if (typeof outcome.content !== "string") {
      return JSON.stringify(outcome.content, null, 2);
    }
    if (resultLanguage !== "json") {
      return outcome.content;
    }

    // Metadata results are sometimes JSON wrapped in a string and are easier to read after parsing.
    try {
      return JSON.stringify(JSON.parse(outcome.content), null, 2);
    } catch {
      return outcome.content;
    }
  }, [outcome, resultLanguage, streamContent, submitting]);

  // Reasoning content is appended as a stream; without following it, the container stays at the top and looks stuck.
  useEffect(() => {
    const node = reasoningBoxRef.current;
    if (!node || !reasoningStickRef.current) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [reasoning, reasoningOpen]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      form.resetFields();
      setError(null);
      setOutcome(null);
      setStreamContent("");
      setReasoning("");
      // The next opening has new reasoning content, so reset the follow state too.
      reasoningStickRef.current = true;
      return;
    }

    form.setFieldsValue({
      code: initialCode,
      type: "python_function_generator",
    });

  }, [form, initialCode, open]);

  const handleGenerate = async () => {
    setSubmitting(true);
    setError(null);
    setOutcome(null);
    setStreamContent("");
    setReasoning("");
    setReasoningOpen(true);
    contentStartedRef.current = false;
    // The same modal can generate another round. If the user scrolled up previously, stick remains
    // false and the next round never follows unless reset. setReasoning("") unmounts and rebuilds
    // the container, so onScroll does not fire and cannot recover it.
    reasoningStickRef.current = true;

    try {
      const values = await form.validateFields();
      const input = {
        code: values.code,
        query: values.query,
        type: values.type,
      };

      let generateResult;
      if (values.type === "python_function_generator") {
        const controller = new AbortController();
        abortRef.current = controller;
        generateResult = await generateFunctionStream(
          input,
          {
            onContentDelta: (delta) => {
              // Collapse reasoning once code starts to give code the space; users can still expand it manually.
              if (!contentStartedRef.current) {
                contentStartedRef.current = true;
                setReasoningOpen(false);
              }
              setStreamContent((prev) => prev + delta);
            },
            onReasoningDelta: (delta) => {
              setReasoning((prev) => prev + delta);
            },
          },
          controller.signal,
        );
      } else {
        generateResult = await generateFunction(input);
      }

      setOutcome({
        content: generateResult.content ?? generateResult,
        generateType: values.type,
      });
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        return;
      }
      setError(extractRequestErrorMessage(caughtError));
    } finally {
      abortRef.current = null;
      setSubmitting(false);
      setStreamContent("");
    }
  };

  const handleApply = () => {
    if (!applyResult) {
      return;
    }

    onApply?.(applyResult);
    onClose();
  };

  return (
    <Modal
      destroyOnClose
      footer={null}
      onCancel={onClose}
      open={open}
      title={t("executionFactory.functionAiGenerateTitle")}
      width={760}
    >
      <Form form={form} layout="vertical">
        <Form.Item label={t("executionFactory.functionAiGenerateType")} name="type">
          <Select
            options={(
              ["python_function_generator", "metadata_param_generator"] as FunctionAiGenerateType[]
            ).map((type) => ({
              label: t(`executionFactory.functionAiGenerateTypes.${type}`),
              value: type,
            }))}
          />
        </Form.Item>
        {generateType === "python_function_generator" ? (
          <Form.Item
            label={t("executionFactory.functionAiGenerateQuery")}
            name="query"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input.TextArea
              placeholder={t("executionFactory.functionAiGenerateQueryPlaceholder")}
              rows={4}
            />
          </Form.Item>
        ) : (
          <Form.Item
            label={t("executionFactory.functionCode")}
            name="code"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <CodeEditor height={220} language="python" />
          </Form.Item>
        )}
      </Form>
      {submitting && !streamContent ? (
        <div style={{ alignItems: "center", display: "flex", gap: 8, marginBottom: 12 }}>
          <Spin size="small" />
          <span style={{ color: "#64748b", fontSize: 13 }}>
            {t("executionFactory.functionAiGenerateThinking")}
          </span>
        </div>
      ) : null}
      {reasoning ? (
        <Collapse
          activeKey={reasoningOpen ? ["reasoning"] : []}
          items={[
            {
              children: (
                <div
                  onScroll={(event) => {
                    const node = event.currentTarget;
                    // Treat within 8px of the bottom as pinned. Streaming changes height continuously,
                    // so the tolerance prevents a small jump from looking like an intentional scroll upward.
                    reasoningStickRef.current =
                      node.scrollHeight - node.scrollTop - node.clientHeight <= 8;
                  }}
                  ref={reasoningBoxRef}
                  style={{
                    color: "#64748b",
                    fontSize: 12,
                    lineHeight: 1.7,
                    maxHeight: 180,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {reasoning}
                </div>
              ),
              key: "reasoning",
              label: t("executionFactory.functionAiGenerateReasoning"),
            },
          ]}
          onChange={(keys) => {
            setReasoningOpen(keys.length > 0);
          }}
          size="small"
          style={{ marginBottom: 12 }}
        />
      ) : null}
      {error ? <Alert message={error} showIcon style={{ marginBottom: 16 }} type="error" /> : null}
      {streamContent || outcome ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#475569", fontSize: 13, marginBottom: 6 }}>
            {submitting
              ? t("executionFactory.functionAiGenerateStreaming")
              : t("executionFactory.functionAiGenerateResultTitle")}
          </div>
          <CodeEditor
            followTail={submitting}
            height={300}
            language={resultLanguage}
            readOnly
            value={resultText}
          />
        </div>
      ) : null}
      {outcome && !applyResult ? (
        <Alert
          message={t("executionFactory.functionAiGenerateUnusable")}
          showIcon
          style={{ marginBottom: 16 }}
          type="warning"
        />
      ) : null}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
        <AppButton
          loading={submitting}
          onClick={() => {
            void handleGenerate();
          }}
          type="primary"
        >
          {t("executionFactory.functionAiGenerate")}
        </AppButton>
        {applyResult ? (
          <AppButton onClick={handleApply} type="primary">
            {t("executionFactory.functionAiGenerateApply")}
          </AppButton>
        ) : null}
      </div>
    </Modal>
  );
}
