/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Drawer, Typography } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";
import type { ToolIoSpec } from "@/modules/execution-factory/types/tool";
import {
  buildToolCallCli,
  buildToolCallCurl,
  toolCallEnvelope,
  toolCallResponseExample,
  type ToolCallKind,
} from "@/modules/execution-factory/utils/tool-call-guide";

import styles from "./ToolCallGuideDrawer.module.css";

function CodeSample({ code, label }: { code: string; label: string }) {
  return (
    <div className={styles.code}>
      <Typography.Text className={styles.copy} copyable={{ text: code }} />
      <pre aria-label={label}>{code}</pre>
    </div>
  );
}

/**
 * How to call a tool once it is saved: over HTTP through the toolbox proxy, and by an Agent
 * through Context Loader once the toolbox is mounted on a network. The examples carry the tool's
 * own ids and sample arguments, so they run as they are once a token is filled in.
 */
export function ToolCallGuideDrawer({
  boxId,
  functionInput,
  ioSpec,
  kind,
  onClose,
  open,
  toolId,
}: {
  boxId: string;
  toolId: string;
  kind: ToolCallKind;
  ioSpec?: ToolIoSpec;
  functionInput?: FunctionInputPayload;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const key = (name: string) => `executionFactory.callGuide.${name}`;
  const envelope = useMemo(() => toolCallEnvelope(ioSpec, functionInput), [functionInput, ioSpec]);
  const curl = useMemo(
    () => buildToolCallCurl({ origin: window.location.origin, boxId, toolId, envelope }),
    [boxId, envelope, toolId],
  );
  const cli = useMemo(
    () => buildToolCallCli({ boxId, toolId, envelope }),
    [boxId, envelope, toolId],
  );
  const response = useMemo(() => toolCallResponseExample(kind), [kind]);
  const isFunction = kind.kind !== "openapi";

  return (
    <Drawer destroyOnHidden onClose={onClose} open={open} title={t(key("title"))} width={760}>
      <section className={styles.section}>
        <h4 className={styles.title}>{t(key("httpTitle"))}</h4>
        <ul className={styles.notes}>
          <li>{t(key("httpPrerequisite"))}</li>
          {kind.kind === "cypher" ? <li>{t(key("httpCypherIdentity"))}</li> : null}
          <li>{t(key("httpToken"))}</li>
          <li>{t(isFunction ? key("httpEnvelopeFunction") : key("httpEnvelopeOpenapi"))}</li>
        </ul>
        <CodeSample code={curl} label={t(key("httpTitle"))} />
      </section>

      <section className={styles.section}>
        <h4 className={styles.title}>{t(key("responseTitle"))}</h4>
        <ul className={styles.notes}>
          <li>{t(key("responseEnvelope"))}</li>
          <li>
            {kind.kind === "cypher"
              ? t(key(kind.shape === "value" ? "responseCypherValue" : "responseCypherTable"))
              : t(key(kind.kind === "python" ? "responsePython" : "responseOpenapi"))}
          </li>
        </ul>
        <CodeSample code={response} label={t(key("responseTitle"))} />
      </section>

      <section className={styles.section}>
        <h4 className={styles.title}>{t(key("agentTitle"))}</h4>
        <ul className={styles.notes}>
          <li>{t(key("agentMount"))}</li>
        </ul>
        <CodeSample code={cli} label={t(key("agentTitle"))} />
      </section>

      <section className={styles.section}>
        <h4 className={styles.title}>{t(key("bindTitle"))}</h4>
        <ul className={styles.notes}>
          {kind.kind === "cypher" && kind.shape === "value" ? (
            <li>{t(key("bindLogicValue"))}</li>
          ) : null}
          <li>{t(key("bindLogic"))}</li>
          <li>{t(key("bindAction"))}</li>
        </ul>
      </section>
    </Drawer>
  );
}
