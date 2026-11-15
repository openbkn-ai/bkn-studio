/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EvalFieldLabel, EvalHelpTooltip } from "./EvalFieldLabel";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Space, Typography } from "antd";
import { JsonInput } from "@/framework/json/JsonInput";
import { JsonTextBlock } from "@/framework/json/JsonTextBlock";
import {
  formatPrecisionSafeJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { validateCaseArguments } from "./case-form-model";
import type { EvalCaseDefinition } from "./m0-run.service";
import { declarationParametersSchema } from "./rule-check-model";
import {
  previewRuleApplication,
  type RuleApplicationRow,
  type RuleApplicationSample,
} from "./rule-application.service";
import { useEvalTranslation } from "./useEvalTranslation";

type Props = {
  networkId: string;
  row: RuleApplicationRow;
  initialDefinition?: EvalCaseDefinition;
  onPrepared: (definition?: EvalCaseDefinition) => void;
  onSamplePrepared?: (sample: RuleApplicationSample, definition: EvalCaseDefinition) => void;
  onDirty?: (dirty: boolean) => void;
  frozenDefinition?: EvalCaseDefinition;
};

// The rule supplies its parameter schema. New standards and declaration rules
// reuse this form without frontend resource/rule identity branches.
export function EvalDeclarationCaseFields({
  networkId,
  row,
  initialDefinition,
  onPrepared,
  onSamplePrepared,
  onDirty,
  frozenDefinition,
}: Props) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.declaration.${key}`);
  const program = row.check?.declaration;
  const [value, setValue] = useState(() =>
    formatPrecisionSafeJSON(
      transformPrecisionSafeJSONRequest(
        initialDefinition?.input_spec.arguments ?? row.sample.arguments ?? {},
      ),
    ),
  );
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (frozenDefinition) onPrepared(frozenDefinition);
  }, [frozenDefinition, onPrepared]);
  const schema = declarationParametersSchema(program);
  const entries = Object.entries(program?.parameters ?? {});
  const prepare = async () => {
    const current = ++generation.current;
    onPrepared(undefined);
    setError("");
    setBusy(true);
    try {
      const args = validateCaseArguments(value, schema);
      if (frozenDefinition) {
        const definition = structuredClone(frozenDefinition);
        definition.input_spec = { ...definition.input_spec, arguments: args };
        definition.execution_spec = { ...definition.execution_spec, parameters: args };
        onPrepared(definition);
        onDirty?.(false);
        return;
      }
      const preview = await previewRuleApplication(networkId, {
        resources: [row.resource],
        rule_ids: [row.rule_id],
        targets: [
          {
            resource_key: `${row.resource.kind}:${row.resource.id}`,
            rule_id: row.rule_id,
            target_id: row.target_id,
          },
        ],
        samples: [{ ...row.sample, arguments: args }],
        only_samples: true,
        page: 1,
        limit: 100,
      });
      if (current !== generation.current) return;
      const prepared = preview.entries.find((item) => item.target_key === row.target_key);
      if (!prepared?.ready_for_save || !prepared.prepared_definition) {
        setError(prepared?.missing.join("；") || prepared?.save_error || text("invalid"));
        return;
      }
      onPrepared(prepared.prepared_definition);
      onSamplePrepared?.(prepared.sample, prepared.prepared_definition);
      onDirty?.(false);
    } catch (cause) {
      if (current === generation.current)
        setError(cause instanceof Error ? cause.message : text("invalid"));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <EvalFieldLabel hint={text("scope")}>{text("parameters")}</EvalFieldLabel>
      {entries.length > 0 ? (
        <>
          {entries.map(([name, param]) => (
            <Typography.Text key={name}>
              {name} · {param.title}
              {param.required ? ` (${text("required")})` : ""}
            </Typography.Text>
          ))}
          <JsonInput
            ariaLabel={text("parameters")}
            height={240}
            schema={schema}
            value={value}
            onChange={(next) => {
              generation.current++;
              setBusy(false);
              setValue(next);
              onPrepared(undefined);
              onDirty?.(true);
              setError("");
            }}
          />
          <details>
            <summary>
              {text("example")}{" "}
              <EvalHelpTooltip label={text("example")} title={text("exampleHelp")} />
            </summary>
            <JsonTextBlock
              text={formatPrecisionSafeJSON(
                transformPrecisionSafeJSONRequest(
                  Object.fromEntries(
                    entries
                      .filter(([, p]) => p.example !== undefined)
                      .map(([name, p]) => [name, p.example]),
                  ),
                ),
              )}
              maxHeight={300}
            />
          </details>
        </>
      ) : (
        <Typography.Text>{text("noParameters")}</Typography.Text>
      )}
      {error && <Alert type="error" showIcon message={error} />}
      <Button loading={busy} onClick={() => void prepare()}>
        {text("prepare")}
      </Button>
    </Space>
  );
}
