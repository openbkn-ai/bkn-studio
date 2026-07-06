/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  deleteBuildTask,
  pauseBuildTask,
  resumeBuildTask,
  retryBuildTask,
  type BuildExecuteType,
} from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

const ACTIVE_TASK_STATUSES = new Set<BuildTask["status"]>([
  "pending",
  "running",
  "listening",
]);

export function useBuildTaskActions(onRefresh: () => Promise<void> | void) {
  const { message, modal } = useAppServices();
  const { t } = useTranslation();

  const pauseOrResume = useCallback(
    async (task: BuildTask) => {
      const isStreaming = task.mode === "streaming";
      try {
        if (ACTIVE_TASK_STATUSES.has(task.status)) {
          await pauseBuildTask(task.id);
          message.success(
            t(isStreaming ? "dataCatalog.task.paused" : "dataCatalog.task.stopped"),
          );
        } else {
          await resumeBuildTask(task.id);
          message.success(
            t(isStreaming ? "dataCatalog.task.resumed" : "dataCatalog.task.buildResumed"),
          );
        }
        await onRefresh();
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      }
    },
    [message, onRefresh, t],
  );

  const retry = useCallback(
    async (task: BuildTask, executeType: BuildExecuteType = "incremental") => {
      const run = async () => {
        try {
          const next = await retryBuildTask(task.id, executeType);
          if (next) {
            message.success(t("dataCatalog.task.retried", { id: next.id }));
          }
          await onRefresh();
        } catch (error) {
          void message.error(extractRequestErrorMessage(error));
        }
      };

      if (executeType === "full") {
        modal.confirm({
          title: t("dataCatalog.task.rebuildFullConfirmTitle"),
          content: t("dataCatalog.task.rebuildFullConfirmContent"),
          okText: t("common.confirm"),
          cancelText: t("common.cancel"),
          okButtonProps: { danger: true },
          onOk: run,
        });
        return;
      }

      await run();
    },
    [message, modal, onRefresh, t],
  );

  const remove = useCallback(
    (task: BuildTask) => {
      const isActive = task.status === "running" || task.status === "listening";
      void modal.confirm({
        title: t("dataCatalog.task.deleteConfirmTitle", { id: task.id }),
        content: isActive
          ? t("dataCatalog.task.deleteConfirmContentActive")
          : t("dataCatalog.task.deleteConfirmContent"),
        okText: t("common.delete"),
        cancelText: t("common.cancel"),
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await deleteBuildTask(task.id, { stopFirst: isActive });
            message.success(t("common.success"));
            await onRefresh();
          } catch (error) {
            void message.error(extractRequestErrorMessage(error));
          }
        },
      });
    },
    [message, modal, onRefresh, t],
  );

  return { pauseOrResume, remove, retry };
}
