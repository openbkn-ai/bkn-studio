/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Input, Modal, Table, Tag, Tree } from "antd";
import type { TableProps, TreeDataNode } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { listSkills } from "@/modules/execution-factory/services/skill.service";
import { listTools } from "@/modules/execution-factory/services/tool.service";
import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { SkillRecord } from "@/modules/execution-factory/types/skill";
import type { ToolRecord } from "@/modules/execution-factory/types/tool";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import type { CapabilityToolKind } from "@/modules/knowledge-network/services/capability-tool-kind.service";
import type {
  AttachCapabilityInput,
  CapabilityType,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./CapabilityMountModal.module.css";

/** The execution factory rejects a page_size above 100 (`validate:"min=1,max=100"`). */
const PICKER_PAGE_SIZE = 100;

/** Guards against walking a pathological catalogue; the search box narrows anything beyond it. */
const PICKER_MAX_PAGES = 5;

const BOX_KEY_PREFIX = "box:";
const TOOL_KEY_PREFIX = "tool:";

/**
 * The picker needs one flat list to filter and check against, so it walks the pages itself rather
 * than paginating in the UI: a tool already mounted must still show as mounted wherever it sits.
 */
async function collectPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const first = await fetchPage(1);
  const items = [...first.items];
  const pages = Math.min(Math.ceil(first.total / PICKER_PAGE_SIZE), PICKER_MAX_PAGES);

  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchPage(page);
    items.push(...next.items);
  }

  return items;
}

type CapabilityMountModalProps = {
  capabilityType: CapabilityType;
  /** Skill ids, or "{boxId}/{toolId}" for tools, already bound to this network. */
  mountedRefs: Set<string>;
  onCancel: () => void;
  onSubmit: (inputs: AttachCapabilityInput[]) => Promise<void>;
  open: boolean;
  /** Narrows the tool boxes offered to the section being mounted into. */
  toolKind?: CapabilityToolKind;
};

