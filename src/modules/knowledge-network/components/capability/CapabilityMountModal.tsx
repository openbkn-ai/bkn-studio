/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Input, Modal, Table, Tag, Tree } from "antd";
import type { TableProps, TreeDataNode } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  extractRequestErrorDetails,
  type RequestErrorDetails,
} from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { RequestErrorAlert } from "@/framework/ui/common/RequestErrorAlert";
import { listMcps, listMcpTools } from "@/modules/execution-factory/services/mcp.service";
import { listSkills } from "@/modules/execution-factory/services/skill.service";
import { getToolbox, listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { SkillRecord } from "@/modules/execution-factory/types/skill";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import type {
  AttachCapabilityInput,
  CapabilityType,
} from "@/modules/knowledge-network/types/knowledge-network";

import {
  containerBlockReason,
  filterVisibleContainers,
  type PickerBlockReason,
  type PickerContainer,
  type PickerTool,
  toolBlockReason,
} from "./capability-picker-filter";
import styles from "./CapabilityMountModal.module.css";

/** The execution factory rejects a page_size above 100 (`validate:"min=1,max=100"`). */
const PICKER_PAGE_SIZE = 100;

/** Guards against walking a pathological catalogue; the search box narrows anything beyond it. */
const PICKER_MAX_PAGES = 5;

/** How many containers select-all reads at once when it ticks ones whose tools are not loaded. */
const PICKER_LOAD_CONCURRENCY = 4;

const BOX_KEY_PREFIX = "box:";
const TOOL_KEY_PREFIX = "tool:";

/**
 * Rejections meaning a picked target is no longer in the state the picker showed — gone,
 * unpublished, disabled, or left with nothing to mount. The picker re-reads what was picked before
 * answering, so the answer can name what changed rather than repeat a generic refusal.
 */
const TARGET_STATE_ERROR_CODES = new Set([
  "BknBackend.CapabilityBinding.EmptyToolBox",
  "BknBackend.CapabilityBinding.TargetNotAvailable",
  "BknBackend.CapabilityBinding.TargetNotFound",
]);

/** A load that failed leaves nothing to judge by; it is kept apart from "has no tools". */
type PickerReason = PickerBlockReason | "loadFailed";

const REASON_LABEL_KEYS: Record<PickerReason, string> = {
  boxUnpublished: "knowledgeNetwork.capabilityPickerReasonBoxUnpublished",
  loadFailed: "knowledgeNetwork.capabilityPickerReasonLoadFailed",
  mounted: "knowledgeNetwork.capabilityPickerMounted",
  noEnabledTools: "knowledgeNetwork.capabilityPickerReasonNoEnabledTools",
  noTools: "knowledgeNetwork.capabilityPickerReasonNoTools",
  notFound: "knowledgeNetwork.capabilityPickerReasonNotFound",
  toolDisabled: "knowledgeNetwork.capabilityPickerReasonToolDisabled",
};

type LoadedContainer = { status?: string; tools: PickerTool[] };

type DeselectedItem = { key: string; label: string; reason: PickerReason };

/** Box ids carry no "/", tool names may; split on the first one only. */
function splitToolRef(ref: string): [string, string] {
  const slash = ref.indexOf("/");

  return slash < 0 ? [ref, ""] : [ref.slice(0, slash), ref.slice(slash + 1)];
}

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
  const [error, setError] = useState<RequestErrorDetails | null>(null);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [boxes, setBoxes] = useState<PickerContainer[]>([]);
  const [toolsByBox, setToolsByBox] = useState<Record<string, PickerTool[]>>({});
  const [failedBoxIds, setFailedBoxIds] = useState<string[]>([]);
  const [deselected, setDeselected] = useState<DeselectedItem[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  /** Reads in flight, so a second caller waits on the same read instead of starting another. */
  const loadingBoxes = useRef(new Map<string, Promise<void>>());

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
    setFailedBoxIds([]);
    setDeselected([]);

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
          setBoxes(servers.map((server) => ({ id: server.mcpId, name: server.name })));
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
                id: box.boxId,
                name: box.name,
                status: box.status,
                toolCount: box.toolCount,
              })),
          );
        }
      } catch (requestError) {
        setError(extractRequestErrorDetails(requestError));
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
   * Tools a whole-box mount would actually add: enabled ones in a published box that this network
   * does not hold yet. The backend's own expansion skips the rest, so ticking them would promise
   * something the write never delivers.
   */
  const mountableToolKeys = useCallback(
    (container: Pick<PickerContainer, "id" | "status">, tools: PickerTool[]) =>
      tools
        .filter(
          (tool) =>
            !isToolMounted(container.id, tool.id) && toolBlockReason(container, tool) === null,
        )
        .map((tool) => `${TOOL_KEY_PREFIX}${container.id}/${tool.id}`),
    [isToolMounted],
  );

  /**
   * Why a container cannot be ticked as a whole, or null when it can. A failed read is not one of
   * these: it says nothing about the container, so the row stays tickable and ticking it reads again.
   */
  const containerReason = useCallback(
    (container: PickerContainer): PickerBlockReason | null => {
      const tools = toolsByBox[container.id];
      const blocked = containerBlockReason(container, tools);
      if (blocked) {
        return blocked;
      }

      // Everything it could add is already here; ticking it would mount nothing.
      return tools && mountableToolKeys(container, tools).length === 0 ? "mounted" : null;
    },
    [mountableToolKeys, toolsByBox],
  );

  const reasonLabel = useCallback(
    (reason: PickerReason) => t(REASON_LABEL_KEYS[reason]),
    [t],
  );

  const fetchContainer = useCallback(
    async (containerId: string): Promise<LoadedContainer> => {
      if (isMcp) {
        const tools = await listMcpTools(containerId);

        return {
          tools: tools.map((tool) => ({
            description: tool.description,
            // An MCP tool is addressed by name; that is what the binding stores.
            id: tool.name,
            name: tool.name,
          })),
        };
      }

      // The toolset detail is the read the backend validates a mount against, so the state the
      // picker shows — toolset published, each tool enabled — is the state the write will find.
      const box = await getToolbox(containerId, { skipErrorToast: true });

      return {
        status: box.status,
        tools: (box.tools ?? []).map((tool) => ({
          description: tool.description,
          id: tool.toolId,
          name: tool.name,
          status: tool.status,
        })),
      };
    },
    [isMcp],
  );

  const applyContainer = useCallback((containerId: string, loaded: LoadedContainer) => {
    setToolsByBox((current) => ({ ...current, [containerId]: loaded.tools }));
    setBoxes((current) =>
      current.map((box) =>
        box.id === containerId
          ? { ...box, status: loaded.status ?? box.status, toolCount: loaded.tools.length }
          : box,
      ),
    );
    setFailedBoxIds((current) => current.filter((id) => id !== containerId));
    // A read that now succeeded retracts the "failed to load" it left in the notice.
    setDeselected((current) =>
      current.filter((item) => !(item.key === containerId && item.reason === "loadFailed")),
    );
  }, []);

  /**
   * Reads a container's tools once; a caller arriving while the read is in flight gets that read.
   * The tree depends on this: it re-asks for an expanded, unloaded node on every render until the
   * returned promise settles, so answering "already loading" with an immediate resolve would spin.
   *
   * A failed read leaves the container unread rather than empty, so it can be read again: ticking
   * the row or expanding it retries. The node is collapsed on failure for the same reason as above —
   * an expanded node the tree does not consider loaded would be retried on every render.
   */
  const loadBoxTools = useCallback(
    (boxId: string): Promise<void> => {
      const inFlight = loadingBoxes.current.get(boxId);
      if (inFlight) {
        return inFlight;
      }

      if (toolsByBox[boxId]) {
        return Promise.resolve();
      }

      setFailedBoxIds((current) => current.filter((id) => id !== boxId));
      const read = (async () => {
        try {
          const loaded = await fetchContainer(boxId);
          applyContainer(boxId, loaded);
          // A box checked before its tools arrived still means "all of them": tick them on
          // arrival, otherwise expanding a checked box shows every child unticked. A box that
          // turns out to hold nothing mountable is unticked by the reconciliation below, which
          // also says why.
          const childKeys = mountableToolKeys({ id: boxId, status: loaded.status }, loaded.tools);
          setCheckedKeys((current) =>
            current.includes(`${BOX_KEY_PREFIX}${boxId}`)
              ? [...new Set([...current, ...childKeys])]
              : current,
          );
        } catch (requestError) {
          setFailedBoxIds((current) => [...new Set([...current, boxId])]);
          setExpandedKeys((current) => current.filter((key) => key !== `${BOX_KEY_PREFIX}${boxId}`));
          setError(extractRequestErrorDetails(requestError));
        } finally {
          loadingBoxes.current.delete(boxId);
        }
      })();
      loadingBoxes.current.set(boxId, read);

      return read;
    },
    [applyContainer, fetchContainer, mountableToolKeys, toolsByBox],
  );

  /** Select-all can tick a whole catalogue; read the unloaded ones a few at a time. */
  const loadManyBoxTools = useCallback(
    async (boxIds: string[]) => {
      let next = 0;
      const worker = async () => {
        while (next < boxIds.length) {
          const boxId = boxIds[next];
          next += 1;
          if (boxId) {
            await loadBoxTools(boxId);
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(PICKER_LOAD_CONCURRENCY, boxIds.length) }, worker),
      );
    },
    [loadBoxTools],
  );

  /** Re-reads containers even when loaded: used after a rejection, to learn what changed. */
  const refreshContainers = useCallback(
    async (containerIds: string[]) => {
      await Promise.all(
        containerIds.map(async (containerId) => {
          try {
            applyContainer(containerId, await fetchContainer(containerId));
          } catch {
            // The rejection itself is already on screen; a failed re-read adds nothing to it.
          }
        }),
      );
    },
    [applyContainer, fetchContainer],
  );

  /**
   * Everything ticked must still be mountable given what the picker now knows. That knowledge
   * changes after a tick in two ways — a box's tools arrive after the box was ticked, or a rejected
   * mount made the picker re-read what was picked — and either can leave a tick on something the
   * write would refuse. Those ticks are dropped here and listed with the reason, so the selection
   * never shrinks without saying why.
   */
  useEffect(() => {
    const dropped = new Map<string, DeselectedItem>();
    const kept = checkedKeys.filter((key) => {
      const isBoxKey = key.startsWith(BOX_KEY_PREFIX);
      const [boxId, toolId] = isBoxKey
        ? [key.slice(BOX_KEY_PREFIX.length), ""]
        : splitToolRef(key.slice(TOOL_KEY_PREFIX.length));
      const box = boxes.find((item) => item.id === boxId);
      if (!box) {
        return true;
      }

      // A ticked box whose read failed would hold submit forever; drop it and say so. Ticking it
      // again reads it again.
      if (isBoxKey && failedBoxIds.includes(boxId)) {
        dropped.set(boxId, { key: boxId, label: box.name, reason: "loadFailed" });
        return false;
      }

      // A tool under a box that cannot be used at all is reported once, as that box.
      const boxReason = containerReason(box);
      if (isBoxKey || (boxReason && boxReason !== "mounted")) {
        if (!boxReason) {
          return true;
        }

        dropped.set(boxId, { key: boxId, label: box.name, reason: boxReason });
        return false;
      }

      const tools = toolsByBox[boxId];
      if (!tools) {
        return true;
      }

      const tool = tools.find((item) => item.id === toolId);
      const reason: PickerReason | null = !tool
        ? "notFound"
        : isToolMounted(boxId, toolId)
          ? "mounted"
          : toolBlockReason(box, tool);
      if (!reason) {
        return true;
      }

      dropped.set(`${boxId}/${toolId}`, {
        key: `${boxId}/${toolId}`,
        label: `${box.name} / ${tool?.name || toolId}`,
        reason,
      });
      return false;
    });

    if (dropped.size === 0) {
      return;
    }

    setCheckedKeys(kept);
    setDeselected((current) => [
      ...current.filter((item) => !dropped.has(item.key)),
      ...dropped.values(),
    ]);
  }, [boxes, checkedKeys, containerReason, failedBoxIds, isToolMounted, toolsByBox]);

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
        const boxKey = `${BOX_KEY_PREFIX}${box.id}`;
        const tools = toolsByBox[box.id];
        const childKeys = mountableToolKeys(box, tools ?? []);

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
    [boxes, checkedKeys, loadBoxTools, mountableToolKeys, toolsByBox],
  );

  const visibleBoxes = useMemo(
    () => filterVisibleContainers(boxes, toolsByBox, keyword),
    [boxes, keyword, toolsByBox],
  );

  /** Visible containers that can be ticked as a whole; select-all reaches only these. */
  const tickableBoxes = useMemo(
    () => visibleBoxes.filter((box) => containerReason(box) === null),
    [containerReason, visibleBoxes],
  );

  /**
   * The tree's own checkboxes only reach one container at a time, so mounting a whole catalogue
   * would be a click each. This ticks every container the search is showing, or clears those —
   * anything picked outside the current search stays as it was. Containers whose tools are not
   * loaded yet are read now, so any that turn out to hold nothing mountable drop out before submit.
   */
  const toggleAllBoxes = useCallback(
    (checked: boolean) => {
      const targets = checked ? tickableBoxes : visibleBoxes;
      const affected = targets.flatMap((box) => [
        `${BOX_KEY_PREFIX}${box.id}`,
        ...mountableToolKeys(box, toolsByBox[box.id] ?? []),
      ]);

      setCheckedKeys((current) => {
        if (!checked) {
          return current.filter((key) => !affected.includes(key));
        }

        return [...new Set([...current, ...affected])];
      });

      if (checked) {
        const unread = tickableBoxes.filter((box) => !toolsByBox[box.id]).map((box) => box.id);
        // Reads beyond the first few start later; clear earlier failures now, or the reconciliation
        // would untick those boxes as failed before their retry even began.
        setFailedBoxIds((current) => current.filter((id) => !unread.includes(id)));
        void loadManyBoxTools(unread);
      }
    },
    [loadManyBoxTools, mountableToolKeys, tickableBoxes, toolsByBox, visibleBoxes],
  );

  const allBoxesChecked =
    tickableBoxes.length > 0 &&
    tickableBoxes.every((box) => checkedKeys.includes(`${BOX_KEY_PREFIX}${box.id}`));

  const someVisibleChecked = visibleBoxes.some(
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

          const childKeys = mountableToolKeys(box, toolsByBox[box.id] ?? []);

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

        const boxReason = containerReason(box);
        // Count what the person can act on, not only what exists: a toolset of three whose tools
        // are all disabled mounts nothing, and "3 tools" alone would not say so. An MCP Server's
        // tools carry no status and its listing no count, so it shows a count once one is known.
        const countLabel = tools
          ? tools.some((tool) => tool.status !== undefined)
            ? t("knowledgeNetwork.capabilityPickerBoxToolCountEnabled", {
                count: tools.length,
                enabled: tools.filter((tool) => tool.status === "enabled").length,
              })
            : t("knowledgeNetwork.capabilityPickerBoxToolCount", { count: tools.length })
          : box.toolCount === undefined
            ? null
            : t("knowledgeNetwork.capabilityPickerBoxToolCount", { count: box.toolCount });

        nodes.push({
          children: tools
            ? matchedTools.map((tool) => {
                const mounted = isToolMounted(box.id, tool.id);
                const blocked = toolBlockReason(box, tool);

                return {
                  disabled: mounted || blocked !== null,
                  isLeaf: true,
                  key: `${TOOL_KEY_PREFIX}${box.id}/${tool.id}`,
                  title: (
                    <span className={styles.pickerNode}>
                      <span>{tool.name || tool.id}</span>
                      {mounted ? (
                        <Tag>{t("knowledgeNetwork.capabilityPickerMounted")}</Tag>
                      ) : blocked === "toolDisabled" ? (
                        // An unpublished box already says so on its own row; repeating it on every
                        // tool beneath would bury the one tag that differs.
                        <Tag color="warning">{reasonLabel(blocked)}</Tag>
                      ) : null}
                      {tool.description ? (
                        <span className={styles.pickerHint}>{tool.description}</span>
                      ) : null}
                    </span>
                  ),
                } satisfies TreeDataNode;
              })
            : undefined,
          // Only the checkbox: the row can still be expanded to show which tools are unavailable.
          disableCheckbox: boxReason !== null,
          key: `${BOX_KEY_PREFIX}${box.id}`,
          title: (
            <span className={styles.pickerNode}>
              <span>{box.name}</span>
              {boxReason ? (
                <Tag color={boxReason === "mounted" ? undefined : "warning"}>
                  {reasonLabel(boxReason)}
                </Tag>
              ) : failedBoxIds.includes(box.id) ? (
                <Tag color="warning">{reasonLabel("loadFailed")}</Tag>
              ) : null}
              {countLabel ? <span className={styles.pickerHint}>{countLabel}</span> : null}
            </span>
          ),
      });

      return nodes;
    }, []);
  }, [
    containerReason,
    failedBoxIds,
    isToolMounted,
    keyword,
    reasonLabel,
    t,
    toolsByBox,
    visibleBoxes,
  ]);

  // Only a successful read counts as loaded, so a node whose read failed is read again on expand.
  const loadedBoxKeys = useMemo(
    () => Object.keys(toolsByBox).map((boxId) => `${BOX_KEY_PREFIX}${boxId}`),
    [toolsByBox],
  );

  const checkedBoxIds = checkedKeys
    .filter((key) => key.startsWith(BOX_KEY_PREFIX))
    .map((key) => key.slice(BOX_KEY_PREFIX.length));

  const checkedToolRefs = checkedKeys
    .filter((key) => key.startsWith(TOOL_KEY_PREFIX))
    .map((key) => key.slice(TOOL_KEY_PREFIX.length))
    // A whole-box mount already covers every tool in it; sending both would be redundant.
    .filter((ref) => !checkedBoxIds.includes(splitToolRef(ref)[0]));

  // A ticked box is sent as "all of its tools", which the backend refuses outright when none can be
  // mounted. Until its tools are read that cannot be ruled out, so submit waits for the read.
  const checkingBoxes = !isSkill && checkedBoxIds.some((boxId) => !toolsByBox[boxId]);

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
        const [boxId, toolId] = splitToolRef(ref);

        return {
          boxId,
          capabilityId: toolId,
          capabilityType,
        };
      }),
    ];
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setDeselected([]);
    const inputs = buildInputs();
    try {
      await onSubmit(inputs);
    } catch (requestError) {
      const details = extractRequestErrorDetails(requestError);
      setError(details);
      // Something picked changed after the picker read it. Re-read what was picked: the
      // reconciliation then unticks whatever is no longer mountable and names it with the reason.
      if (!isSkill && details.code && TARGET_STATE_ERROR_CODES.has(details.code)) {
        await refreshContainers([
          ...new Set(inputs.map((input) => input.boxId ?? "").filter(Boolean)),
        ]);
      }
    } finally {
      setSubmitting(false);
    }
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
      footer={[
        <span className={styles.pickerFooterInfo} key="info">
          {t("knowledgeNetwork.capabilityPickerSelected", { count: selectedCount })}
        </span>,
        <AppButton key="cancel" onClick={onCancel}>
          {t("common.cancel")}
        </AppButton>,
        <AppButton
          disabled={selectedCount === 0 || checkingBoxes}
          key="confirm"
          loading={submitting || checkingBoxes}
          onClick={() => {
            void submit();
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
        {error ? (
          <RequestErrorAlert
            autoDismissMs={0}
            error={error}
            onDismiss={() => setError(null)}
          />
        ) : null}

        {deselected.length > 0 ? (
          <Alert
            closable
            description={
              <ul className={styles.pickerDeselectedList}>
                {deselected.map((item) => (
                  <li key={item.key}>
                    {t("knowledgeNetwork.capabilityPickerDeselectedItem", {
                      name: item.label,
                      reason: reasonLabel(item.reason),
                    })}
                  </li>
                ))}
              </ul>
            }
            message={t("knowledgeNetwork.capabilityPickerDeselected")}
            onClose={() => setDeselected([])}
            showIcon
            type="warning"
          />
        ) : null}

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
              disabled={tickableBoxes.length === 0}
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
              {isMcp
                ? t("knowledgeNetwork.capabilityPickerWholeServerHint")
                : t("knowledgeNetwork.capabilityPickerWholeBoxHint")}
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
                  checkedKeys={{ checked: checkedKeys, halfChecked: halfCheckedBoxKeys }}
                  expandedKeys={expandedKeys}
                  loadData={(node) =>
                    loadBoxTools(String(node.key).slice(BOX_KEY_PREFIX.length))
                  }
                  loadedKeys={loadedBoxKeys}
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
