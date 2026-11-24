/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  extractRequestErrorMessage,
  readErrorCode,
  readErrorDetails,
} from "@/framework/request/error-message";
import { deleteKnEventType } from "@/modules/knowledge-network/services/event-type.service";
import type { KnEventType } from "@/modules/knowledge-network/types/event-type";

import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";

const PREFIX = "knowledgeNetwork.eventClasses.delete";

/** The definitions the refusal names as still using the event class. */
function usedBy(error: unknown): string[] {
  const details = readErrorDetails(error);
  const names = (details as { used_by?: unknown } | null)?.used_by;
  return Array.isArray(names)
    ? names.filter((name): name is string => typeof name === "string")
    : [];
}

/** Says why an event class could not be deleted: it has events, or other definitions use it. */
export function useEventClassDeleteRefusal() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();

  return useCallback(
    (error: unknown, eventType: Pick<KnEventType, "name">) => {
      const code = readErrorCode(error);
      if (code === "BknBackend.KnEvent.EventTypeInUse") {
        void modal.error({
          centered: true,
          content: t(`${PREFIX}.hasEvents`),
          title: t(`${PREFIX}.refusedTitle`, { name: eventType.name }),
        });
        return;
      }
      if (code === "BknBackend.KnEvent.RecognizedByAction") {
        void modal.error({
          centered: true,
          content: t(`${PREFIX}.recognizedByAction`),
          title: t(`${PREFIX}.refusedTitle`, { name: eventType.name }),
        });
        return;
      }
      if (code === "BknBackend.KnEvent.EventClassInUse") {
        const names = usedBy(error);
        void modal.error({
          centered: true,
          content: (
            <div>
              <p>{t(`${PREFIX}.inUse`)}</p>
              {names.length ? (
                <ul>
                  {names.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ),
          title: t(`${PREFIX}.refusedTitle`, { name: eventType.name }),
          width: 520,
        });
        return;
      }
      void message.error(extractRequestErrorMessage(error));
    },
    [message, modal, t],
  );
}

/**
 * Deletes an event class together with its recognition action. Asks first; resolves true once it is gone.
 */
export function useEventClassDelete() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const explain = useEventClassDeleteRefusal();

  return useCallback(
    (networkId: string, eventType: KnEventType, options: { versioned?: boolean } = {}) =>
      new Promise<boolean>((resolve) => {
        void modal.confirm({
          cancelText: t("common.cancel"),
          centered: true,
          className: `${modalStyles.businessModal} ${modalStyles.resourceDeleteConfirmModal}`,
          content: options.versioned
            ? t(`${PREFIX}.confirmVersioned`, { name: eventType.name })
            : t(`${PREFIX}.confirm`, { name: eventType.name }),
          okButtonProps: { danger: true, type: "primary" },
          okText: t("common.delete"),
          onCancel: () => resolve(false),
          onOk: async () => {
            try {
              await deleteKnEventType(networkId, eventType.code);
            } catch (error) {
              explain(error, eventType);
              resolve(false);
              return;
            }
            void message.success(t("common.success"));
            resolve(true);
          },
          title: t(`${PREFIX}.title`),
          width: 520,
        });
      }),
    [explain, message, modal, t],
  );
}
