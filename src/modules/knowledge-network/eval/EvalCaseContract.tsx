/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Collapse, Typography } from "antd";
import { JsonSchemaFields } from "@/framework/json/JsonSchemaFields";
import { JsonTextBlock } from "@/framework/json/JsonTextBlock";
import {
  formatPrecisionSafeJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import type { CaseTargetSchema } from "./case-form.service";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalCaseEditorDrawer.module.css";

export function EvalCaseContract({ contract }: { contract: CaseTargetSchema }) {
  const { t } = useEvalTranslation();
  const l = (key: string) => t(`knowledgeNetwork.eval.caseEditor.${key}`);
  if (!contract.input && !contract.output) return null;
  const labels = {
    name: l("contractField"),
    type: l("contractType"),
    required: l("parameterRequired"),
    description: l("contractDescription"),
  };
  return (
    <Collapse
      className={styles.contract}
      size="small"
      items={[
        {
          key: "contract",
          label: l("contractTitle"),
          children: (
            <div className={styles.contractGrid}>
              {(["input", "output"] as const).map((kind) => (
                <section key={kind}>
                  <Typography.Title level={5}>
                    {l(kind === "input" ? "inputContract" : "outputContract")}
                  </Typography.Title>
                  {contract[kind] ? (
                    <>
                      <JsonSchemaFields compact schema={contract[kind]} labels={labels} />
                      <JsonTextBlock
                        maxHeight={360}
                        text={formatPrecisionSafeJSON(
                          transformPrecisionSafeJSONRequest(contract[kind]),
                        )}
                      />
                    </>
                  ) : (
                    <Typography.Text type="secondary">{l("contractUndeclared")}</Typography.Text>
                  )}
                </section>
              ))}
            </div>
          ),
        },
      ]}
    />
  );
}
