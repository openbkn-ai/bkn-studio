/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import { listUsers } from "@/modules/system-admin/services/admin.service";
import { buildAuditUserDirectory } from "@/modules/execution-factory/utils/audit-user-display";

/**
 * 这份目录只用来把审计字段里的用户 ID 渲染成人名，一次会话内不会变。
 * 缓存 promise 而不是结果：多个组件同时挂载时也只发一次 users?limit=500。
 */
let directoryPromise: Promise<Map<string, string>> | null = null;

function loadDirectory(): Promise<Map<string, string>> {
  directoryPromise ??= listUsers({ skipErrorToast: true })
    .then((users) => buildAuditUserDirectory(users))
    .catch(() => {
      // 失败不留在缓存里，下一个挂载的组件还能重试。
      directoryPromise = null;
      return new Map<string, string>();
    });

  return directoryPromise;
}

/** 用户增删改之后调用，让下次读取重新拉取。 */
export function invalidateAuditUserDirectory() {
  directoryPromise = null;
}

export function useAuditUserDirectory() {
  const [directory, setDirectory] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let active = true;

    void loadDirectory().then((next) => {
      if (active) {
        setDirectory(next);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return directory;
}
