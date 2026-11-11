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
import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  KnVersionActionPortal,
  KnVersionSlotPortal,
} from "@/modules/knowledge-network/components/versions/KnVersionSlot";
import { PublishVersionModal } from "@/modules/knowledge-network/components/versions/PublishVersionModal";
import {
  useReadableKnVersions,
  versionOptionLabel,
} from "@/modules/knowledge-network/components/versions/useReadableKnVersions";
import {
  knVersionName,
  parseKnVersionView,
} from "@/modules/knowledge-network/lib/kn-version-format";
import { enableKnVersioning } from "@/modules/knowledge-network/services/kn-version.service";
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

/** The one way out to everything else about versions, under the picker's list. */
function useVersionsLink(networkId: string) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
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
  return { onOpenChange: setPickerOpen, open: pickerOpen, popupRender };
}

type KnUnversionedBarProps = {
  canModify: boolean;
  networkId: string;
  /** Reload the workspace once the network has versions. */
  onChanged: () => void;
};

/**
 * A network without versions yet is what it holds now, shown as v1, and its edits take effect
 * at once. Publishing it keeps that content as the running v1 and starts a draft for the edits
 * after, and the full picker takes over.
 */
export function KnUnversionedBar({ canModify, networkId, onChanged }: KnUnversionedBarProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const link = useVersionsLink(networkId);
  const publish = canModify ? (
    <Button
      icon={<CloudUploadOutlined />}
      onClick={() => {
        modal.confirm({
          content: t("knowledgeNetwork.versions.firstPublish.body"),
          okText: t("knowledgeNetwork.versions.publish.action"),
          onOk: async () => {
            try {
              await enableKnVersioning(networkId);
              message.success(t("common.success"));
              onChanged();
            } catch (error) {
              message.error(extractRequestErrorMessage(error));
            }
          },
          title: t("knowledgeNetwork.versions.firstPublish.title"),
        });
      }}
      type="primary"
    >
      {t("knowledgeNetwork.versions.publish.action")}
    </Button>
  ) : null;
  const select = (
    <Select
      {...link}
      aria-label={t("knowledgeNetwork.versions.viewing")}
      className={styles.viewSelect}
      // As on a versioned network, the closed picker names the version; the list says it runs.
      labelRender={() => knVersionName(1)}
      options={[
        {
          label: `${knVersionName(1)} (${t("knowledgeNetwork.versions.status.running")})`,
          value: "1",
        },
      ]}
      popupMatchSelectWidth={false}
      prefix={<BranchesOutlined />}
      value="1"
      variant="borderless"
    />
  );
  const trail = (
    <span className={styles.picker}>
      {select}
      {publish}
    </span>
  );
  return (
    <KnVersionSlotPortal
      fallback={
        <ShellTrailPortal fallback={<div className={styles.bar}>{trail}</div>}>
          {trail}
        </ShellTrailPortal>
      }
    >
      <span className={styles.picker}>
        {select}
        <KnVersionActionPortal fallback={publish}>{publish}</KnVersionActionPortal>
      </span>
    </KnVersionSlotPortal>
  );
}

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
  const [publishOpen, setPublishOpen] = useState(false);
  const link = useVersionsLink(networkId);
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

  const select = (
    <Select
      aria-label={t("knowledgeNetwork.versions.viewing")}
      className={styles.viewSelect}
      labelRender={({ label, value }) => (value === "draft" ? draftLabel() : label)}
      {...link}
      onChange={(value) => onViewChange(parseKnVersionView(value))}
      options={options}
      popupMatchSelectWidth={false}
      prefix={<BranchesOutlined />}
      value={isDraft ? "draft" : viewValue}
      variant="borderless"
    />
  );

  const publish = canPublish ? (
    <Button icon={<CloudUploadOutlined />} onClick={() => setPublishOpen(true)} type="primary">
      {t("knowledgeNetwork.versions.publish.action")}
    </Button>
  ) : null;

  // In the top bar, publishing follows the picker; on the overview it is the main action on the
  // right of the title, with the network's other actions.
  const trailPicker = (
    <span className={styles.picker}>
      {select}
      {publish}
    </span>
  );

  const outdated = isDraft && draft?.outdated;

  return (
    <>
      <KnVersionSlotPortal
        fallback={
          <ShellTrailPortal fallback={<div className={styles.bar}>{trailPicker}</div>}>
            {trailPicker}
          </ShellTrailPortal>
        }
      >
        <span className={styles.picker}>
          {select}
          <KnVersionActionPortal fallback={publish}>{publish}</KnVersionActionPortal>
        </span>
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
