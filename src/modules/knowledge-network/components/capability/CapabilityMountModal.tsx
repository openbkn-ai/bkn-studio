/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ToolOutlined } from "@ant-design/icons";
import { Alert, Checkbox, Input, Modal, Table, Tag, Tree } from "antd";
import type { TableProps, TreeDataNode } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { listMcps, listMcpTools } from "@/modules/execution-factory/services/mcp.service";
import { listSkills } from "@/modules/execution-factory/services/skill.service";
import { listTools } from "@/modules/execution-factory/services/tool.service";
import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { SkillRecord } from "@/modules/execution-factory/types/skill";
import type { ToolRecord } from "@/modules/execution-factory/types/tool";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import type {
  AttachCapabilityInput,
  CapabilityType,
} from "@/modules/knowledge-network/types/knowledge-network";

import {
  filterVisibleContainers,
  type PickerTool,
} from "./capability-picker-filter";
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

/**
 * Both tool sources are a container holding named tools, so the tree works off one shape: a toolset
 * with its tools, or an MCP Server with the tools it exposes. What differs is only how a tool is
 * addressed — by tool_id inside a box, by name inside a Server — which is what `id` carries.
 */
type PickerContainer = { description?: string; id: string; name: string; toolCount?: number };

type CapabilityMountModalProps = {
  capabilityType: CapabilityType;
  /** Skill ids, or "{boxId}/{toolId}" for tools, already bound to this network. */
  mountedRefs: Set<string>;
  onCancel: () => void;
  onSubmit: (inputs: AttachCapabilityInput[]) => Promise<void>;
  open: boolean;
  /** Narrows the toolsets offered to the section being mounted into. */
  toolKind?: "api" | "function";
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
  const isMcp = capabilityType === "mcp_tool";
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [boxes, setBoxes] = useState<PickerContainer[]>([]);
  const [toolsByBox, setToolsByBox] = useState<Record<string, PickerTool[]>>({});
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
        } else if (isMcp) {
          // Only a published Server can be mounted, same rule the backend applies on write.
          const servers = await collectPages((page) =>
            listMcps({ page, pageSize: PICKER_PAGE_SIZE, status: "published" }),
          );
          setBoxes(
            servers.map((server) => ({
              description: server.description,
              id: server.mcpId,
              name: server.name,
            })),
          );
        } else {
          const items = await collectPages((page) =>
            listToolboxes({ page, pageSize: PICKER_PAGE_SIZE }),
          );
          const wanted = toolKind ?? "function";
          setBoxes(
            items
              .filter(
                (box: ToolboxRecord) =>
                  (box.metadataType === "openapi" ? "api" : "function") === wanted,
              )
              .map((box: ToolboxRecord) => ({
                description: box.description,
                id: box.boxId,
                name: box.name,
                toolCount: box.toolCount,
              })),
          );
        }
      } catch (requestError) {
        setError(extractRequestErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    })();
  }, [isMcp, isSkill, open, toolKind]);

  const isToolMounted = useCallback(
    (boxId: string, toolId: string) => mountedRefs.has(`${boxId}/${toolId}`),
    [mountedRefs],
  );

  /**
   * A collapsed box shows nothing of its tools, so without this the only way to learn that some of
   * them are already mounted is to expand every box.
   */
  const mountedCountByBox = useMemo(() => {
    const counts = new Map<string, number>();
    mountedRefs.forEach((ref) => {
      const boxId = ref.split("/")[0] ?? "";
      if (boxId && boxId !== ref) {
        counts.set(boxId, (counts.get(boxId) ?? 0) + 1);
      }
    });

    return counts;
  }, [mountedRefs]);

  /** Tools a whole-box mount would actually add: the ones this network does not hold yet. */
  const mountableToolKeys = useCallback(
    (boxId: string, tools: PickerTool[]) =>
      tools
        .filter((tool) => !isToolMounted(boxId, tool.id))
        .map((tool) => `${TOOL_KEY_PREFIX}${boxId}/${tool.id}`),
    [isToolMounted],
  );

  /**
   * A box with nothing left to add: every tool it lists is mounted, or, before its tools are
   * fetched, the catalogue count is already covered by what this network holds.
   */
  const isBoxFullyMounted = useCallback(
    (box: PickerContainer) => {
      const tools = toolsByBox[box.id];
      if (tools) {
        return tools.length > 0 && tools.every((tool) => isToolMounted(box.id, tool.id));
      }

      const mounted = mountedCountByBox.get(box.id) ?? 0;

      return mounted > 0 && box.toolCount !== undefined && mounted >= box.toolCount;
    },
    [isToolMounted, mountedCountByBox, toolsByBox],
  );

  /**
   * What is already mounted is shown ticked and disabled — "in, and not yours to toggle" — but it
   * never enters the selection: antd hands every ticked key back on each change, so these are
   * stripped before the selection is read, and appended again only when the tree is drawn.
   */
  const lockedKeys = useMemo(
    () =>
      boxes.flatMap((box) => [
        ...(isBoxFullyMounted(box) ? [`${BOX_KEY_PREFIX}${box.id}`] : []),
        ...(toolsByBox[box.id] ?? [])
          .filter((tool) => isToolMounted(box.id, tool.id))
          .map((tool) => `${TOOL_KEY_PREFIX}${box.id}/${tool.id}`),
      ]),
    [boxes, isBoxFullyMounted, isToolMounted, toolsByBox],
  );

  const loadBoxTools = useCallback(
    async (boxId: string) => {
      if (toolsByBox[boxId]) {
        return;
      }

      try {
        const items = isMcp
          ? (await listMcpTools(boxId)).map((tool) => ({
              description: tool.description,
              // An MCP tool is addressed by name; that is what the binding stores.
              id: tool.name,
              name: tool.name,
            }))
          : (
              await collectPages((page: number) =>
                listTools(boxId, { page, pageSize: PICKER_PAGE_SIZE }),
              )
            ).map((tool: ToolRecord) => ({
              description: tool.description,
              id: tool.toolId,
              name: tool.name,
              status: tool.status,
            }));
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
    [isMcp, mountableToolKeys, toolsByBox],
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
      const next = new Set(nextKeys.filter((key) => !lockedKeys.includes(key)));

      boxes.forEach((box) => {
        const boxKey = `${BOX_KEY_PREFIX}${box.id}`;
        const tools = toolsByBox[box.id];
        const childKeys = mountableToolKeys(box.id, tools ?? []);

        if (!previous.has(boxKey) && next.has(boxKey)) {
          childKeys.forEach((key) => next.add(key));
          if (!tools) {
            void loadBoxTools(box.id);
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
    [boxes, checkedKeys, loadBoxTools, lockedKeys, mountableToolKeys, toolsByBox],
  );

  const visibleBoxes = useMemo(
    () => filterVisibleContainers(boxes, toolsByBox, keyword),
    [boxes, keyword, toolsByBox],
  );

  /** The boxes "select all" can still act on: a fully mounted one has nothing to pick. */
  const selectableBoxes = useMemo(
    () => visibleBoxes.filter((box) => !isBoxFullyMounted(box)),
    [isBoxFullyMounted, visibleBoxes],
  );

  /**
   * The tree's own checkboxes only reach one container at a time, so mounting a whole catalogue
   * would be a click each. This ticks every container the search is showing, or clears those —
   * anything picked outside the current search stays as it was.
   */
  const toggleAllBoxes = useCallback(
    (checked: boolean) => {
      const affected = selectableBoxes.flatMap((box) => [
        `${BOX_KEY_PREFIX}${box.id}`,
        ...mountableToolKeys(box.id, toolsByBox[box.id] ?? []),
      ]);

      setCheckedKeys((current) => {
        if (!checked) {
          return current.filter((key) => !affected.includes(key));
        }

        return [...new Set([...current, ...affected])];
      });
    },
    [mountableToolKeys, selectableBoxes, toolsByBox],
  );

  const allBoxesChecked =
    selectableBoxes.length > 0 &&
    selectableBoxes.every((box) => checkedKeys.includes(`${BOX_KEY_PREFIX}${box.id}`));

  const someVisibleChecked = selectableBoxes.some(
    (box) =>
      checkedKeys.includes(`${BOX_KEY_PREFIX}${box.id}`) ||
      checkedKeys.some((key) => key.startsWith(`${TOOL_KEY_PREFIX}${box.id}/`)),
  );

  /**
   * Clicking a row's label toggles its checkbox. Without this only the checkbox itself responds,
   * which reads as "the left half works and the right half does not".
   */
  const toggleKey = useCallback(
    (key: string) => {
      const next = new Set(checkedKeys);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      handleCheck([...next]);
    },
    [checkedKeys, handleCheck],
  );

  /** Boxes with some, but not all, of their tools picked; antd renders these as a dash. */
  const halfCheckedBoxKeys = useMemo(
    () =>
      boxes
        .filter((box) => {
          const boxKey = `${BOX_KEY_PREFIX}${box.id}`;
          if (checkedKeys.includes(boxKey)) {
            return false;
          }

          const childKeys = mountableToolKeys(box.id, toolsByBox[box.id] ?? []);

          return childKeys.some((key) => checkedKeys.includes(key));
        })
        .map((box) => `${BOX_KEY_PREFIX}${box.id}`),
    [boxes, checkedKeys, mountableToolKeys, toolsByBox],
  );

  const treeData: TreeDataNode[] = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();

    return visibleBoxes.reduce<TreeDataNode[]>((nodes, box) => {
        const tools = toolsByBox[box.id];
        const boxMatches = !trimmed || box.name.toLowerCase().includes(trimmed);
        const matchedTools = (tools ?? []).filter(
          (tool) =>
            !trimmed ||
            boxMatches ||
            tool.name.toLowerCase().includes(trimmed) ||
            tool.id.toLowerCase().includes(trimmed),
        );

        if (trimmed && !boxMatches && matchedTools.length === 0) {
          return nodes;
        }

        const mountedCount = mountedCountByBox.get(box.id) ?? 0;

        nodes.push({
          children: tools
            ? matchedTools.map((tool) => {
                const mounted = isToolMounted(box.id, tool.id);

                return {
                  disableCheckbox: mounted,
                  isLeaf: true,
                  key: `${TOOL_KEY_PREFIX}${box.id}/${tool.id}`,
                  title: (
                    <span className={styles.pickerRow}>
                      <span className={styles.toolIcon}>
                        <ToolOutlined />
                      </span>
                      <span className={styles.pickerBody}>
                        <span className={styles.itemTitle}>
                          <span className={styles.itemName}>{tool.name || tool.id}</span>
                          {mounted ? (
                            <Tag>{t("knowledgeNetwork.capabilityPickerMounted")}</Tag>
                          ) : null}
                        </span>
                        {tool.description ? (
                          <span className={styles.itemDescription}>{tool.description}</span>
                        ) : null}
                      </span>
                    </span>
                  ),
                } satisfies TreeDataNode;
              })
            : undefined,
          disableCheckbox: isBoxFullyMounted(box),
          key: `${BOX_KEY_PREFIX}${box.id}`,
          title: (
            <span className={styles.pickerRow}>
              <span className={styles.boxIcon}>
                <ToolOutlined />
              </span>
              <span className={styles.pickerBody}>
                <span className={styles.itemTitle}>
                  <span className={styles.itemName}>{box.name}</span>
                  <span className={styles.pickerHint}>
                    {t("knowledgeNetwork.capabilityPickerBoxToolCount", {
                      count: tools?.length ?? box.toolCount ?? 0,
                    })}
                  </span>
                  {mountedCount > 0 ? (
                    <Tag>
                      {t("knowledgeNetwork.capabilityPickerBoxMounted", { count: mountedCount })}
                    </Tag>
                  ) : null}
                </span>
                {box.description ? (
                  <span className={styles.itemDescription}>{box.description}</span>
                ) : null}
              </span>
            </span>
          ),
      });

      return nodes;
    }, []);
  }, [isBoxFullyMounted, isToolMounted, keyword, mountedCountByBox, t, toolsByBox, visibleBoxes]);

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

    return total + (boxes.find((box) => box.id === boxId)?.toolCount ?? 1);
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
        capabilityType,
      })),
      ...checkedToolRefs.map((ref) => {
        const [boxId, toolId] = ref.split("/");

        return {
          boxId: boxId ?? "",
          capabilityId: toolId ?? "",
          capabilityType,
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
    : isMcp
      ? t("knowledgeNetwork.capabilityPickerMcpTitle")
      : toolKind === "api"
        ? t("knowledgeNetwork.capabilityPickerApiTitle")
        : t("knowledgeNetwork.capabilityPickerFunctionTitle");

  return (
    <Modal
      className={`${modalStyles.businessModal} ${styles.pickerModal}`}
      confirmLoading={submitting}
      footer={
        <div className={styles.pickerFooter}>
          <span className={styles.pickerFooterInfo}>
            {t("knowledgeNetwork.capabilityPickerSelected", { count: selectedCount })}
          </span>
          <AppButton onClick={onCancel}>{t("common.cancel")}</AppButton>
          <AppButton
            disabled={selectedCount === 0}
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
          </AppButton>
        </div>
      }
      onCancel={onCancel}
      open={open}
      title={title}
      width={880}
    >
      <div className={styles.picker}>
        {error ? <Alert message={error} showIcon type="error" /> : null}

        <div className={styles.pickerToolbar}>
          <Input
            allowClear
            className={styles.pickerSearch}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("knowledgeNetwork.capabilityPickerSearchPlaceholder")}
            value={keyword}
          />
          {isSkill ? null : (
            <Checkbox
              checked={allBoxesChecked}
              className={styles.pickerSelectAll}
              disabled={visibleBoxes.length === 0}
              indeterminate={!allBoxesChecked && someVisibleChecked}
              onChange={(event) => toggleAllBoxes(event.target.checked)}
            >
              {t("knowledgeNetwork.capabilityPickerSelectAll")}
            </Checkbox>
          )}
        </div>

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
                  {isMcp
                    ? t("knowledgeNetwork.capabilityPickerEmptyMcpTools")
                    : toolKind === "api"
                      ? t("knowledgeNetwork.capabilityPickerEmptyApis")
                      : t("knowledgeNetwork.capabilityPickerEmptyFunctions")}
                </div>
              ) : (
                <Tree
                  blockNode
                  checkStrictly
                  checkable
                  checkedKeys={{
                    checked: [...checkedKeys, ...lockedKeys],
                    halfChecked: halfCheckedBoxKeys,
                  }}
                  expandedKeys={expandedKeys}
                  loadData={(node) =>
                    loadBoxTools(String(node.key).slice(BOX_KEY_PREFIX.length))
                  }
                  onCheck={(keys) => {
                    const checked = Array.isArray(keys) ? keys : keys.checked;
                    handleCheck(checked.map(String));
                  }}
                  onExpand={(keys) => setExpandedKeys(keys.map(String))}
                  onSelect={(_keys, info) => {
                    if (info.node.disabled || info.node.disableCheckbox) {
                      return;
                    }

                    toggleKey(String(info.node.key));
                  }}
                  selectedKeys={[]}
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
