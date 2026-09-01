/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ThunderboltOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

/**
 * Top-bar active-build badge. Counts only running or queued batch tasks; streaming listeners are
 * steady state and excluded. Clicking navigates directly to the index-build page.
 */
export function BuildActivityChip() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const tasks = await listBuildTasks({ silent: true, statuses: ["pending", "running"] });
      setCount(tasks.filter((task) => task.mode === "batch").length);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = useMock
      ? undefined
      : window.setInterval(() => {
        if (document.hidden) {
          return;
        }
        void refresh();
      }, 30_000);
    const unsubscribe = subscribeMockDb(() => void refresh());
    return () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
      }
      unsubscribe();
    };
  }, [refresh]);

  if (count === 0) {
    return null;
  }

  return (
    <button
      className="console-topbar-chip console-topbar-chip-accent"
      onClick={() => {
        void navigate("/index-builds");
      }}
      style={{ cursor: "pointer" }}
      type="button"
    >
      <ThunderboltOutlined />
      <span>{t("dataCatalog.buildChip", { count })}</span>
    </button>
  );
}
