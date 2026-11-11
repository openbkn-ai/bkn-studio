/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { BranchesOutlined, CloudUploadOutlined } from "@ant-design/icons";
import { Alert, Button, Select } from "antd";
import type { ReactElement } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ShellTrailPortal } from "@/app/shell/workspace-slots";
import { KnVersionSlotPortal } from "@/modules/knowledge-network/components/versions/KnVersionSlot";
import { PublishVersionModal } from "@/modules/knowledge-network/components/versions/PublishVersionModal";
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
  const [publishOpen, setPublishOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  // One way out to everything else about versions, under the list, as GitHub does for branches.
  const popupRender = (menu: ReactElement) => (
    <>
      {menu}
      <div className={styles.pickerActions}>
        <Button
          block
          onClick={() => {
            setPickerOpen(false);
            void navigate(`/knowledge-network/workspace/${networkId}/versions`);
          }}
          size="small"
          type="text"
        >
          {t("knowledgeNetwork.versions.title")}
        </Button>
      </div>
    </>
  );

  const picker = (
    <span className={styles.picker}>
      <Select
        aria-label={t("knowledgeNetwork.versions.viewing")}
        className={styles.viewSelect}
        labelRender={({ label, value }) => (value === "draft" ? draftLabel() : label)}
        onChange={(value) => onViewChange(parseKnVersionView(value))}
        onOpenChange={setPickerOpen}
        open={pickerOpen}
        options={options}
        popupMatchSelectWidth={false}
        popupRender={popupRender}
        prefix={<BranchesOutlined />}
        value={isDraft ? "draft" : viewValue}
        variant="borderless"
      />
      {canPublish ? (
        <Button icon={<CloudUploadOutlined />} onClick={() => setPublishOpen(true)} type="primary">
          {t("knowledgeNetwork.versions.publish.action")}
        </Button>
      ) : null}
    </span>
  );

  const outdated = isDraft && draft?.outdated;

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
      {outdated ? (
        <div className={styles.notice}>
          <Alert
            message={t("knowledgeNetwork.versions.outdated", {
              base: knVersionName(base),
              running: knVersionName(running),
            })}
            showIcon
            type="warning"
          />
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
    </>
  );
}
