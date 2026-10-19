/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Try-now Agent chat container. ChatPane owns messages and the BKN Agent execution; this container
 * owns shared resources such as the model list, knowledge-network summary, suggestions, and the
 * input composer.
 */

import { ClearOutlined, ExclamationCircleOutlined, SettingOutlined } from "@ant-design/icons";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { normalizeSupportedLocale } from "@/framework/i18n/locale";
import { listLlmModels } from "@/modules/model-resources/services/llm.service";
import type { LlmModel } from "@/modules/model-resources/types/llm";
import {
  DEFAULT_AGENT_CONFIG,
  runAgentChat,
  type AgentTokenProvider,
} from "@/modules/knowledge-network/services/agent-chat.service";
import {
  fetchKnDetail,
  type ContextLoaderEnv,
  type KnDetail,
} from "@/modules/knowledge-network/services/context-loader.service";
import {
  createBknLifecycle,
  lifecycleEnv,
  memoryConversationStore,
  withManagedTurn,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import { recommendationFingerprint } from "@/modules/knowledge-network/utils/agent-chat-cache";

import { AgentConfigDrawer } from "./AgentConfigDrawer";
import { ChatPane, type ChatPaneHandle } from "./ChatPane";
import styles from "./AgentChat.module.css";

/**
 * Recommendations are phrased as business questions without ontology terms. These are the
 * fallback when network structure is unavailable.
 */
const FALLBACK_SUGGESTIONS = [
  "knowledgeNetwork.agentChat.fallbackSuggestions.overview",
  "knowledgeNetwork.agentChat.fallbackSuggestions.changes",
  "knowledgeNetwork.agentChat.fallbackSuggestions.priorityRecords",
];

function fallbackSuggestions(t: TFunction): string[] {
  return FALLBACK_SUGGESTIONS.map((key) => t(key));
}

/**
 * Fallback when no default model is available or generation fails: apply templates to business names
 * without ontology terminology. Most networks have empty concept groups, so prefer relation names
 * for the second question because relations are business verbs.
 */
function templateSuggestions(detail: KnDetail, t: TFunction): string[] {
  const out: string[] = [];
  const [first, second] = detail.object_types;
  if (first)
    out.push(
      t("knowledgeNetwork.agentChat.templateSuggestions.firstObject", {
        name: first.name ?? first.id,
      }),
    );
  const groupName = detail.concept_groups.find((g) => g.name)?.name;
  const relName = detail.relation_types.find((r) => r.name)?.name;
  if (groupName)
    out.push(t("knowledgeNetwork.agentChat.templateSuggestions.group", { name: groupName }));
  else if (relName)
    out.push(t("knowledgeNetwork.agentChat.templateSuggestions.relation", { name: relName }));
  if (second)
    out.push(
      t("knowledgeNetwork.agentChat.templateSuggestions.secondObject", {
        name: second.name ?? second.id,
      }),
    );
  else if (first)
    out.push(
      t("knowledgeNetwork.agentChat.templateSuggestions.firstObjectRecent", {
        name: first.name ?? first.id,
      }),
    );
  return out.length >= 2 ? out : fallbackSuggestions(t);
}

/**
 * Generation prompt for recommended questions. Input is raw get_kn_detail JSON containing network
 * and object-type comments, relation names, and other business descriptions. Recommendation quality
 * depends directly on those descriptions, giving business teams control over it.
 */
function suggestPrompt(t: TFunction, locale: string): string {
  const languageInstruction =
    locale === "zh-CN"
      ? "Current UI locale: zh-CN. Output all recommended questions in Simplified Chinese."
      : "Current UI locale: en-US. Output all recommended questions in English. Keep untranslated business names only when no English business label is available.";
  return `${t("knowledgeNetwork.agentChat.suggestPrompt")}\n${languageInstruction}`;
}

/** Extracts a JSON array from model output; unexpected input returns an empty array and callers fall back to templates. */
function parseSuggestions(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 60)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** Recommendation cache by knId. Regenerate when its fingerprint changes because structure or descriptions changed. */
const SUGS_LS_PREFIX = "bkn-studio:agentchat:sugs:";

function suggestionCacheKey(knId: string, locale: string): string {
  return `${SUGS_LS_PREFIX}${locale}:${knId}`;
}

function loadCachedSuggestions(knId: string, locale: string, fp: string): string[] | null {
  try {
    const raw = localStorage.getItem(suggestionCacheKey(knId, locale));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fp?: string; list?: unknown };
    if (parsed.fp !== fp || !Array.isArray(parsed.list)) return null;
    const list = parsed.list.filter((s): s is string => typeof s === "string");
    return list.length >= 2 ? list : null;
  } catch {
    return null;
  }
}

