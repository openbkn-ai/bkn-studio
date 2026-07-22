/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type SkillFileTreeLeaf = {
  relPath: string;
  mimeType?: string;
  size?: number;
  fileType?: string;
};

export type SkillFileTreeNode = {
  key: string;
  title: string;
  isLeaf: boolean;
  children?: SkillFileTreeNode[];
  file?: SkillFileTreeLeaf;
};

type MutableNode = {
  key: string;
  title: string;
  isLeaf: boolean;
  children?: Map<string, MutableNode>;
  file?: SkillFileTreeLeaf;
};

function compareNodes(a: SkillFileTreeNode, b: SkillFileTreeNode): number {
  if (a.isLeaf !== b.isLeaf) {
    return a.isLeaf ? 1 : -1;
  }

  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

function freezeNode(node: MutableNode): SkillFileTreeNode {
  if (node.isLeaf) {
    return {
      key: node.key,
      title: node.title,
      isLeaf: true,
      file: node.file,
    };
  }

  const children = [...(node.children?.values() ?? [])].map(freezeNode).sort(compareNodes);
  return {
    key: node.key,
    title: node.title,
    isLeaf: false,
    children,
  };
}

/**
 * Build a directory tree from skill package file summaries.
 * Directory keys use a trailing slash (e.g. `bin/`) so they never collide with a file named `bin`.
 */
export function buildSkillFileTree(files: SkillFileTreeLeaf[]): SkillFileTreeNode[] {
  const root = new Map<string, MutableNode>();

  for (const file of files) {
    const relPath = file.relPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
    if (!relPath) {
      continue;
    }

    const segments = relPath.split("/").filter(Boolean);
    if (segments.length === 0) {
      continue;
    }

    let current = root;
    let prefix = "";

    for (const [index, segment] of segments.entries()) {
      const isLeaf = index === segments.length - 1;
      prefix = prefix ? `${prefix}/${segment}` : segment;
      const key = isLeaf ? prefix : `${prefix}/`;

      let node = current.get(segment);
      if (!node) {
        node = {
          key,
          title: segment,
          isLeaf,
          children: isLeaf ? undefined : new Map(),
        };
        current.set(segment, node);
      }

      if (isLeaf) {
        node.isLeaf = true;
        node.file = {
          relPath: prefix,
          mimeType: file.mimeType,
          size: file.size,
          fileType: file.fileType,
        };
        node.children = undefined;
        break;
      }

      if (!node.children) {
        node.children = new Map();
      }
      node.isLeaf = false;
      current = node.children;
    }
  }

  return [...root.values()].map(freezeNode).sort(compareNodes);
}

export function collectSkillFileTreeKeys(nodes: SkillFileTreeNode[]): string[] {
  const keys: string[] = [];

  const walk = (items: SkillFileTreeNode[]) => {
    for (const item of items) {
      if (!item.isLeaf) {
        keys.push(item.key);
        if (item.children?.length) {
          walk(item.children);
        }
      }
    }
  };

  walk(nodes);
  return keys;
}
