/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { workspaceUi } from "./workspace-ui-text";
import { useEvalTranslation } from "./useEvalTranslation";

import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { Alert, Button, Checkbox, Drawer, Input, Select, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";

import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import {
  getEvalOverviewScope,
  listEvalCaseResourcesPage,
  saveEvalOverviewScope,
  type EvalCaseResource,
  type EvalOverviewScope,
} from "./m0-run.service";
import styles from "./EvalOverviewScopeDrawer.module.css";
import { useEvalFeedback } from "./useEvalFeedback";

const kinds = [
  {
    value: "objectType",
    get label() {
      return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.objectType");
    },
  },
  {
    value: "relationType",
    get label() {
      return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.relationType");
    },
  },
  {
    value: "action",
    get label() {
      return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.action");
    },
  },
  {
    value: "metric",
    get label() {
      return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.metric");
    },
  },
  {
    value: "function",
    get label() {
      return workspaceUi("knowledgeNetwork.eval.templateUi.kinds.function");
    },
  },
  { value: "api", label: "API" },
  { value: "mcp", label: "MCP" },
  { value: "skill", label: "SKILLS" },
];

const kindLabel = (kind: string) => kinds.find((item) => item.value === kind)?.label ?? kind;

type Props = {
  networkId: string;
  open: boolean;
  canManage: boolean;
  onClose: () => void;
  onSaved: (scope: EvalOverviewScope) => void;
};

export function EvalOverviewScopeDrawer({ networkId, open, canManage, onClose, onSaved }: Props) {
  useEvalTranslation();
  const { message } = useEvalFeedback();
  const [scope, setScope] = useState<EvalOverviewScope>();
  const [resources, setResources] = useState<EvalCaseResource[]>([]);
  const [total, setTotal] = useState(0);
  const [kind, setKind] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceReadWarnings, setResourceReadWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    void getEvalOverviewScope(networkId)
      .then((value) => {
        if (active) setScope(value);
      })
      .catch(() => {
        if (active) message.error(workspaceUi("cannotLoadEvaluationScopeTryAgainLater"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [networkId, open, message]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setResourceLoading(true);
    setResourceReadWarnings([]);
    void listEvalCaseResourcesPage(networkId, kind, search, page, pageSize)
      .then((value) => {
        if (active) {
          setResources(value.entries);
          setTotal(value.total);
          setResourceReadWarnings([
            ...new Set((value.read_issues ?? []).map((issue) => issue.reason)),
          ]);
        }
      })
      .catch(() => {
        if (active) {
          setResources([]);
          setTotal(0);
          message.error(workspaceUi("cannotLoadKnowledgeNetworkResourcesTryAgainLater"));
        }
      })
      .finally(() => {
        if (active) setResourceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, networkId, open, page, search, message]);

  const excludedResources = useMemo(
    () => new Set((scope?.excluded_resources ?? []).map((item) => `${item.kind}\u0000${item.id}`)),
    [scope?.excluded_resources],
  );

  const toggleKind = (value: string, included: boolean) => {
    if (!scope) return;
    setScope({
      ...scope,
      excluded_kinds: included
        ? scope.excluded_kinds.filter((item) => item !== value)
        : [...new Set([...scope.excluded_kinds, value])],
      excluded_resources: included
        ? scope.excluded_resources
        : scope.excluded_resources.filter((item) => item.kind !== value),
    });
  };

  const toggleResource = (resource: EvalCaseResource, included: boolean) => {
    if (!scope) return;
    const key = `${resource.kind}\u0000${resource.id}`;
    setScope({
      ...scope,
      excluded_resources: included
        ? scope.excluded_resources.filter((item) => `${item.kind}\u0000${item.id}` !== key)
        : [...scope.excluded_resources, { kind: resource.kind, id: resource.id }],
    });
  };

  const save = async () => {
    if (!scope) return;
    setSaving(true);
    try {
      const saved = await saveEvalOverviewScope(networkId, scope);
      setScope(saved);
      onSaved(saved);
      message.success(workspaceUi("evaluationScopeUpdated"));
      onClose();
    } catch {
      message.error(workspaceUi("couldNotSaveTheEvaluationScopeMayHaveChanged"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={workspaceUi("configureEvaluationScope")}
      open={open}
      width="min(760px, 96vw)"
      onClose={onClose}
      footer={
        <div className={styles.footer}>
          <Button onClick={onClose}>{workspaceUi("knowledgeNetwork.eval.m0.cancel")}</Button>
          <Button
            type="primary"
            disabled={!canManage || !scope}
            loading={saving}
            onClick={() => void save()}
          >
            {workspaceUi("confirm")}
          </Button>
        </div>
      }
    >
      {loading || !scope ? (
        <Spin />
      ) : (
        <div className={styles.body}>
          {resourceReadWarnings.length > 0 && (
            <Alert type="warning" showIcon message={resourceReadWarnings.join("；")} />
          )}
          <Alert
            showIcon
            type="info"
            message={workspaceUi("allResourcesInTheCurrentKnowledgeNetworkAreIncluded")}
          />
          <section className={styles.section}>
            <h3>{workspaceUi("byResourceType")}</h3>
            <div className={styles.kindGrid}>
              {kinds.map((item) => (
                <Checkbox
                  key={item.value}
                  disabled={!canManage}
                  checked={!scope.excluded_kinds.includes(item.value)}
                  onChange={(event) => toggleKind(item.value, event.target.checked)}
                >
                  {item.label}
                </Checkbox>
              ))}
            </div>
          </section>
          <section className={styles.section}>
            <h3>{workspaceUi("byResource")}</h3>
            <div className={styles.filters}>
              <Select
                value={kind}
                onChange={(value) => {
                  setKind(value);
                  setPage(1);
                }}
                options={[
                  {
                    value: "",
                    label: workspaceUi("knowledgeNetwork.eval.resourceOverview.allKinds"),
                  },
                  ...kinds,
                ]}
              />
              <Input.Search
                value={searchInput}
                placeholder={workspaceUi("knowledgeNetwork.eval.ruleApplication.resourceSearch")}
                onChange={(event) => setSearchInput(event.target.value)}
                onSearch={(value) => {
                  setSearch(value.trim());
                  setPage(1);
                }}
                allowClear
              />
            </div>
            <Table<EvalCaseResource>
              scroll={{ x: 600 }}
              rowKey={(row) => `${row.kind}:${row.id}`}
              loading={resourceLoading}
              dataSource={resources}
              pagination={false}
              columns={[
                {
                  title: workspaceUi("includedInEvaluation"),
                  width: 96,
                  render: (_value, row) => {
                    const kindExcluded = scope.excluded_kinds.includes(row.kind);
                    return (
                      <Checkbox
                        aria-label={workspaceUi("includeInEvaluation", { value0: row.name })}
                        disabled={!canManage || kindExcluded}
                        checked={
                          !kindExcluded && !excludedResources.has(`${row.kind}\u0000${row.id}`)
                        }
                        onChange={(event) => toggleResource(row, event.target.checked)}
                      />
                    );
                  },
                },
                {
                  title: workspaceUi("resourceName"),
                  dataIndex: "name",
                  render: (name: string) => (
                    <span className={styles.resourceName} title={name}>
                      {name}
                    </span>
                  ),
                },
                {
                  title: workspaceUi("knowledgeNetwork.eval.filterUi.resourceType"),
                  dataIndex: "kind",
                  width: 120,
                  render: kindLabel,
                },
              ]}
            />
            <TablePaginationBar
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              showTotal={(count) => workspaceUi("resourcesInTotal", { value0: count })}
              onChange={setPage}
            />
          </section>
        </div>
      )}
    </Drawer>
  );
}
