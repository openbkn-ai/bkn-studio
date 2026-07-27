/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { FileOutlined, FolderOutlined } from "@ant-design/icons";
import { Tree } from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useState, type CSSProperties, type Key, type ReactNode } from "react";

import { formatSkillFileSize } from "@/modules/execution-factory/utils/skill-file-preview";
import {
  buildSkillFileTree,
  getDefaultSkillFileTreeExpandedKeys,
  type SkillFileTreeLeaf,
  type SkillFileTreeNode,
} from "@/modules/execution-factory/utils/skill-file-tree";

import styles from "./skill-file-tree-view.module.css";

export type SkillFileTreeViewProps = {
  files: SkillFileTreeLeaf[];
  selectedPath?: string | null;
  onSelectFile: (relPath: string) => void;
  showFileMeta?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** 文件名右侧的定宽徽标：大写扩展名。无扩展名（LICENSE、Dockerfile）就不画。 */
function resolveFileBadge(relPath?: string): string {
  if (!relPath?.includes(".")) {
    return "";
  }

  const extension = relPath.slice(relPath.lastIndexOf(".") + 1);
  return extension.length > 0 && extension.length <= 5 ? extension.toUpperCase() : "";
}

function toTreeDataNodes(
  nodes: SkillFileTreeNode[],
  options: { showFileMeta: boolean },
): DataNode[] {
  return nodes.map((node) => {
    if (node.isLeaf) {
      const meta = options.showFileMeta
        ? [node.file?.mimeType, formatSkillFileSize(node.file?.size)].filter(Boolean).join(" · ")
        : "";
      const badge = resolveFileBadge(node.file?.relPath ?? node.title);

      // 文件行画成卡片：与工具 / 函数列表栏同一套观感（名字 + 右侧徽标 + 次行元信息）。
      // 目录行保持轻量的一行，层级才不会被一摞卡片盖过去。
      return {
        key: node.key,
        isLeaf: true,
        selectable: true,
        title: (
          <span className={styles.card}>
            <span className={styles.cardTop}>
              <FileOutlined className={styles.fileIcon} />
              <span className={styles.title} title={node.file?.relPath ?? node.title}>
                {node.title}
              </span>
              {badge ? <span className={styles.badge}>{badge}</span> : null}
            </span>
            {meta ? <span className={styles.meta}>{meta}</span> : null}
          </span>
        ),
      };
    }

    return {
      key: node.key,
      isLeaf: false,
      selectable: false,
      title: (
        <span className={styles.folder}>
          <FolderOutlined className={styles.folderIcon} />
          <span className={styles.folderName} title={node.key}>
            {node.title}
          </span>
        </span>
      ),
      children: toTreeDataNodes(node.children ?? [], options),
    };
  });
}

export function SkillFileTreeView({
  files,
  selectedPath,
  onSelectFile,
  showFileMeta = false,
  className,
  style,
}: SkillFileTreeViewProps): ReactNode {
  const fileTree = useMemo(() => buildSkillFileTree(files), [files]);
  const treeData = useMemo(
    () => toTreeDataNodes(fileTree, { showFileMeta }),
    [fileTree, showFileMeta],
  );
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);

  useEffect(() => {
    setExpandedKeys(getDefaultSkillFileTreeExpandedKeys(fileTree, files.length));
  }, [fileTree, files.length]);

  return (
    <Tree
      blockNode
      className={[styles.tree, className].filter(Boolean).join(" ")}
      expandedKeys={expandedKeys}
      onExpand={(keys) => setExpandedKeys(keys)}
      onSelect={(selectedKeys) => {
        const key = selectedKeys[0];
        if (typeof key === "string" && files.some((item) => item.relPath === key)) {
          onSelectFile(key);
        }
      }}
      selectedKeys={selectedPath ? [selectedPath] : []}
      style={style}
      treeData={treeData}
    />
  );
}
