/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  BulbOutlined,
  CloseOutlined,
  CommentOutlined,
  DownOutlined,
  ExportOutlined,
  EditOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  ReloadOutlined,
  RightOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { Alert, Button, Collapse, Dropdown, Segmented, Spin, Tag, Tooltip, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { FrameGraphSettings } from "@/modules/knowledge-network/cypher/graph-style";
import { CypherGraphView } from "@/modules/knowledge-network/components/cypher/CypherGraphView";
import { CypherPlanView } from "@/modules/knowledge-network/components/cypher/CypherPlanView";
import { CypherResultTable } from "@/modules/knowledge-network/components/cypher/CypherResultTable";
import type { CypherFrame } from "@/modules/knowledge-network/cypher/cypher-frames";
import { splitExplain } from "@/modules/knowledge-network/cypher/cypher-plan";
import { downloadText } from "@/modules/knowledge-network/cypher/download";
import { useGraphStyle } from "@/modules/knowledge-network/cypher/graph-style-context";
import {
  buildCypherGraph,
  resultHoldsGraph,
  resultToCsv,
  type CypherSchemaNames,
} from "@/modules/knowledge-network/cypher/graph-values";

import styles from "./CypherQueryScene.module.css";

type View = "table" | "graph" | "raw" | "plan";

function RawView({ frame }: { frame: CypherFrame }) {
  const { t } = useTranslation();
  if (!frame.exchange) return null;
  const request = JSON.stringify(
    { method: "POST", url: frame.exchange.url, body: frame.exchange.request },
    null,
    2,
  );
  const response = JSON.stringify(
    { status: frame.exchange.status, body: frame.exchange.response },
    null,
    2,
  );
  return (
    <div className={styles.rawView}>
      <div className={styles.cellDetailTitle}>
        {t("knowledgeNetwork.cypherQuery.raw.request")}
        <Typography.Text copyable={{ text: request }} />
      </div>
      <pre className={styles.rawBlock}>{request}</pre>
      <div className={styles.cellDetailTitle}>
        {t("knowledgeNetwork.cypherQuery.raw.response")}
        <Typography.Text copyable={{ text: response }} />
      </div>
      <pre className={styles.rawBlock}>{response}</pre>
    </div>
  );
}

/** A filled square, the usual sign for stopping something that runs. */
function StopIcon() {
  return <span aria-hidden className={`anticon ${styles.stopIcon}`} />;
}

export function CypherFrameCard({
  frame,
  names,
  highlighted,
  onClose,
  onFix,
  onFollowUp,
  onLoad,
  onRerun,
  onStop,
  onExplain,
  onStopExplain,
  onGraphSettings,
}: {
  frame: CypherFrame;
  names: CypherSchemaNames;
  /** Just added: flash it so the eye finds it. */
  highlighted?: boolean;
  onClose: () => void;
  onFix: () => void;
  onFollowUp: () => void;
  onLoad: () => void;
  onRerun: () => void;
  onStop: () => void;
  onExplain: () => void;
  onStopExplain: () => void;
  onGraphSettings: (settings: FrameGraphSettings) => void;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const holdsGraph = useMemo(
    () => (frame.result ? resultHoldsGraph(frame.result) : false),
    [frame.result],
  );
  const { nodeLimit } = useGraphStyle();
  const [showAll, setShowAll] = useState(false);
  const graph = useMemo(
    () =>
      frame.result && holdsGraph
        ? buildCypherGraph(frame.result, names, showAll ? Infinity : nodeLimit)
        : null,
    [frame.result, holdsGraph, names, nodeLimit, showAll],
  );
  const [chosenView, setChosenView] = useState<View | null>(null);
  // The plan replaces the rows only when the query asked for one.
  const plan = splitExplain(frame.query).explain ? frame.result?.plan : undefined;
  const view: View = chosenView ?? (plan ? "plan" : holdsGraph ? "graph" : "table");
  const busy = frame.status === "generating" || frame.status === "running";
  const latestTool = frame.ai?.tools?.[frame.ai.tools.length - 1];
  const fileName = `cypher-${frame.id}`;

  useEffect(() => {
    if (!fullscreen) return;
    const leave = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", leave);
    return () => window.removeEventListener("keydown", leave);
  }, [fullscreen]);

  const exportItems = frame.result
    ? [
        {
          key: "csv",
          label: t("knowledgeNetwork.cypherQuery.frames.exportCsv"),
          onClick: () =>
            frame.result &&
            downloadText(`${fileName}.csv`, resultToCsv(frame.result, names), "text/csv", true),
        },
        {
          key: "json",
          label: t("knowledgeNetwork.cypherQuery.frames.exportJson"),
          onClick: () =>
            downloadText(
              `${fileName}.json`,
              JSON.stringify(frame.exchange?.response ?? frame.result, null, 2),
              "application/json",
            ),
        },
      ]
    : [];

  const action = (title: string, icon: React.ReactNode, onClick: () => void, testId?: string) => (
    <Tooltip title={title}>
      <Button
        aria-label={title}
        data-testid={testId}
        icon={icon}
        onClick={onClick}
        size="small"
        type="text"
      />
    </Tooltip>
  );

  const header = (
    <div className={styles.frameHeader}>
      <button
        aria-label={
          collapsed
            ? t("knowledgeNetwork.cypherQuery.frames.expand")
            : t("knowledgeNetwork.cypherQuery.frames.collapse")
        }
        className={styles.iconButton}
        onClick={() => setCollapsed((value) => !value)}
        type="button"
      >
        {collapsed ? <RightOutlined /> : <DownOutlined />}
      </button>
      <div className={styles.frameTitle}>
        {frame.ai ? (
          <div className={styles.frameQuestion}>
            <Tag color="purple" icon={<RobotOutlined />}>
              {t("knowledgeNetwork.cypherQuery.frames.aiBadge")}
            </Tag>
            <span>{frame.ai.question}</span>
          </div>
        ) : null}
        {frame.query ? (
          <Tooltip title={t("knowledgeNetwork.cypherQuery.frames.loadQuery")}>
            <button className={styles.frameQuery} onClick={onLoad} type="button">
              <code>{frame.query}</code>
            </button>
          </Tooltip>
        ) : null}
      </div>
      <div className={styles.frameActions}>
        {busy
          ? action(
              t("knowledgeNetwork.cypherQuery.frames.stop"),
              <StopIcon />,
              onStop,
              "cypher-frame-stop",
            )
          : null}
        {!busy && frame.ai?.threadId
          ? action(
              t("knowledgeNetwork.cypherQuery.frames.followUp"),
              <CommentOutlined />,
              onFollowUp,
            )
          : null}
        {frame.query && !busy && frame.explanation?.status !== "running"
          ? action(
              t("knowledgeNetwork.cypherQuery.frames.explain"),
              <BulbOutlined />,
              onExplain,
              "cypher-frame-explain",
            )
          : null}
        {frame.query && !busy ? (
          <>
            {action(t("knowledgeNetwork.cypherQuery.frames.loadQuery"), <EditOutlined />, onLoad)}
            {action(
              t("knowledgeNetwork.cypherQuery.frames.rerun"),
              <ReloadOutlined />,
              onRerun,
              "cypher-frame-rerun",
            )}
          </>
        ) : null}
        {exportItems.length > 0 ? (
          <Dropdown menu={{ items: exportItems }} trigger={["click"]}>
            <Button
              aria-label={t("knowledgeNetwork.cypherQuery.frames.export")}
              icon={<ExportOutlined />}
              size="small"
              type="text"
            />
          </Dropdown>
        ) : null}
        {action(
          fullscreen
            ? t("knowledgeNetwork.cypherQuery.frames.exitFullscreen")
            : t("knowledgeNetwork.cypherQuery.frames.fullscreen"),
          fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />,
          () => setFullscreen((value) => !value),
        )}
        {action(t("knowledgeNetwork.cypherQuery.frames.close"), <CloseOutlined />, onClose)}
      </div>
    </div>
  );

  const renderBody = () => {
    if (busy) {
      const text =
        frame.status === "running"
          ? t("knowledgeNetwork.cypherQuery.frames.running")
          : latestTool
            ? t("knowledgeNetwork.cypherQuery.frames.generatingTool", { tool: latestTool })
            : t("knowledgeNetwork.cypherQuery.frames.generating");
      return (
        <div className={styles.frameBusy}>
          <Spin size="small" />
          <span>{text}</span>
          <Button
            data-testid="cypher-frame-stop-inline"
            icon={<StopIcon />}
            onClick={onStop}
            size="small"
            type="text"
          >
            {t("knowledgeNetwork.cypherQuery.frames.stop")}
          </Button>
        </div>
      );
    }
    if (frame.generationError) {
      return <Alert message={frame.generationError} showIcon type="warning" />;
    }
    if (frame.resultDropped) {
      return (
        <Alert
          className={styles.frameNotice}
          message={t("knowledgeNetwork.cypherQuery.frames.resultDropped")}
          type="info"
        />
      );
    }
    if (frame.error) {
      const errorText = [
        frame.error.message,
        frame.error.code
          ? t("knowledgeNetwork.cypherQuery.status.code", { code: frame.error.code })
          : "",
        frame.error.solution
          ? t("knowledgeNetwork.cypherQuery.status.solution", { solution: frame.error.solution })
          : "",
      ].filter(Boolean);
      return (
        <>
          <Alert
            action={
              frame.ai?.threadId ? (
                <Button icon={<RobotOutlined />} onClick={onFix} size="small">
                  {t("knowledgeNetwork.cypherQuery.frames.fixWithAi")}
                </Button>
              ) : undefined
            }
            description={
              <div className={styles.errorLines}>
                {errorText.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            }
            message={t("knowledgeNetwork.cypherQuery.status.error")}
            showIcon
            type="error"
          />
          {frame.exchange ? (
            <Collapse
              className={styles.answerCollapse}
              ghost
              items={[
                {
                  key: "raw",
                  label: t("knowledgeNetwork.cypherQuery.views.raw"),
                  children: <RawView frame={frame} />,
                },
              ]}
              size="small"
            />
          ) : null}
        </>
      );
    }
    if (!frame.result) return null;
    if (plan) {
      // An explained query has a plan and no rows.
      return (
        <>
          <Segmented<View>
            className={styles.viewSwitch}
            onChange={setChosenView}
            options={[
              { value: "plan", label: t("knowledgeNetwork.cypherQuery.views.plan") },
              { value: "raw", label: t("knowledgeNetwork.cypherQuery.views.raw") },
            ]}
            size="small"
            value={view === "raw" ? "raw" : "plan"}
          />
          {view === "raw" ? (
            <RawView frame={frame} />
          ) : (
            <CypherPlanView names={names} plan={plan} />
          )}
          {frame.exchange ? (
            <div className={styles.statusBar}>
              <span>
                {t("knowledgeNetwork.cypherQuery.status.latency", {
                  ms: frame.exchange.latencyMs,
                })}
              </span>
            </div>
          ) : null}
        </>
      );
    }
    return (
      <>
        <Segmented<View>
          className={styles.viewSwitch}
          onChange={setChosenView}
          options={[
            {
              value: "graph",
              disabled: !holdsGraph,
              label: holdsGraph ? (
                t("knowledgeNetwork.cypherQuery.views.graph")
              ) : (
                <Tooltip title={t("knowledgeNetwork.cypherQuery.views.graphDisabled")}>
                  <span>{t("knowledgeNetwork.cypherQuery.views.graph")}</span>
                </Tooltip>
              ),
            },
            { value: "table", label: t("knowledgeNetwork.cypherQuery.views.table") },
            { value: "raw", label: t("knowledgeNetwork.cypherQuery.views.raw") },
          ]}
          size="small"
          value={view}
        />
        {view === "graph" && graph ? (
          <CypherGraphView
            fileName={fileName}
            graph={graph}
            onRerun={onRerun}
            onSettingsChange={onGraphSettings}
            onShowAll={() => setShowAll(true)}
            settings={frame.graphSettings}
            wheelZoom={fullscreen}
          />
        ) : null}
        {view === "table" ? (
          <CypherResultTable fullHeight={fullscreen} names={names} result={frame.result} />
        ) : null}
        {view === "raw" ? <RawView frame={frame} /> : null}
        <div className={styles.statusBar}>
          <span>
            {t("knowledgeNetwork.cypherQuery.status.rows", { count: frame.result.entries.length })}
          </span>
          {frame.result.limited ? (
            <span className={styles.statusLimited} data-testid="cypher-limited">
              {t("knowledgeNetwork.cypherQuery.status.limited", {
                count: frame.result.entries.length,
              })}
            </span>
          ) : null}
          {frame.exchange ? (
            <span>
              {t("knowledgeNetwork.cypherQuery.status.latency", { ms: frame.exchange.latencyMs })}
            </span>
          ) : null}
        </div>
      </>
    );
  };

  const className = [
    styles.frame,
    highlighted ? styles.frameHighlighted : "",
    fullscreen ? styles.frameFullscreen : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={className} data-testid="cypher-frame">
      {header}
      {collapsed ? null : (
        <div className={styles.frameBody}>
          {renderBody()}
          {frame.explanation ? (
            <div className={styles.explanation} data-testid="cypher-frame-explanation">
              <div className={styles.explanationTitle}>
                <BulbOutlined />
                <span>{t("knowledgeNetwork.cypherQuery.frames.explanation")}</span>
                {frame.explanation.status === "running" ? (
                  <>
                    <Spin size="small" />
                    <span className={styles.muted}>
                      {frame.explanation.tools?.length
                        ? t("knowledgeNetwork.cypherQuery.frames.generatingTool", {
                            tool: frame.explanation.tools[frame.explanation.tools.length - 1],
                          })
                        : t("knowledgeNetwork.cypherQuery.frames.explaining")}
                    </span>
                    <Button
                      data-testid="cypher-frame-stop-explain"
                      icon={<StopIcon />}
                      onClick={onStopExplain}
                      size="small"
                      type="text"
                    >
                      {t("knowledgeNetwork.cypherQuery.frames.stop")}
                    </Button>
                  </>
                ) : null}
              </div>
              {frame.explanation.status === "error" ? (
                <Alert message={frame.explanation.text} showIcon type="warning" />
              ) : frame.explanation.text ? (
                <div className={styles.answer}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {frame.explanation.text}
                  </ReactMarkdown>
                </div>
              ) : null}
            </div>
          ) : null}
          {frame.ai?.answer ? (
            <Collapse
              className={styles.answerCollapse}
              ghost
              items={[
                {
                  key: "answer",
                  label: t("knowledgeNetwork.cypherQuery.frames.answer"),
                  children: (
                    <div className={styles.answer}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{frame.ai.answer}</ReactMarkdown>
                    </div>
                  ),
                },
              ]}
              size="small"
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
