/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal } from "antd";
import type { TFunction } from "i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { knVersionName } from "@/modules/knowledge-network/lib/kn-version-format";
import {
  activateKnVersion,
  changeKnVersionStatus,
  isKnVersionConflict,
  readKnVersionErrorCode,
  readKnVersionProblems,
  resetKnDraft,
} from "@/modules/knowledge-network/services/kn-version.service";
import type { KnVersioning } from "@/modules/knowledge-network/types/kn-version";

type ActionContext = {
  /** Called after the change went through, or after a conflict that needs a reload. */
  onChanged: () => void;
  networkId: string;
  notify: { success: (text: string) => void; error: (text: string) => void };
  t: TFunction;
  versioning: KnVersioning;
};

function showFailure(context: ActionContext, error: unknown) {
  const { t } = context;
  if (isKnVersionConflict(error)) {
    Modal.warning({
      content: t("knowledgeNetwork.versions.conflict"),
      okText: t("knowledgeNetwork.versions.reload"),
      onOk: context.onChanged,
      title: t("knowledgeNetwork.versions.conflictTitle"),
    });
    return;
  }
  const problems = readKnVersionProblems(error);
  if (problems.length > 0) {
    Modal.error({
      content: (
        <ul>
          {problems.map((problem, index) => (
            <li key={`${problem.definition_id}-${index}`}>
              {[problem.definition_type, problem.definition_id].filter(Boolean).join(" ")}
              {problem.description ? `: ${problem.description}` : ""}
            </li>
          ))}
        </ul>
      ),
      title:
        readKnVersionErrorCode(error) === "BrokenReferences"
          ? t("knowledgeNetwork.versions.activate.brokenReferences")
          : extractRequestErrorMessage(error),
    });
    return;
  }
  context.notify.error(extractRequestErrorMessage(error));
}

/**
 * Discards the draft's changes (no `fromVersion`) or copies a version into the draft. Both
 * replace the whole draft, so unpublished changes are confirmed away first.
 */
export function confirmResetDraft(context: ActionContext, fromVersion?: number) {
  const { t, versioning } = context;
  const hasChanges = Boolean(versioning.draft?.has_changes);
  const copy = fromVersion !== undefined;
  Modal.confirm({
    content: hasChanges
      ? t("knowledgeNetwork.versions.reset.overwriteWarning")
      : t("knowledgeNetwork.versions.reset.noChanges"),
    okButtonProps: { danger: hasChanges },
    okText: copy
      ? t("knowledgeNetwork.versions.copyToDraft")
      : t("knowledgeNetwork.versions.discard"),
    onOk: async () => {
      try {
        await resetKnDraft(context.networkId, {
          expectedDraftRevision: versioning.draft?.revision ?? 0,
          fromVersion,
          overwriteChanges: hasChanges,
        });
        context.notify.success(t("common.success"));
        context.onChanged();
      } catch (error) {
        showFailure(context, error);
      }
    },
    title: copy
      ? t("knowledgeNetwork.versions.reset.copyTitle", { version: knVersionName(fromVersion) })
      : t("knowledgeNetwork.versions.reset.discardTitle"),
  });
}

/** Makes a history version the running one, which is also how a rollback is done. */
export function confirmActivate(context: ActionContext, version: number, rollback = false) {
  const { t, versioning } = context;
  Modal.confirm({
    content: (
      <>
        <p>
          {t("knowledgeNetwork.versions.activate.body", {
            running: knVersionName(versioning.running_version),
            version: knVersionName(version),
          })}
        </p>
        <p>{t("knowledgeNetwork.versions.capabilityNote")}</p>
      </>
    ),
    okText: rollback
      ? t("knowledgeNetwork.versions.rollback")
      : t("knowledgeNetwork.versions.activate.action"),
    onOk: async () => {
      try {
        await activateKnVersion(context.networkId, version, versioning.running_version);
        context.notify.success(t("common.success"));
        context.onChanged();
      } catch (error) {
        showFailure(context, error);
      }
    },
    title: t("knowledgeNetwork.versions.activate.title", { version: knVersionName(version) }),
  });
}

/** Professional edition: deprecate, restore or purge a version. */
export function confirmStatusChange(
  context: ActionContext,
  version: number,
  action: "deprecate" | "restore" | "purge",
) {
  const { t } = context;
  Modal.confirm({
    content: t(`knowledgeNetwork.versions.${action}Body`),
    okButtonProps: { danger: action === "purge" },
    okText: t(`knowledgeNetwork.versions.${action}`),
    onOk: async () => {
      try {
        await changeKnVersionStatus(context.networkId, version, action);
        context.notify.success(t("common.success"));
        context.onChanged();
      } catch (error) {
        showFailure(context, error);
      }
    },
    title: t(`knowledgeNetwork.versions.${action}Title`, { version: knVersionName(version) }),
  });
}
