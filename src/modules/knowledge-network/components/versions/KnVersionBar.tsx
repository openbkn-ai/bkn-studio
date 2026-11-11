/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Select, Tag } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { KnDiffModal } from "@/modules/knowledge-network/components/versions/KnDiffModal";
import { PublishVersionModal } from "@/modules/knowledge-network/components/versions/PublishVersionModal";
import { confirmResetDraft } from "@/modules/knowledge-network/components/versions/kn-version-actions";
import {
  useReadableKnVersions,
  versionOptionLabel,
} from "@/modules/knowledge-network/components/versions/useReadableKnVersions";
import {
  knVersionName,
  parseKnVersionView,
} from "@/modules/knowledge-network/lib/kn-version-format";
import type { KnVersionView, KnVersioning } from "@/modules/knowledge-network/types/kn-version";

import styles from "./KnVersions.module.css";

type KnVersionBarProps = {
  /** The user may edit the network (`modify`), which is also what reading the draft needs. */
  canModify: boolean;
  hasCapabilities?: boolean;
  networkId: string;
  /** Reload what the workspace shows after the versions or the draft changed. */
  onChanged: () => void;
  onViewChange: (view: KnVersionView) => void;
  view: KnVersionView;
  versioning: KnVersioning;
};

/** Strip above the workspace of a versioned network: which version is on screen, and the draft's state. */
export function KnVersionBar({
  canModify,
  hasCapabilities,
  networkId,
  onChanged,
  onViewChange,
  view,
  versioning,
}: KnVersionBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const [publishOpen, setPublishOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const versions = useReadableKnVersions(networkId, versioning.running_version);
  const draft = versioning.draft;
  const base = draft?.base_version ?? 0;
  const running = versioning.running_version;
  const isDraft = view === "draft";
  const viewValue = view === "running" ? String(running) : String(view);

  const options = [
    ...(canModify ? [{ value: "draft", label: t("knowledgeNetwork.versions.draft") }] : []),
    ...versions.map((version) => ({
      value: String(version.version),
      label:
        version.status === "running"
          ? `${versionOptionLabel(version)} (${t("knowledgeNetwork.versions.status.running")})`
          : versionOptionLabel(version),
    })),
  ];

  const actionContext = {
    modal,
    networkId,
    notify: message,
    onChanged,
    t,
    versioning,
  };

  return (
    <div className={styles.bar}>
      <div className={styles.barRow}>
        <Select
          aria-label={t("knowledgeNetwork.versions.viewing")}
          className={styles.viewSelect}
          onChange={(value) => onViewChange(parseKnVersionView(value))}
          options={options}
          value={isDraft ? "draft" : viewValue}
        />
        {isDraft ? (
          <>
            <Tag>
              {running === 0
                ? t("knowledgeNetwork.versions.notPublished")
                : t("knowledgeNetwork.versions.basedOn", { version: knVersionName(base) })}
            </Tag>
            {draft?.has_changes ? (
              <Tag color="warning">{t("knowledgeNetwork.versions.hasChanges")}</Tag>
            ) : (
              <Tag color="success">{t("knowledgeNetwork.versions.noChanges")}</Tag>
            )}
          </>
        ) : null}
        <span className={styles.barSpacer} />
        {canModify && isDraft ? (
          <>
            {running > 0 ? (
              <Button onClick={() => setDiffOpen(true)} size="small">
                {t("knowledgeNetwork.versions.viewChanges")}
              </Button>
            ) : null}
            {draft?.has_changes ? (
              <Button danger onClick={() => confirmResetDraft(actionContext)} size="small">
                {t("knowledgeNetwork.versions.discard")}
              </Button>
            ) : null}
            <Button
              disabled={!draft?.has_changes && running > 0}
              onClick={() => setPublishOpen(true)}
              size="small"
              type="primary"
            >
              {t("knowledgeNetwork.versions.publish.action")}
            </Button>
          </>
        ) : null}
        <Button
          onClick={() => void navigate(`/knowledge-network/workspace/${networkId}/versions`)}
          size="small"
          type="link"
        >
          {t("knowledgeNetwork.versions.history")}
        </Button>
      </div>
      {isDraft && draft?.outdated ? (
        <Alert
          message={t("knowledgeNetwork.versions.outdated", {
            base: knVersionName(base),
            running: knVersionName(running),
          })}
          showIcon
          type="warning"
        />
      ) : null}
      {!isDraft ? (
        <Alert
          action={
            canModify ? (
              <Button onClick={() => onViewChange("draft")} size="small">
                {t("knowledgeNetwork.versions.backToDraft")}
              </Button>
            ) : undefined
          }
          message={t("knowledgeNetwork.versions.readOnlyView", {
            version: knVersionName(view === "running" ? running : view),
          })}
          showIcon
          type="info"
        />
      ) : null}
      <PublishVersionModal
        hasCapabilities={hasCapabilities}
        networkId={networkId}
        onChanged={onChanged}
        onClose={() => setPublishOpen(false)}
        open={publishOpen}
        versioning={versioning}
      />
      <KnDiffModal
        canDraft={canModify}
        networkId={networkId}
        onClose={() => setDiffOpen(false)}
        open={diffOpen}
        versioning={versioning}
      />
    </div>
  );
}
