/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { BranchesOutlined, EllipsisOutlined } from "@ant-design/icons";
import { Alert, Button, Dropdown, Select } from "antd";
import type { MenuProps } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ShellTrailPortal } from "@/app/shell/workspace-slots";
import { useAppServices } from "@/framework/context/use-app-services";
import { KnVersionSlotPortal } from "@/modules/knowledge-network/components/versions/KnVersionSlot";
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

/**
 * Which version of a versioned network is on screen, as a quiet picker beside the network's
 * title on the overview, and after the top bar's trail elsewhere. A draft that matches the running version reads as that version; only unpublished
 * changes bring out the draft, its base and the publish action.
 */
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
  const hasChanges = Boolean(draft?.has_changes);
  const canPublish = canModify && isDraft && (hasChanges || running === 0);

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

  const draftLabel = () => {
    if (running > 0 && !hasChanges) {
      return knVersionName(running);
    }
    return (
      <span className={styles.draftStatus}>
        {hasChanges ? <span aria-hidden className={styles.changesDot} /> : null}
        {`${t("knowledgeNetwork.versions.draft")} · ${
          running === 0
            ? t("knowledgeNetwork.versions.notPublished")
            : t("knowledgeNetwork.versions.basedOn", { version: knVersionName(base) })
        }`}
      </span>
    );
  };

  const actionContext = {
    modal,
    networkId,
    notify: message,
    onChanged,
    t,
    versioning,
  };

  const menuItems: MenuProps["items"] = [
    ...(canModify && isDraft && running > 0 && hasChanges
      ? [{ key: "diff", label: t("knowledgeNetwork.versions.viewChanges") }]
      : []),
    ...(canModify && isDraft && hasChanges
      ? [{ danger: true, key: "discard", label: t("knowledgeNetwork.versions.discard") }]
      : []),
    { key: "history", label: t("knowledgeNetwork.versions.history") },
  ];

  const onMenu: MenuProps["onClick"] = ({ key }) => {
    if (key === "diff") {
      setDiffOpen(true);
    } else if (key === "discard") {
      confirmResetDraft(actionContext);
    } else {
      void navigate(`/knowledge-network/workspace/${networkId}/versions`);
    }
  };

  const picker = (
    <span className={styles.picker}>
      <Select
        aria-label={t("knowledgeNetwork.versions.viewing")}
        className={styles.viewSelect}
        labelRender={({ label, value }) => (value === "draft" ? draftLabel() : label)}
        onChange={(value) => onViewChange(parseKnVersionView(value))}
        options={options}
        popupMatchSelectWidth={false}
        prefix={<BranchesOutlined />}
        size="small"
        value={isDraft ? "draft" : viewValue}
        variant="filled"
      />
      {canPublish ? (
        <Button onClick={() => setPublishOpen(true)} size="small" type="link">
          {t("knowledgeNetwork.versions.publish.action")}
        </Button>
      ) : null}
      <Dropdown menu={{ items: menuItems, onClick: onMenu }} trigger={["click"]}>
        <Button
          aria-label={t("knowledgeNetwork.versions.more")}
          icon={<EllipsisOutlined />}
          size="small"
          type="text"
        />
      </Dropdown>
    </span>
  );

  const outdated = isDraft && draft?.outdated;
  const viewedVersion = view === "running" || view === "draft" ? running : view;

  return (
    <>
      <KnVersionSlotPortal
        fallback={
          <ShellTrailPortal fallback={<div className={styles.bar}>{picker}</div>}>
            {picker}
          </ShellTrailPortal>
        }
      >
        {picker}
      </KnVersionSlotPortal>
      {outdated || !isDraft ? (
        <div className={styles.notice}>
          {outdated ? (
            <Alert
              message={t("knowledgeNetwork.versions.outdated", {
                base: knVersionName(base),
                running: knVersionName(running),
              })}
              showIcon
              type="warning"
            />
          ) : (
            <span className={styles.readOnlyNote}>
              {t("knowledgeNetwork.versions.readOnlyView", {
                version: knVersionName(viewedVersion),
              })}
              {canModify ? (
                <Button onClick={() => onViewChange("draft")} size="small" type="link">
                  {t("knowledgeNetwork.versions.backToDraft")}
                </Button>
              ) : null}
            </span>
          )}
        </div>
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
    </>
  );
}