function saveCachedSuggestions(knId: string, locale: string, fp: string, list: string[]): void {
  try {
    localStorage.setItem(suggestionCacheKey(knId, locale), JSON.stringify({ fp, list }));
  } catch {
    /* Private mode or exhausted quota: skip caching without affecting functionality. */
  }
}

export function AgentChat({
  env,
  networkName,
  tokenProvider,
  modelTokenProvider,
}: {
  env: ContextLoaderEnv;
  networkName?: string;
  /** Authentication for BKN Agent executions: OAuth session or bak_ AppKey. */
  tokenProvider: AgentTokenProvider;
  /** Authentication for LLMs (mf-model-api): the gateway does not accept bak_, so always use OAuth and fall back to tokenProvider. */
  modelTokenProvider?: AgentTokenProvider;
}) {
  const knId = env.knId;
  const { t, i18n } = useTranslation();
  const activeLocale = normalizeSupportedLocale(i18n.resolvedLanguage ?? i18n.language) ?? "en-US";
  const defaultSuggestions = useMemo(() => fallbackSuggestions(t), [t]);
  const llmTokenProvider = useMemo(
    () => modelTokenProvider ?? tokenProvider,
    [modelTokenProvider, tokenProvider],
  );

  const [input, setInput] = useState("");
  const [models, setModels] = useState<LlmModel[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  // Automatically loaded knowledge-network scale shown in the empty state.
  const [knSummary, setKnSummary] = useState<{ objectTypes: number; relations: number } | null>(
    null,
  );
  // Render templates immediately and replace them with generated results when the model is ready.
  const [suggestions, setSuggestions] = useState<string[]>(defaultSuggestions);
  // Loaded network structure supplies business descriptions for suggestions.
  const [knDetail, setKnDetail] = useState<KnDetail | null>(null);

  // Busy state reported by the pane for send-disable and stop behavior.
  const [busy, setBusy] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  /** One-time managed session for platform prefetching, not either conversation. */
  const summaryLifecycle = useMemo(
    () =>
      createBknLifecycle(lifecycleEnv(env.base, knId), tokenProvider, {
        agentName: "bkn-agent-smart-qa-summary",
        conversationStore: memoryConversationStore(),
      }),
    [env.base, knId, tokenProvider],
  );

  const paneRef = useRef<ChatPaneHandle>(null);
  const pageScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSuggestions((prev) => (prev === defaultSuggestions ? prev : defaultSuggestions));
  }, [defaultSuggestions]);

  // Load the model-factory list once: no model means chat cannot run, and suggestions need one.
  useEffect(() => {
    let cancelled = false;
    listLlmModels({ page: 1, size: 100 })
      .then((res) => {
        if (!cancelled) setModels(res.items);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setModelsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the selected network ontology automatically for the empty state and tailored suggestions, without requiring prior browsing.
  useEffect(() => {
    let cancelled = false;
    setKnSummary(null);
    setKnDetail(null);
    setSuggestions(defaultSuggestions);
    // Summary prefetch is also a managed business call because get_kn_detail uses /kn/*. It belongs
    // to neither conversation, so use a one-time session rather than a panel conversation.
    withManagedTurn(
      summaryLifecycle,
      t("knowledgeNetwork.agentChat.managedTurns.loadSummary"),
      (turn) => fetchKnDetail(env, tokenProvider, undefined, turn ?? undefined),
    )
      .then((detail) => {
        if (cancelled) return;
        setKnSummary({
          objectTypes: detail.object_types.length,
          relations: detail.relation_types.length,
        });
        setKnDetail(detail);
        // Show template results first so the empty state is immediately actionable without waiting for a model.
        setSuggestions(templateSuggestions(detail, t));
      })
      .catch(() => {
        /* Fall back to default suggestions when a placeholder or unauthorized network cannot load structure; the Agent can still explore tools. */
      });
    return () => {
      cancelled = true;
    };
  }, [env, tokenProvider, summaryLifecycle, defaultSuggestions, t]);

  // With a default model, generate suggestions from BKN business descriptions and replace templates; retain templates with no model, failure, or unexpected output.
  useEffect(() => {
    if (!knDetail || !modelsLoaded) return;
    const modelName = models.find((m) => m.default)?.modelName ?? models[0]?.modelName;
    if (!modelName) return;
    const fp = recommendationFingerprint(knDetail);
    const cached = loadCachedSuggestions(knId, activeLocale, fp);
    if (cached) {
      setSuggestions(cached);
      return;
    }
    const controller = new AbortController();
    let text = "";
    runAgentChat({
      env,
      modelName,
      system: suggestPrompt(t, activeLocale),
      history: [{ role: "user", content: JSON.stringify(knDetail) }],
      tools: {},
      config: DEFAULT_AGENT_CONFIG,
      tokenProvider: llmTokenProvider,
      signal: controller.signal,
      onChunk: (chunk) => {
        if (chunk.type === "text") text += chunk.delta;
      },
    })
      .then(() => {
        if (controller.signal.aborted) return;
        const list = parseSuggestions(text);
        if (list.length < 2) return; // 输出不可用 → 保持模板
        setSuggestions(list);
        saveCachedSuggestions(knId, activeLocale, fp, list);
      })
      .catch(() => {
        /* Do not interrupt users on generation failure; keep template suggestions in the empty state. */
      });
    return () => {
      controller.abort();
    };
  }, [knDetail, modelsLoaded, models, env, llmTokenProvider, knId, activeLocale, t]);

  const sendInput = useCallback(() => {
    const text = input.trim();
    if (!text || busy) return;
    paneRef.current?.send(text);
    setInput("");
  }, [input, busy]);

  /** Suggested questions clicked in the empty state go through the same busy guard as the input. */
  const sendQuestion = useCallback(
    (text: string) => {
      if (!text.trim() || busy) return;
      paneRef.current?.send(text);
    },
    [busy],
  );

  const stop = useCallback(() => {
    paneRef.current?.stop();
  }, []);

  const placeholder = useMemo(() => {
    return t("knowledgeNetwork.agentChat.placeholders.askAgent", {
      suggestion: suggestions[0] ?? defaultSuggestions[0],
    });
  }, [suggestions, defaultSuggestions, t]);

  return (
    <div ref={pageScrollRef} className={styles.root}>
      <AgentConfigDrawer
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        env={env}
        tokenProvider={tokenProvider}
      />
      <header className={styles.agentHeader}>
        <span className={styles.headerNotice}>
          <ExclamationCircleOutlined /> {t("knowledgeNetwork.agentChat.composer.validationOnly")}
        </span>
        <div className={styles.headerActions}>
          <button type="button" className={styles.barBtn} onClick={() => setConfigOpen(true)}>
            <SettingOutlined /> {t("knowledgeNetwork.agentChat.composer.settings")}
          </button>
          <button
            type="button"
            className={styles.barBtn}
            onClick={() => paneRef.current?.clear()}
            disabled={busy}
          >
            <ClearOutlined /> {t("knowledgeNetwork.agentChat.composer.clear")}
          </button>
        </div>
      </header>

      <div className={styles.soloStage}>
        <div className={styles.soloPanel}>
          <ChatPane
            ref={paneRef}
            env={env}
            tokenProvider={tokenProvider}
            emptyTitle={t("knowledgeNetwork.agentChat.profiles.soloEmptyTitle")}
            networkName={networkName}
            knSummary={knSummary}
            pageScrollRef={pageScrollRef}
            suggestions={suggestions}
            onPick={sendQuestion}
            onBusyChange={setBusy}
          />
          <div className={styles.composer}>
            <div className={styles.cwrap}>
              <textarea
                className={styles.cInput}
                value={input}
                rows={1}
                placeholder={placeholder}
                spellCheck={false}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // Ignore Enter used to confirm a candidate during Chinese IME composition to avoid accidental sends.
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing &&
                    e.keyCode !== 229
                  ) {
                    e.preventDefault();
                    sendInput();
                  }
                }}
              />
              {busy ? (
                <button type="button" className={styles.stopBtn} onClick={stop}>
                  {t("knowledgeNetwork.agentChat.composer.stop")}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.sendBtn}
                  onClick={sendInput}
                  disabled={!input.trim()}
                >
                  {t("knowledgeNetwork.agentChat.composer.send")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
