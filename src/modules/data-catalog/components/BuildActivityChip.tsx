import { ThunderboltOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { listBuildTasks } from "@/modules/data-catalog/services/build-task.service";
import { subscribeMockDb } from "@/modules/data-catalog/services/mock-db";

/**
 * 顶栏「构建中」角标:仅统计 batch 运行 / 排队任务
 * (streaming 监听是稳态,不计入),点击直达索引构建页。
 */
export function BuildActivityChip() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const tasks = await listBuildTasks({ statuses: ["pending", "running"] });
      setCount(tasks.filter((task) => task.mode === "batch").length);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      void refresh();
    }, 30_000);
    const unsubscribe = subscribeMockDb(() => void refresh());
    return () => {
      window.clearInterval(timer);
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
