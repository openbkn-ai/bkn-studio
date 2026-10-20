/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * OpenCypher query page, modeled on Neo4j Browser: the network's types on the left, an editor on
 * top (Cypher, or a question for the Cypher generation Agent), and a stream of result frames
 * below. Every new run adds a frame right under the editor; a frame's own "run again" refreshes
 * it where it is. Queries go to run_cypher exactly as written.
 */

import {
  ApiOutlined,
  BulbOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  CloseOutlined,
  ColumnHeightOutlined,
  DatabaseOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReadOutlined,
  RobotOutlined,
  SettingOutlined,
  TagOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  Popover,
  Segmented,
  Spin,
  Tag,
  Tooltip,
} from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import {
  CypherEditor,
  type CypherEditorHandle,
} from "@/modules/knowledge-network/components/cypher/CypherEditor";
import { CypherFrameCard } from "@/modules/knowledge-network/components/cypher/CypherFrameCard";
import { CypherReference } from "@/modules/knowledge-network/components/cypher/CypherReference";
import {
  CypherAgentError,
  explainCypher,
  explainMessage,
  generateCypher,
  type CypherAgentTexts,
} from "@/modules/knowledge-network/cypher/cypher-ai";
import type { CypherCompletionSchema } from "@/modules/knowledge-network/cypher/cypher-completion";
import {
  loadFrames,
  newFrameId,
  pushFrame,
  saveFrames,
  updateFrame,
  type CypherFrame,
} from "@/modules/knowledge-network/cypher/cypher-frames";
import {
  loadHistory,
  rememberQuery,
  saveHistory,
  stepHistory,
} from "@/modules/knowledge-network/cypher/cypher-history";
import {
  getObjectTypeDisplayKeys,
  getObjectTypeProperties,
  runCypherQuery,
  type ObjectTypeProperty,
} from "@/modules/knowledge-network/cypher/cypher-query.service";
import {
  cypherName,
  objectTypeSample,
  relationTypeSample,
} from "@/modules/knowledge-network/cypher/cypher-samples";
import { errorMarkFrom } from "@/modules/knowledge-network/cypher/error-mark";
import {
  captionKeys,
  loadGraphStyle,
  saveGraphStyle,
  type GraphStyle,
} from "@/modules/knowledge-network/cypher/graph-style";
import { GraphStyleContext } from "@/modules/knowledge-network/cypher/graph-style-context";
import {
  GRAPH_NODE_LIMIT,
  labeledNodeVariables,
  relationTypesInQuery,
  returnedNodeLabels,
  type CypherSchemaNames,
} from "@/modules/knowledge-network/cypher/graph-values";
import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import { cancelExecution } from "@/modules/knowledge-network/services/bkn-agent-execution.service";
import {
  fetchKnDetailRest,
  type ContextLoaderEnv,
  type KnDetail,
} from "@/modules/knowledge-network/services/context-loader.service";

import styles from "./CypherQueryScene.module.css";

type Mode = "cypher" | "ask";