export function CapabilityMountModal({
  capabilityType,
  mountedRefs,
  onCancel,
  onSubmit,
  open,
  toolKind,
}: CapabilityMountModalProps) {
  const { t } = useTranslation();
  const isSkill = capabilityType === "skill";
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [boxes, setBoxes] = useState<ToolboxRecord[]>([]);
  const [toolsByBox, setToolsByBox] = useState<Record<string, ToolRecord[]>>({});
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setKeyword("");
    setError(null);
    setSelectedSkillIds([]);
    setCheckedKeys([]);
    setExpandedKeys([]);
    setToolsByBox({});

    void (async () => {
      setLoading(true);
      try {
        if (isSkill) {
          // Only a published skill can be mounted; the backend rejects the rest anyway.
          const items = await collectPages((page) =>
            listSkills({ page, pageSize: PICKER_PAGE_SIZE, status: "published" }),
          );
          setSkills(items);
        } else {
          const items = await collectPages((page) =>
            listToolboxes({ page, pageSize: PICKER_PAGE_SIZE }),
          );
          const wanted = toolKind ?? "function";
          setBoxes(
            items.filter(
              (box) => (box.metadataType === "openapi" ? "api" : "function") === wanted,
            ),
          );
        }
      } catch (requestError) {
        setError(extractRequestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    })();
  }, [isSkill, open, toolKind]);

  const isToolMounted = useCallback(
    (boxId: string, toolId: string) => mountedRefs.has(`${boxId}/${toolId}`),
    [mountedRefs],
  );

  /** Tools a whole-box mount would actually add: the ones this network does not hold yet. */
  const mountableToolKeys = useCallback(
    (boxId: string, tools: ToolRecord[]) =>
      tools
        .filter((tool) => !isToolMounted(boxId, tool.toolId))
        .map((tool) => `${TOOL_KEY_PREFIX}${boxId}/${tool.toolId}`),
    [isToolMounted],
  );

  const loadBoxTools = useCallback(
    async (boxId: string) => {
      if (toolsByBox[boxId]) {
        return;
      }

      try {
        const items = await collectPages((page) =>
          listTools(boxId, { page, pageSize: PICKER_PAGE_SIZE }),
        );
        setToolsByBox((current) => ({ ...current, [boxId]: items }));
        // A box checked before its tools arrived still means "all of them": tick them on arrival,
        // otherwise expanding a checked box shows every child unticked.
        setCheckedKeys((current) =>
          current.includes(`${BOX_KEY_PREFIX}${boxId}`)
            ? [...new Set([...current, ...mountableToolKeys(boxId, items)])]
            : current,
        );
      } catch (requestError) {
        setToolsByBox((current) => ({ ...current, [boxId]: [] }));
        setError(extractRequestErrorMessage(requestError));
      }
    },
    [mountableToolKeys, toolsByBox],
  );

  /**
   * The tree is checked strictly so that a box and its tools stay distinguishable — a checked box
   * is sent as one `all_tools` entry, checked tools as one entry each — but it has to behave like an
   * ordinary tree to the person using it: ticking a box selects all of its tools, unticking it
   * clears them, unticking one tool demotes the box to a partial selection, and ticking the last
   * remaining tool promotes it back to the whole box.
   */
  const handleCheck = useCallback(
    (nextKeys: string[]) => {
      const previous = new Set(checkedKeys);
      const next = new Set(nextKeys);

      boxes.forEach((box) => {
        const boxKey = `${BOX_KEY_PREFIX}${box.boxId}`;
        const tools = toolsByBox[box.boxId];
        const childKeys = mountableToolKeys(box.boxId, tools ?? []);

        if (!previous.has(boxKey) && next.has(boxKey)) {
          childKeys.forEach((key) => next.add(key));
          if (!tools) {
            void loadBoxTools(box.boxId);
          }
          return;
        }

        if (previous.has(boxKey) && !next.has(boxKey)) {
          childKeys.forEach((key) => next.delete(key));
          return;
        }

        if (next.has(boxKey) && childKeys.some((key) => previous.has(key) && !next.has(key))) {
          next.delete(boxKey);
          return;
        }

        if (childKeys.length > 0 && childKeys.every((key) => next.has(key))) {
          next.add(boxKey);
        }
      });

      setCheckedKeys([...next]);
    },
    [boxes, checkedKeys, loadBoxTools, mountableToolKeys, toolsByBox],
  );

  /** Boxes with some, but not all, of their tools picked; antd renders these as a dash. */
  const halfCheckedBoxKeys = useMemo(
    () =>
      boxes
        .filter((box) => {
          const boxKey = `${BOX_KEY_PREFIX}${box.boxId}`;
          if (checkedKeys.includes(boxKey)) {
            return false;
          }

          const childKeys = mountableToolKeys(box.boxId, toolsByBox[box.boxId] ?? []);

          return childKeys.some((key) => checkedKeys.includes(key));
        })
        .map((box) => `${BOX_KEY_PREFIX}${box.boxId}`),
    [boxes, checkedKeys, mountableToolKeys, toolsByBox],
  );

  const treeData: TreeDataNode[] = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();

    return boxes.reduce<TreeDataNode[]>((nodes, box) => {
        const tools = toolsByBox[box.boxId];
        const boxMatches = !trimmed || box.name.toLowerCase().includes(trimmed);
        const matchedTools = (tools ?? []).filter(
          (tool) =>
            !trimmed ||
            boxMatches ||
            tool.name.toLowerCase().includes(trimmed) ||
            tool.toolId.toLowerCase().includes(trimmed),
        );

        if (trimmed && !boxMatches && matchedTools.length === 0) {
          return nodes;
        }

        nodes.push({
          children: tools
            ? matchedTools.map((tool) => {
                const mounted = isToolMounted(box.boxId, tool.toolId);

                return {
                  disabled: mounted,
                  isLeaf: true,
                  key: `${TOOL_KEY_PREFIX}${box.boxId}/${tool.toolId}`,
                  title: (
                    <span className={styles.pickerNode}>
                      <span>{tool.name || tool.toolId}</span>
                      {mounted ? (
                        <Tag>{t("knowledgeNetwork.capabilityPickerMounted")}</Tag>
                      ) : null}
                      {tool.description ? (
                        <span className={styles.pickerHint}>{tool.description}</span>
                      ) : null}
                    </span>
                  ),
                } satisfies TreeDataNode;
              })
            : undefined,
          key: `${BOX_KEY_PREFIX}${box.boxId}`,
          title: (
            <span className={styles.pickerNode}>
              <span>{box.name}</span>
              <span className={styles.pickerHint}>
                {t("knowledgeNetwork.capabilityPickerBoxToolCount", {
                  count: tools?.length ?? box.toolCount ?? 0,
                })}
              </span>
            </span>
          ),
      });

      return nodes;
    }, []);
  }, [boxes, isToolMounted, keyword, t, toolsByBox]);

  const checkedBoxIds = checkedKeys
    .filter((key) => key.startsWith(BOX_KEY_PREFIX))
    .map((key) => key.slice(BOX_KEY_PREFIX.length));

  const checkedToolRefs = checkedKeys
    .filter((key) => key.startsWith(TOOL_KEY_PREFIX))
    .map((key) => key.slice(TOOL_KEY_PREFIX.length))
    // A whole-box mount already covers every tool in it; sending both would be redundant.
    .filter((ref) => !checkedBoxIds.includes(ref.split("/")[0] ?? ""));

  // Count tools, not nodes: a checked box stands for the tools it will mount. Boxes whose tools have
  // not been fetched yet fall back to the count the catalogue reported.
  const checkedToolKeyCount = checkedKeys.filter((key) =>
    key.startsWith(TOOL_KEY_PREFIX),
  ).length;
  const unloadedBoxToolCount = checkedBoxIds.reduce((total, boxId) => {
    if (toolsByBox[boxId]) {
      return total;
    }

    return total + (boxes.find((box) => box.boxId === boxId)?.toolCount ?? 1);
  }, 0);
  const selectedCount = isSkill
    ? selectedSkillIds.length
    : checkedToolKeyCount + unloadedBoxToolCount;

  const buildInputs = (): AttachCapabilityInput[] => {
    if (isSkill) {
      return selectedSkillIds.map((skillId) => ({
        capabilityId: skillId,
        capabilityType: "skill" as const,
      }));
    }

    return [
      ...checkedBoxIds.map((boxId) => ({
        allTools: true,
        boxId,
        capabilityType: "function" as const,
      })),
      ...checkedToolRefs.map((ref) => {
        const [boxId, toolId] = ref.split("/");

        return {
          boxId: boxId ?? "",
          capabilityId: toolId ?? "",
          capabilityType: "function" as const,
        };
      }),
    ];
  };

  const skillColumns: TableProps<SkillRecord>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("knowledgeNetwork.capabilityColumnName"),
      render: (value: string, record) => (
        <div>
          <div>{value || record.skillId}</div>
          <div className={styles.pickerHint}>{record.skillId}</div>
        </div>
      ),
    },
    {
      dataIndex: "description",
      key: "description",
      title: t("common.description"),
      render: (value?: string) => value || "-",
    },
    {
      key: "mounted",
      title: "",
      width: 96,
      render: (_: unknown, record) =>
        mountedRefs.has(record.skillId) ? (
          <Tag>{t("knowledgeNetwork.capabilityPickerMounted")}</Tag>
        ) : null,
    },
  ];

  const title = isSkill
    ? t("knowledgeNetwork.capabilityPickerSkillTitle")
    : toolKind === "api"
      ? t("knowledgeNetwork.capabilityPickerApiTitle")
      : t("knowledgeNetwork.capabilityPickerFunctionTitle");

  return (
    <Modal
      className={`${modalStyles.businessModal} ${styles.pickerModal}`}
      confirmLoading={submitting}
      footer={[
        <span className={styles.pickerFooterInfo} key="info">
          {t("knowledgeNetwork.capabilityPickerSelected", { count: selectedCount })}
        </span>,
        <AppButton key="cancel" onClick={onCancel}>
          {t("common.cancel")}
        </AppButton>,
        <AppButton
          disabled={selectedCount === 0}
          key="confirm"
          loading={submitting}
          onClick={() => {
            void (async () => {
              setSubmitting(true);
              setError(null);
              try {
                await onSubmit(buildInputs());
              } catch (requestError) {
                setError(extractRequestErrorMessage(requestError));
              } finally {
                setSubmitting(false);
              }
            })();
          }}
          type="primary"
        >
          {t("knowledgeNetwork.capabilityPickerConfirm")}
        </AppButton>,
      ]}
      onCancel={onCancel}
      open={open}
      title={title}
      width={880}
    >
      <div className={styles.picker}>
        {error ? <Alert message={error} showIcon type="error" /> : null}

        <Input
          allowClear
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t("knowledgeNetwork.capabilityPickerSearchPlaceholder")}
          value={keyword}
        />

        {isSkill ? (
          <Table
            columns={skillColumns}
            dataSource={skills.filter((item) => {
              const trimmed = keyword.trim().toLowerCase();

              return (
                !trimmed ||
                item.name.toLowerCase().includes(trimmed) ||
                item.skillId.toLowerCase().includes(trimmed)
              );
            })}
            loading={loading}
            locale={{ emptyText: t("knowledgeNetwork.capabilityPickerEmptySkills") }}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            rowKey="skillId"
            rowSelection={{
              getCheckboxProps: (record) => ({ disabled: mountedRefs.has(record.skillId) }),
              onChange: (keys) => setSelectedSkillIds(keys as string[]),
              selectedRowKeys: selectedSkillIds,
            }}
            size="small"
          />
        ) : (
          <>
            <div className={styles.pickerHint}>
              {t("knowledgeNetwork.capabilityPickerWholeBoxHint")}
            </div>
            <div className={styles.pickerTree}>
              {treeData.length === 0 && !loading ? (
                <div className={styles.pickerEmpty}>
                  {toolKind === "api"
                    ? t("knowledgeNetwork.capabilityPickerEmptyApis")
                    : t("knowledgeNetwork.capabilityPickerEmptyFunctions")}
                </div>
              ) : (
                <Tree
                  blockNode
                  checkStrictly
                  checkable
                  checkedKeys={{ checked: checkedKeys, halfChecked: halfCheckedBoxKeys }}
                  expandedKeys={expandedKeys}
                  loadData={(node) =>
                    loadBoxTools(String(node.key).slice(BOX_KEY_PREFIX.length))
                  }
                  onCheck={(keys) => {
                    const checked = Array.isArray(keys) ? keys : keys.checked;
                    handleCheck(checked.map(String));
                  }}
                  onExpand={(keys) => setExpandedKeys(keys.map(String))}
                  treeData={treeData}
                />
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
