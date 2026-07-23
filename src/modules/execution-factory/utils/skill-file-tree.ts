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

export type BuildSkillFileTreeResult = {
  nodes: SkillFileTreeNode[];
  conflicts: string[];
};

type MutableNode = {
  key: string;
  title: string;
  isLeaf: boolean;
  children?: Map<string, MutableNode>;
  file?: SkillFileTreeLeaf;
};

/** Packages larger than this only expand the first directory level by default. */
export const SKILL_FILE_TREE_FULL_EXPAND_LIMIT = 80;

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

function normalizeRelPath(relPath: string): string {
  return relPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Build a directory tree from skill package file summaries.
 * Directory keys use a trailing slash (e.g. `bin/`) so Tree keys never collide with a file named `bin`.
 * If the same segment is both a file and a directory prefix, keep the first shape and record a conflict.
 */
export function buildSkillFileTree(files: SkillFileTreeLeaf[]): SkillFileTreeNode[] {
  return buildSkillFileTreeWithConflicts(files).nodes;
}

export function buildSkillFileTreeWithConflicts(
  files: SkillFileTreeLeaf[],
): BuildSkillFileTreeResult {
  const root = new Map<string, MutableNode>();
  const conflicts: string[] = [];

  for (const file of files) {
    const relPath = normalizeRelPath(file.relPath);
    if (!relPath) {
      continue;
    }

    const segments = relPath.split("/").filter(Boolean);
    if (segments.length === 0) {
      continue;
    }

    let current = root;
    let prefix = "";
    let skipped = false;

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
      } else if (isLeaf && !node.isLeaf) {
        // Existing directory vs new file with the same path segment.
        conflicts.push(relPath);
        skipped = true;
        break;
      } else if (!isLeaf && node.isLeaf) {
        // Existing file vs new nested path under the same segment.
        conflicts.push(relPath);
        skipped = true;
        break;
      }

      if (isLeaf) {
        node.isLeaf = true;
        node.key = key;
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
      node.key = key;
      current = node.children;
    }

    if (skipped) {
      continue;
    }
  }

  return {
    nodes: [...root.values()].map(freezeNode).sort(compareNodes),
    conflicts,
  };
}

export function collectSkillFileTreeKeys(
  nodes: SkillFileTreeNode[],
  options?: { maxDepth?: number },
): string[] {
  const keys: string[] = [];
  const maxDepth = options?.maxDepth;

  const walk = (items: SkillFileTreeNode[], depth: number) => {
    for (const item of items) {
      if (item.isLeaf) {
        continue;
      }

      keys.push(item.key);
      if (item.children?.length && (maxDepth === undefined || depth < maxDepth)) {
        walk(item.children, depth + 1);
      }
    }
  };

  walk(nodes, 1);
  return keys;
}

export function getDefaultSkillFileTreeExpandedKeys(
  nodes: SkillFileTreeNode[],
  fileCount: number,
): string[] {
  if (fileCount > SKILL_FILE_TREE_FULL_EXPAND_LIMIT) {
    return collectSkillFileTreeKeys(nodes, { maxDepth: 1 });
  }

  return collectSkillFileTreeKeys(nodes);
}
