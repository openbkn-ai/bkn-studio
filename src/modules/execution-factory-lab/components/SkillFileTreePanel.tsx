/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { FileOutlined, FolderOpenOutlined, FolderOutlined } from "@ant-design/icons";
import { Alert, Spin, Tree } from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useState, type Key } from "react";
import { useTranslation } from "react-i18next";

import {
  getSkillContent,
  readSkillFile,
} from "@/modules/execution-factory-lab/services/capabilities-lab.service";
import type { SkillFileSummary } from "@/modules/execution-factory-lab/types/capability";
import {
  buildSkillFileTree,
  collectSkillFileTreeKeys,
  type SkillFileTreeNode,
} from "@/modules/execution-factory/utils/skill-file-tree";

type SkillFileTreePanelProps = {
  capabilityId: string;
};

function toTreeDataNodes(nodes: SkillFileTreeNode[]): DataNode[] {
  return nodes.map((node) => {
    if (node.isLeaf) {
      return {
        key: node.key,
        isLeaf: true,
        selectable: true,
        icon: <FileOutlined />,
        title: node.title,
      };
    }

    return {
      key: node.key,
      isLeaf: false,
      selectable: false,
      icon: ({ expanded }: { expanded?: boolean }) =>
        expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
      title: node.title,
      children: toTreeDataNodes(node.children ?? []),
    };
  });
}

export function SkillFileTreePanel({ capabilityId }: SkillFileTreePanelProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<SkillFileSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);

  const fileTree = useMemo(() => buildSkillFileTree(files), [files]);
  const treeData = useMemo(() => toTreeDataNodes(fileTree), [fileTree]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void getSkillContent(capabilityId)
      .then((content) => {
        setFiles(content.files);
        if (content.files.length > 0) {
          setSelectedPath(
            content.files.find((item) => item.relPath === "SKILL.md")?.relPath ??
              content.files[0]?.relPath ??
              null,
          );
        } else if (content.content) {
          setPreview(content.content);
        }
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => setLoading(false));
  }, [capabilityId]);

  useEffect(() => {
    setExpandedKeys(collectSkillFileTreeKeys(fileTree));
  }, [fileTree]);

  useEffect(() => {
    if (!selectedPath) {
      return;
    }

    void readSkillFile(capabilityId, selectedPath)
      .then((file) => setPreview(file.content ?? ""))
      .catch((readError) => {
        setPreview(readError instanceof Error ? readError.message : String(readError));
      });
  }, [capabilityId, selectedPath]);

  if (loading) {
    return <Spin />;
  }

  if (error) {
    return <Alert message={error} showIcon type="error" />;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
      {files.length > 0 ? (
        <Tree
          blockNode
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys)}
          onSelect={(selectedKeys) => {
            const key = selectedKeys[0];
            if (typeof key === "string" && files.some((item) => item.relPath === key)) {
              setSelectedPath(key);
            }
          }}
          selectedKeys={selectedPath ? [selectedPath] : []}
          showIcon
          style={{
            background: "#fff",
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            padding: 8,
          }}
          treeData={treeData}
        />
      ) : (
        <Alert message={t("executionFactoryLab.skillFilesEmpty")} showIcon type="info" />
      )}
      <pre
        style={{
          background: "#fafafa",
          border: "1px solid #f0f0f0",
          borderRadius: 8,
          minHeight: 240,
          padding: 12,
          whiteSpace: "pre-wrap",
        }}
      >
        {preview || t("executionFactoryLab.skillFilePreviewEmpty")}
      </pre>
    </div>
  );
}
