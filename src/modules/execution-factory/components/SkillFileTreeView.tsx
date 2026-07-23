/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { FileOutlined, FolderOpenOutlined, FolderOutlined } from "@ant-design/icons";
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

function toTreeDataNodes(
  nodes: SkillFileTreeNode[],
  options: { showFileMeta: boolean },
): DataNode[] {
  return nodes.map((node) => {
    if (node.isLeaf) {
      const meta = options.showFileMeta
        ? [node.file?.mimeType, formatSkillFileSize(node.file?.size)].filter(Boolean).join(" · ")
        : "";

      return {
        key: node.key,
        isLeaf: true,
        selectable: true,
        icon: <FileOutlined />,
        title: (
          <span className={styles.leaf}>
            <span className={styles.title}>{node.title}</span>
            {meta ? <span className={styles.meta}>{meta}</span> : null}
          </span>
        ),
      };
    }

    return {
      key: node.key,
      isLeaf: false,
      selectable: false,
      icon: ({ expanded }: { expanded?: boolean }) =>
        expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
      title: <span className={styles.title}>{node.title}</span>,
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
      showIcon
      style={style}
      treeData={treeData}
    />
  );
}