const EDITOR_MAX_HEIGHT = 168;
const EDITOR_MAX_HEIGHT_EXPANDED = 360;
/** An enlarged editor starts this tall even for a one-line query. */
const EDITOR_MIN_HEIGHT_EXPANDED = 240;
const SCHEMA_COLLAPSED_KEY = "bkn-studio.cypher-schema-collapsed";
const AGENT_NOTICE_DISMISSED_KEY = "bkn-studio.cypher-agent-notice-dismissed";
/** get_object_types takes a bounded id list; larger networks are read in parts. */
const PROPERTY_BATCH = 50;

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* Private mode: the choice lasts for this visit. */
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function CypherQueryScene({
  networkId,
  knId,
}: {
  /** bkn-backend id of the network, for its object type definitions. */
  networkId: string;
  /** Context Loader kn_id. */
  knId: string;
}) {
  const { t } = useTranslation();
  const runtimeConfig = useRuntimeConfig();
  const [base] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));

  const tokenProvider = useMemo<AgentTokenProvider>(
    () => ({
      getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
      refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
    }),
    [runtimeConfig],
  );
  const env = useMemo<ContextLoaderEnv>(
    () => ({ base, token: tokenProvider.getToken(), knId }),
    [base, knId, tokenProvider],
  );

  /* ---------------- schema ---------------- */

  const [schema, setSchema] = useState<KnDetail | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Record<string, ObjectTypeProperty[]>>({});
  const [displayKeys, setDisplayKeys] = useState<Record<string, string>>({});
  const [graphStyle, setGraphStyleState] = useState<GraphStyle>(() => loadGraphStyle(knId));
  const graphStyleRef = useRef(graphStyle);
  const setGraphStyle = useCallback(
    (change: (style: GraphStyle) => GraphStyle) =>
      setGraphStyleState((current) => {
        const next = change(current);
        saveGraphStyle(knId, next);
        // A run started right after a change (a new caption) reads the new style.
        graphStyleRef.current = next;
        return next;
      }),
    [knId],
  );
  graphStyleRef.current = graphStyle;
  const propertiesRef = useRef(properties);
  propertiesRef.current = properties;
  // Display properties fetched so far ("" for none), so each object type is read once.
  const displayKeysRef = useRef<Record<string, string>>({});
  const [schemaCollapsed, setSchemaCollapsed] = useState(() => readFlag(SCHEMA_COLLAPSED_KEY));
  const [groupOpen, setGroupOpen] = useState({ objects: true, relations: true });
  const [openTypes, setOpenTypes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const controller = new AbortController();
    setSchemaLoading(true);
    setSchemaError(null);
    fetchKnDetailRest(
      { base, token: tokenProvider.getToken(), knId },
      tokenProvider,
      controller.signal,
    )
      .then(async (detail) => {
        setSchema(detail);
        setSchemaLoading(false);
        // Properties feed the schema panel and completion; the page works without them.
        const ids = detail.object_types.map((item) => item.id);
        for (let start = 0; start < ids.length; start += PROPERTY_BATCH) {
          const part = await getObjectTypeProperties({
            env: { base, token: tokenProvider.getToken(), knId },
            auth: tokenProvider,
            objectTypeIds: ids.slice(start, start + PROPERTY_BATCH),
            signal: controller.signal,
          }).catch(() => ({}));
          if (controller.signal.aborted) return;
          setProperties((current) => ({ ...current, ...part }));
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSchemaError(error instanceof Error ? error.message : String(error));
        setSchemaLoading(false);
      });
    return () => controller.abort();
  }, [base, knId, tokenProvider]);

  const names = useMemo<CypherSchemaNames>(
    () => ({
      objectTypes: Object.fromEntries(
        (schema?.object_types ?? []).map((item) => [item.id, item.name?.trim() || item.id]),
      ),
      relationTypes: Object.fromEntries(
        (schema?.relation_types ?? []).map((item) => [item.id, item.name?.trim() || item.id]),
      ),
      // A caption the user chose wins over the object type's display property.
      displayKeys: { ...displayKeys, ...captionKeys(graphStyle) },
    }),
    [displayKeys, graphStyle, schema],
  );

  const completionSchema = useMemo<CypherCompletionSchema>(
    () => ({
      objectTypes: (schema?.object_types ?? []).map((item) => ({
        id: item.id,
        name: item.name?.trim() || item.id,
      })),
      relationTypes: (schema?.relation_types ?? []).map((item) => ({
        id: item.id,
        name: item.name?.trim() || item.id,
        sourceId: item.sourceId,
        targetId: item.targetId,
      })),
      properties,
    }),
    [properties, schema],
  );

  /* ---------------- editor ---------------- */

  const editorRef = useRef<CypherEditorHandle>(null);
  const [mode, setMode] = useState<Mode>("cypher");
  const [cypherText, setCypherText] = useState("");
  const [askText, setAskText] = useState("");
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(() => loadHistory(knId));
  const historyPosition = useRef(-1);
  const draftRef = useRef("");
  const [followUp, setFollowUp] = useState<{ threadId: string; question: string } | null>(null);
  const [agentNotReady, setAgentNotReady] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(() =>
    readFlag(AGENT_NOTICE_DISMISSED_KEY),
  );

  useEffect(() => saveHistory(knId, history), [history, knId]);

  const remember = useCallback((query: string) => {
    historyPosition.current = -1;
    setHistory((current) => rememberQuery(current, query));
  }, []);

  const stepThroughHistory = (older: boolean) => {
    const next = stepHistory(historyPosition.current, history.length, older);
    if (historyPosition.current === -1) draftRef.current = cypherText;
    historyPosition.current = next;
    setCypherText(next === -1 ? draftRef.current : history[next]);
  };

  /* ---------------- frames ---------------- */

  const [frames, setFrames] = useState<CypherFrame[]>(() => loadFrames(knId));
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const runIds = useRef(new Map<string, string>());

  useEffect(() => saveFrames(knId, frames), [frames, knId]);

  useEffect(() => {
    const running = controllers.current;
    return () => running.forEach((controller) => controller.abort());
  }, []);

  useEffect(() => {
    if (!highlighted) return;
    const timer = window.setTimeout(() => setHighlighted(null), 1600);
    return () => window.clearTimeout(timer);
  }, [highlighted]);

  /** A new frame goes right under the editor; bring it into view. */
  const addFrame = useCallback((frame: CypherFrame) => {
    setFrames((current) => pushFrame(current, frame));
    setHighlighted(frame.id);
    streamRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
  }, []);

  const agentTexts = useMemo<CypherAgentTexts>(
    () => ({
      notReady: t("knowledgeNetwork.cypherQuery.agent.notReady"),
      forbidden: t("knowledgeNetwork.cypherQuery.agent.forbidden"),
      busy: t("knowledgeNetwork.cypherQuery.agent.busy"),
      timeout: t("knowledgeNetwork.cypherQuery.agent.timeout"),
      failed: t("knowledgeNetwork.cypherQuery.agent.failed"),
      network: t("knowledgeNetwork.cypherQuery.agent.network"),
    }),
    [t],
  );

  /** Asks returned nodes for their display property, when the query names their label. */
  const objectPropertiesFor = useCallback(
    async (query: string): Promise<Record<string, string[]>> => {
      const labels = returnedNodeLabels(query);
      const types = schema?.object_types ?? [];
      // Labels are object type ids; a name is accepted too. Unknown labels are left alone.
      const otIdOf = (label: string) =>
        types.find((item) => item.id === label)?.id ??
        types.find((item) => item.name?.trim() === label)?.id;
      const wanted = Object.entries(labels).flatMap(([variable, label]) => {
        const otId = otIdOf(label);
        return otId ? [[variable, otId] as const] : [];
      });
      const missing = [...new Set(wanted.map(([, otId]) => otId))].filter(
        (otId) => !(otId in displayKeysRef.current),
      );
      if (missing.length > 0) {
        const fetched = await getObjectTypeDisplayKeys(networkId, missing).catch(() =>
          Object.fromEntries(missing.map((otId) => [otId, ""])),
        );
        displayKeysRef.current = { ...displayKeysRef.current, ...fetched };
        setDisplayKeys(displayKeysRef.current);
      }
      const result: Record<string, string[]> = {};
      const captions = captionKeys(graphStyleRef.current);
      for (const [variable, otId] of wanted) {
        // A caption that is no property of the type is a computed column; the query returns it.
        const known = propertiesRef.current[otId];
        const caption =
          captions[otId] && (!known || known.some((property) => property.name === captions[otId]))
            ? captions[otId]
            : undefined;
        const keys = [displayKeysRef.current[otId], caption].filter((key): key is string =>
          Boolean(key),
        );
        if (keys.length > 0) result[variable] = [...new Set(keys)];
      }
      return result;
    },
    [networkId, schema],
  );

  const controllerFor = useCallback((frameId: string) => {
    controllers.current.get(frameId)?.abort();
    const controller = new AbortController();
    controllers.current.set(frameId, controller);
    return controller;
  }, []);

  /** Runs `query` in the existing frame `frameId`. */
  const runInFrame = useCallback(
    async (frameId: string, query: string) => {
      const controller = controllerFor(frameId);
      remember(query);
      setFrames((current) =>
        updateFrame(current, frameId, (frame) => ({
          ...frame,
          query,
          status: "running",
          result: undefined,
          error: undefined,
          generationError: undefined,
          resultDropped: undefined,
        })),
      );
      try {
        const run = await runCypherQuery({
          env,
          auth: tokenProvider,
          query,
          objectProperties: await objectPropertiesFor(query),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setFrames((current) =>
          updateFrame(current, frameId, (frame) =>
            run.ok
              ? { ...frame, status: "done", result: run.result, exchange: run.exchange }
              : { ...frame, status: "error", error: run.error, exchange: run.exchange },
          ),
        );
      } catch (error) {
        if (isAbort(error) || controller.signal.aborted) return;
        setFrames((current) =>
          updateFrame(current, frameId, (frame) => ({
            ...frame,
            status: "error",
            error: { message: error instanceof Error ? error.message : String(error) },
          })),
        );
      } finally {
        if (controllers.current.get(frameId) === controller) controllers.current.delete(frameId);
      }
    },
    [controllerFor, env, objectPropertiesFor, remember, tokenProvider],
  );

  const runNew = useCallback(
    (query: string) => {
      const id = newFrameId();
      addFrame({ id, createdAt: Date.now(), query, status: "running" });
      void runInFrame(id, query);
    },
    [addFrame, runInFrame],
  );

  /** Asks the Agent for a query, puts it in the editor and runs it in the same frame. */
  const generateAndRun = useCallback(
    async (question: string, message: string, threadId?: string) => {
      const frameId = newFrameId();
      const controller = controllerFor(frameId);
      addFrame({
        id: frameId,
        createdAt: Date.now(),
        query: "",
        status: "generating",
        ai: { question, tools: [], ...(threadId ? { threadId } : {}) },
      });
      try {
        const generated = await generateCypher(
          {
            base,
            tokenProvider,
            knId,
            message,
            threadId,
            signal: controller.signal,
            onRun: (runId) => runIds.current.set(frameId, runId),
            onTool: (name) =>
              setFrames((current) =>
                updateFrame(current, frameId, (frame) =>
                  frame.ai
                    ? { ...frame, ai: { ...frame.ai, tools: [...(frame.ai.tools ?? []), name] } }
                    : frame,
                ),
              ),
          },
          agentTexts,
        );
        runIds.current.delete(frameId);
        setAgentNotReady(false);
        setFrames((current) =>
          updateFrame(current, frameId, (frame) => ({
            ...frame,
            ai: { question, answer: generated.answer, threadId: generated.threadId },
          })),
        );
        if (!generated.query) {
          setFrames((current) =>
            updateFrame(current, frameId, (frame) => ({
              ...frame,
              status: "error",
              generationError: t("knowledgeNetwork.cypherQuery.frames.noQuery"),
            })),
          );
          return;
        }
        setCypherText(generated.query);
        setMode("cypher");
        await runInFrame(frameId, generated.query);
      } catch (error) {
        runIds.current.delete(frameId);
        if (isAbort(error) || controller.signal.aborted) return;
        if (error instanceof CypherAgentError && error.notReady) {
          // Not a result: say it once above the editor and keep the question for later.
          setFrames((current) => current.filter((frame) => frame.id !== frameId));
          setAgentNotReady(true);
          setMode("ask");
          setAskText(question);
          return;
        }
        setFrames((current) =>
          updateFrame(current, frameId, (frame) => ({
            ...frame,
            status: "error",
            ai: frame.ai ? { ...frame.ai, tools: undefined } : frame.ai,
            generationError: error instanceof Error ? error.message : String(error),
          })),
        );
      } finally {
        if (controllers.current.get(frameId) === controller) controllers.current.delete(frameId);
      }
    },
    [addFrame, agentTexts, base, controllerFor, knId, runInFrame, t, tokenProvider],
  );

  const submit = () => {
    if (mode === "cypher") {
      const query = cypherText.trim();
      if (query) runNew(query);
      return;
    }
    const question = askText.trim();
    if (!question) return;
    setAskText("");
    const thread = followUp;
    setFollowUp(null);
    void generateAndRun(question, question, thread?.threadId);
  };

  const stopFrame = (frame: CypherFrame) => {
    controllers.current.get(frame.id)?.abort();
    controllers.current.delete(frame.id);
    const runId = runIds.current.get(frame.id);
    runIds.current.delete(frame.id);
    if (runId) void cancelExecution({ base, tokenProvider, runId }).catch(() => undefined);
    setFrames((current) =>
      updateFrame(current, frame.id, (item) => ({
        ...item,
        status: "error",
        ai: item.ai ? { ...item.ai, tools: undefined } : item.ai,
        generationError: t("knowledgeNetwork.cypherQuery.frames.stopped"),
      })),
    );
  };

  const fixFrame = (frame: CypherFrame) => {
    if (!frame.ai?.threadId || !frame.error) return;
    const error = [frame.error.code, frame.error.message, frame.error.solution]
      .filter(Boolean)
      .join(" | ");
    void generateAndRun(
      `${t("knowledgeNetwork.cypherQuery.frames.fixWithAi")}：${frame.ai.question}`,
      t("knowledgeNetwork.cypherQuery.frames.fixMessage", { query: frame.query, error }),
      frame.ai.threadId,
    );
  };

  /**
   * The part of the network a query names, as plain lines for the Agent: each label's business
   * name and properties, each relation type's name and ends. Unknown names are left out.
   */
  const schemaContextFor = useCallback(
    (query: string): string => {
      const lines: string[] = [];
      const labels = new Set(Object.values(labeledNodeVariables(query)));
      for (const type of schema?.object_types ?? []) {
        if (!labels.has(type.id) && !labels.has(type.name?.trim() ?? "")) continue;
        const props = (properties[type.id] ?? [])
          .slice(0, 40)
          .map((property) =>
            property.displayName ? `${property.name}（${property.displayName}）` : property.name,
          );
        lines.push(
          `- ${type.id}：${type.name?.trim() || type.id}${props.length ? `；${props.join("，")}` : ""}`,
        );
      }
      const relations = new Set(relationTypesInQuery(query));
      for (const relation of schema?.relation_types ?? []) {
        if (!relations.has(relation.id)) continue;
        lines.push(
          `- ${relation.id}：${relation.name?.trim() || relation.id}（${relation.sourceId} → ${relation.targetId}）`,
        );
      }
      return lines.join("\n");
    },
    [properties, schema],
  );

  /**
   * Asks the Agent to explain the frame's query in business terms, with the error when the run
   * failed. A frame the Agent wrote continues its thread, so it explains its own query.
   */
  const explainFrame = useCallback(
    async (frame: CypherFrame) => {
      const key = `${frame.id}:explain`;
      const controller = controllerFor(key);
      const setExplanation = (explanation: CypherFrame["explanation"]) =>
        setFrames((current) =>
          updateFrame(current, frame.id, (item) => ({ ...item, explanation })),
        );
      setExplanation({ status: "running", tools: [] });
      const error = frame.error
        ? [frame.error.code, frame.error.message, frame.error.solution].filter(Boolean).join(" | ")
        : undefined;
      try {
        const explained = await explainCypher(
          {
            base,
            tokenProvider,
            knId,
            message: explainMessage(
              frame.query,
              {
                request: t("knowledgeNetwork.cypherQuery.frames.explainRequest"),
                error: t("knowledgeNetwork.cypherQuery.frames.explainError"),
                schema: t("knowledgeNetwork.cypherQuery.frames.explainSchema"),
              },
              error,
              schemaContextFor(frame.query),
            ),
            threadId: frame.ai?.threadId,
            signal: controller.signal,
            onRun: (runId) => runIds.current.set(key, runId),
            onTool: (name) =>
              setFrames((current) =>
                updateFrame(current, frame.id, (item) =>
                  item.explanation?.status === "running"
                    ? {
                        ...item,
                        explanation: {
                          ...item.explanation,
                          tools: [...(item.explanation.tools ?? []), name],
                        },
                      }
                    : item,
                ),
              ),
          },
          agentTexts,
        );
        setAgentNotReady(false);
        setExplanation({ status: "done", text: explained.answer });
      } catch (caught) {
        if (isAbort(caught) || controller.signal.aborted) return;
        if (caught instanceof CypherAgentError && caught.notReady) {
          // Same as generating: say it once above the editor, not in the frame.
          setExplanation(undefined);
          setAgentNotReady(true);
          return;
        }
        setExplanation({
          status: "error",
          text: caught instanceof Error ? caught.message : String(caught),
        });
      } finally {
        runIds.current.delete(key);
        if (controllers.current.get(key) === controller) controllers.current.delete(key);
      }
    },
    [agentTexts, base, controllerFor, knId, schemaContextFor, t, tokenProvider],
  );

  const stopExplaining = (frame: CypherFrame) => {
    const key = `${frame.id}:explain`;
    controllers.current.get(key)?.abort();
    controllers.current.delete(key);
    const runId = runIds.current.get(key);
    runIds.current.delete(key);
    if (runId) void cancelExecution({ base, tokenProvider, runId }).catch(() => undefined);
    setFrames((current) =>
      updateFrame(current, frame.id, (item) => ({
        ...item,
        explanation: { status: "error", text: t("knowledgeNetwork.cypherQuery.frames.stopped") },
      })),
    );
  };

  /** Explains the editor's query in a new frame, without running it. */
  const explainEditorQuery = () => {
    const query = cypherText.trim();
    if (!query) return;
    const frame: CypherFrame = { id: newFrameId(), createdAt: Date.now(), query, status: "done" };
    addFrame(frame);
    void explainFrame(frame);
  };

  const closeFrame = (frame: CypherFrame) => {
    if (frame.status === "generating" || frame.status === "running") stopFrame(frame);
    controllers.current.get(`${frame.id}:explain`)?.abort();
    setFrames((current) => current.filter((item) => item.id !== frame.id));
  };

  const runSample = (query: string) => {
    setMode("cypher");
    setCypherText(query);
    runNew(query);
  };

  const insertIntoEditor = (text: string) => {
    if (mode !== "cypher") setMode("cypher");
    // The editor mounts on switching modes; insert once it is there.
    window.setTimeout(() => editorRef.current?.insert(text), 0);
  };

  const dismissNotice = () => {
    setNoticeDismissed(true);
    writeFlag(AGENT_NOTICE_DISMISSED_KEY, true);
  };

  const latest = frames[0];
  const errorMark =
    mode === "cypher" && latest?.error && latest.query === cypherText.trim()
      ? errorMarkFrom(latest.error.message, latest.query)
      : null;
  const editorValue = mode === "cypher" ? cypherText : askText;

  /* ---------------- render ---------------- */

  const schemaPanel = schemaCollapsed ? null : (
    <aside className={styles.schemaPanel}>
      <div className={styles.schemaHeader}>
        <span className={styles.schemaTitle}>{t("knowledgeNetwork.cypherQuery.schema.title")}</span>
        <Tooltip title={t("knowledgeNetwork.cypherQuery.schema.collapsePanel")}>
          <Button
            aria-label={t("knowledgeNetwork.cypherQuery.schema.collapsePanel")}
            icon={<MenuFoldOutlined />}
            onClick={() => {
              setSchemaCollapsed(true);
              writeFlag(SCHEMA_COLLAPSED_KEY, true);
            }}
            size="small"
            type="text"
          />
        </Tooltip>
      </div>
      <div className={styles.schemaScroll}>
        {schemaLoading ? <Spin size="small" /> : null}
        {schemaError ? (
          <Alert
            message={t("knowledgeNetwork.cypherQuery.schema.loadFailed", { message: schemaError })}
            showIcon
            type="warning"
          />
        ) : null}
        {schema ? (
          <>
            <button
              className={styles.schemaGroup}
              onClick={() => setGroupOpen((open) => ({ ...open, objects: !open.objects }))}
              type="button"
            >
              {groupOpen.objects ? <CaretDownOutlined /> : <CaretRightOutlined />}
              <span>{t("knowledgeNetwork.cypherQuery.schema.objectTypes")}</span>
              <span className={styles.schemaCount}>{schema.object_types.length}</span>
            </button>
            {groupOpen.objects ? (
              schema.object_types.length === 0 ? (
                <div className={styles.schemaEmpty}>
                  {t("knowledgeNetwork.cypherQuery.schema.empty")}
                </div>
              ) : (
                schema.object_types.map((item) => {
                  const open = openTypes[item.id] ?? false;
                  const props = properties[item.id];
                  return (
                    <div key={item.id}>
                      <div className={styles.schemaRow}>
                        <button
                          aria-label={t("knowledgeNetwork.cypherQuery.schema.toggleProperties")}
                          className={styles.schemaCaret}
                          onClick={() =>
                            setOpenTypes((current) => ({ ...current, [item.id]: !open }))
                          }
                          type="button"
                        >
                          {open ? <CaretDownOutlined /> : <CaretRightOutlined />}
                        </button>
                        <Tooltip
                          placement="right"
                          title={`${item.id} · ${t("knowledgeNetwork.cypherQuery.schema.sampleHint")}`}
                        >
                          <button
                            className={styles.schemaItem}
                            data-testid={`cypher-schema-object-${item.id}`}
                            onClick={() => runSample(objectTypeSample(item.id))}
                            type="button"
                          >
                            <DatabaseOutlined />
                            <span>{item.name?.trim() || item.id}</span>
                          </button>
                        </Tooltip>
                      </div>
                      {open ? (
                        <div className={styles.schemaProperties}>
                          {props === undefined ? <Spin size="small" /> : null}
                          {props?.length === 0 ? (
                            <div className={styles.schemaEmpty}>
                              {t("knowledgeNetwork.cypherQuery.schema.empty")}
                            </div>
                          ) : null}
                          {props?.map((property) => (
                            <Tooltip
                              key={property.name}
                              placement="right"
                              title={[
                                property.displayName,
                                property.type,
                                t("knowledgeNetwork.cypherQuery.schema.insertHint"),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            >
                              <button
                                className={styles.schemaProperty}
                                data-testid={`cypher-schema-property-${item.id}-${property.name}`}
                                onClick={() => insertIntoEditor(cypherName(property.name))}
                                type="button"
                              >
                                <TagOutlined />
                                <span>{property.name}</span>
                              </button>
                            </Tooltip>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )
            ) : null}

            <button
              className={styles.schemaGroup}
              onClick={() => setGroupOpen((open) => ({ ...open, relations: !open.relations }))}
              type="button"
            >
              {groupOpen.relations ? <CaretDownOutlined /> : <CaretRightOutlined />}
              <span>{t("knowledgeNetwork.cypherQuery.schema.relationTypes")}</span>
              <span className={styles.schemaCount}>{schema.relation_types.length}</span>
            </button>
            {groupOpen.relations ? (
              schema.relation_types.length === 0 ? (
                <div className={styles.schemaEmpty}>
                  {t("knowledgeNetwork.cypherQuery.schema.empty")}
                </div>
              ) : (
                schema.relation_types.map((item) => (
                  <Tooltip
                    key={item.id}
                    placement="right"
                    title={`${names.objectTypes[item.sourceId] ?? item.sourceId} → ${names.objectTypes[item.targetId] ?? item.targetId} · ${t("knowledgeNetwork.cypherQuery.schema.sampleHint")}`}
                  >
                    <button
                      className={`${styles.schemaItem} ${styles.schemaRelation}`}
                      data-testid={`cypher-schema-relation-${item.id}`}
                      onClick={() => runSample(relationTypeSample(item))}
                      type="button"
                    >
                      <ApiOutlined />
                      <span>{item.name?.trim() || item.id}</span>
                    </button>
                  </Tooltip>
                ))
              )
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  );

  const showNotice = agentNotReady && !noticeDismissed;

  return (
    <GraphStyleContext.Provider
      value={{
        style: graphStyle,
        setStyle: setGraphStyle,
        properties,
        nodeLimit: graphStyle.nodeLimit ?? GRAPH_NODE_LIMIT,
      }}
    >
      <div className={schemaCollapsed ? `${styles.page} ${styles.pageRail}` : styles.page}>
        {schemaPanel}

        <div className={styles.main}>
          <div className={styles.editorCard}>
            <div className={styles.editorToolbar}>
              <div className={styles.editorHints}>
                {schemaCollapsed ? (
                  // Folded away, the schema comes back from the editor's corner instead of an empty rail.
                  <Tooltip title={t("knowledgeNetwork.cypherQuery.schema.expandPanel")}>
                    <Button
                      aria-label={t("knowledgeNetwork.cypherQuery.schema.expandPanel")}
                      icon={<MenuUnfoldOutlined />}
                      onClick={() => {
                        setSchemaCollapsed(false);
                        writeFlag(SCHEMA_COLLAPSED_KEY, false);
                      }}
                      size="small"
                      type="text"
                    />
                  </Tooltip>
                ) : null}
                <Segmented<Mode>
                  onChange={setMode}
                  options={[
                    { value: "cypher", label: t("knowledgeNetwork.cypherQuery.editor.modeCypher") },
                    {
                      value: "ask",
                      label: t("knowledgeNetwork.cypherQuery.editor.modeAsk"),
                      icon: <RobotOutlined />,
                    },
                  ]}
                  size="small"
                  value={mode}
                />
              </div>
              <div className={styles.editorHints}>
                <span className={styles.muted}>
                  {mode === "cypher"
                    ? t("knowledgeNetwork.cypherQuery.editor.shortcutWithHistory")
                    : t("knowledgeNetwork.cypherQuery.editor.shortcut")}
                </span>
                <Button
                  className={styles.referenceLink}
                  data-testid="cypher-reference-open"
                  icon={<ReadOutlined />}
                  onClick={() => setReferenceOpen(true)}
                  size="small"
                  type="link"
                >
                  {t("knowledgeNetwork.cypherQuery.reference.open")}
                </Button>
                <Popover
                  content={
                    <div className={styles.settings}>
                      <div className={styles.settingItem}>
                        <div className={styles.settingLabel}>
                          {t("knowledgeNetwork.cypherQuery.settings.nodeLimit")}
                        </div>
                        <InputNumber
                          data-testid="cypher-setting-node-limit"
                          max={5000}
                          min={10}
                          onChange={(value) =>
                            setGraphStyle((current) => ({
                              ...current,
                              nodeLimit: typeof value === "number" ? value : undefined,
                            }))
                          }
                          placeholder={String(GRAPH_NODE_LIMIT)}
                          size="small"
                          step={100}
                          style={{ width: "100%" }}
                          value={graphStyle.nodeLimit ?? GRAPH_NODE_LIMIT}
                        />
                        <div className={styles.settingHint}>
                          {t("knowledgeNetwork.cypherQuery.settings.nodeLimitHint")}
                        </div>
                      </div>
                      <div className={styles.settingsFooter}>
                        <Button
                          onClick={() => setGraphStyle(() => ({ nodes: {}, edges: {} }))}
                          size="small"
                        >
                          {t("knowledgeNetwork.cypherQuery.settings.reset")}
                        </Button>
                      </div>
                    </div>
                  }
                  placement="bottomRight"
                  title={t("knowledgeNetwork.cypherQuery.settings.title")}
                  trigger="click"
                >
                  <Tooltip title={t("knowledgeNetwork.cypherQuery.settings.title")}>
                    <Button
                      aria-label={t("knowledgeNetwork.cypherQuery.settings.title")}
                      data-testid="cypher-settings"
                      icon={<SettingOutlined />}
                      size="small"
                      type="text"
                    />
                  </Tooltip>
                </Popover>
                {mode === "cypher" ? (
                  <Tooltip
                    title={
                      editorExpanded
                        ? t("knowledgeNetwork.cypherQuery.editor.shrink")
                        : t("knowledgeNetwork.cypherQuery.editor.enlarge")
                    }
                  >
                    <Button
                      aria-label={
                        editorExpanded
                          ? t("knowledgeNetwork.cypherQuery.editor.shrink")
                          : t("knowledgeNetwork.cypherQuery.editor.enlarge")
                      }
                      icon={<ColumnHeightOutlined />}
                      onClick={() => setEditorExpanded((value) => !value)}
                      size="small"
                      type="text"
                    />
                  </Tooltip>
                ) : null}
              </div>
            </div>
            {showNotice && mode === "ask" ? (
              <Alert
                closable
                message={t("knowledgeNetwork.cypherQuery.agent.notReady")}
                onClose={dismissNotice}
                showIcon
                type="warning"
              />
            ) : null}
            {followUp && mode === "ask" ? (
              <div className={styles.followUp}>
                <Tag
                  closable
                  color="purple"
                  icon={<RobotOutlined />}
                  onClose={() => setFollowUp(null)}
                >
                  {t("knowledgeNetwork.cypherQuery.editor.followingUp", {
                    question: followUp.question,
                  })}
                </Tag>
              </div>
            ) : null}
            {mode === "cypher" ? (
              <CypherEditor
                ariaLabel={t("knowledgeNetwork.cypherQuery.editor.modeCypher")}
                errorMark={errorMark}
                maxHeight={editorExpanded ? EDITOR_MAX_HEIGHT_EXPANDED : EDITOR_MAX_HEIGHT}
                minHeight={editorExpanded ? EDITOR_MIN_HEIGHT_EXPANDED : undefined}
                onChange={(value) => {
                  historyPosition.current = -1;
                  setCypherText(value);
                }}
                onHistory={stepThroughHistory}
                onRun={submit}
                ref={editorRef}
                schema={completionSchema}
                value={cypherText}
              />
            ) : (
              <Input.TextArea
                aria-label={t("knowledgeNetwork.cypherQuery.editor.modeAsk")}
                autoFocus
                autoSize={
                  editorExpanded ? { minRows: 10, maxRows: 16 } : { minRows: 2, maxRows: 6 }
                }
                onChange={(event) => setAskText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder={t("knowledgeNetwork.cypherQuery.editor.askPlaceholder")}
                value={askText}
              />
            )}
            <div className={styles.editorActions}>
              {agentNotReady && noticeDismissed && mode === "ask" ? (
                <span className={styles.agentHint}>
                  {t("knowledgeNetwork.cypherQuery.agent.notReadyShort")}
                </span>
              ) : null}
              {mode === "cypher" ? (
                <Button
                  data-testid="cypher-editor-explain"
                  disabled={!cypherText.trim()}
                  icon={<BulbOutlined />}
                  onClick={explainEditorQuery}
                  size="small"
                >
                  {t("knowledgeNetwork.cypherQuery.editor.explain")}
                </Button>
              ) : null}
              <Button
                disabled={!editorValue}
                onClick={() => (mode === "cypher" ? setCypherText("") : setAskText(""))}
                size="small"
              >
                {t("knowledgeNetwork.cypherQuery.editor.clear")}
              </Button>
              <Button
                disabled={!editorValue.trim()}
                icon={mode === "cypher" ? <CaretRightOutlined /> : <RobotOutlined />}
                onClick={submit}
                size="small"
                type="primary"
              >
                {mode === "cypher"
                  ? t("knowledgeNetwork.cypherQuery.editor.run")
                  : t("knowledgeNetwork.cypherQuery.editor.generate")}
              </Button>
            </div>
          </div>

          <div className={styles.streamHeader}>
            <span className={styles.muted}>
              {frames.length > 0
                ? t("knowledgeNetwork.cypherQuery.frames.count", { count: frames.length })
                : ""}
            </span>
            {frames.length > 0 ? (
              <Button
                icon={<CloseOutlined />}
                onClick={() => {
                  controllers.current.forEach((controller) => controller.abort());
                  controllers.current.clear();
                  setFrames([]);
                }}
                size="small"
                type="link"
              >
                {t("knowledgeNetwork.cypherQuery.frames.clearAll")}
              </Button>
            ) : null}
          </div>
          <div className={styles.stream} data-testid="cypher-stream" ref={streamRef}>
            {frames.length === 0 ? (
              <Empty description={t("knowledgeNetwork.cypherQuery.frames.empty")} />
            ) : null}
            {frames.map((frame) => (
              <CypherFrameCard
                frame={frame}
                highlighted={highlighted === frame.id}
                key={frame.id}
                names={names}
                onClose={() => closeFrame(frame)}
                onFix={() => fixFrame(frame)}
                onFollowUp={() => {
                  if (!frame.ai?.threadId) return;
                  setFollowUp({ threadId: frame.ai.threadId, question: frame.ai.question });
                  setMode("ask");
                }}
                onLoad={() => {
                  setMode("cypher");
                  setCypherText(frame.query);
                }}
                onRerun={() => void runInFrame(frame.id, frame.query)}
                onStop={() => stopFrame(frame)}
                onExplain={() => void explainFrame(frame)}
                onGraphSettings={(graphSettings) =>
                  setFrames((current) =>
                    updateFrame(current, frame.id, (item) => ({ ...item, graphSettings })),
                  )
                }
                onStopExplain={() => stopExplaining(frame)}
              />
            ))}
          </div>
        </div>
      </div>
      <CypherReference
        onClose={() => setReferenceOpen(false)}
        onUse={(query) => {
          historyPosition.current = -1;
          setMode("cypher");
          setCypherText(query);
        }}
        open={referenceOpen}
      />
    </GraphStyleContext.Provider>
  );
}
