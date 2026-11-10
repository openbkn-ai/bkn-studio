/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Modal, Select, Space } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { KnDiffSummary } from "@/modules/knowledge-network/components/versions/KnDiffSummary";
import {
  useReadableKnVersions,
  versionOptionLabel,
} from "@/modules/knowledge-network/components/versions/useReadableKnVersions";
import { parseKnVersionView } from "@/modules/knowledge-network/lib/kn-version-format";
import { diffKnVersions } from "@/modules/knowledge-network/services/kn-version.service";
import type {
  KnDiffResult,
  KnVersionView,
  KnVersioning,
} from "@/modules/knowledge-network/types/kn-version";

type KnDiffModalProps = {
  /** What to show on the left when the dialog opens. */
  initialBase?: KnVersionView;
  initialTarget?: KnVersionView;
  networkId: string;
  onClose: () => void;
  open: boolean;
  /** The user may read the draft (network `modify`). */
  canDraft: boolean;
  versioning: KnVersioning;
};

/** Compares any two of the draft, the running version and the numbered versions. */
export function KnDiffModal({
  canDraft,
  initialBase = "running",
  initialTarget = "draft",
  networkId,
  onClose,
  open,
  versioning,
}: KnDiffModalProps) {
  const { t } = useTranslation();
  const versions = useReadableKnVersions(networkId, versioning.running_version);
  const [base, setBase] = useState<KnVersionView>(initialBase);
  const [target, setTarget] = useState<KnVersionView>(initialTarget);
  const [result, setResult] = useState<KnDiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Only the latest comparison may show; an earlier one that answers late is dropped.
  const latest = useRef(0);

  const options = useMemo(
    () => [
      ...(canDraft ? [{ value: "draft", label: t("knowledgeNetwork.versions.draft") }] : []),
      ...versions.map((version) => ({
        value: String(version.version),
        label:
          version.status === "running"
            ? `${versionOptionLabel(version)} (${t("knowledgeNetwork.versions.status.running")})`
            : versionOptionLabel(version),
      })),
    ],
    [canDraft, t, versions],
  );

  // "running" is only a name for the running version's number in the selectors.
  const asValue = (view: KnVersionView) =>
    view === "running" ? String(versioning.running_version) : String(view);

  const compare = (from: KnVersionView = base, to: KnVersionView = target) => {
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    setResult(null);
    void diffKnVersions(networkId, from, to)
      .then((next) => {
        if (request === latest.current) {
          setResult(next);
        }
      })
      .catch((nextError: unknown) => {
        if (request === latest.current) {
          setError(extractRequestErrorMessage(nextError));
        }
      })
      .finally(() => {
        if (request === latest.current) {
          setLoading(false);
        }
      });
  };

  // Each opening shows the requested pair and compares exactly that pair: the selectors'
  // state is not updated yet in this commit, so the comparison takes the values directly.
  useEffect(() => {
    if (!open) {
      return;
    }
    setBase(initialBase);
    setTarget(initialTarget);
    if (versioning.running_version > 0) {
      compare(initialBase, initialTarget);
    }
    // The selectors run it again on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBase, initialTarget, open]);

  return (
    <Modal
      footer={<Button onClick={onClose}>{t("knowledgeNetwork.versions.close")}</Button>}
      onCancel={onClose}
      open={open}
      title={t("knowledgeNetwork.versions.diff.title")}
      width={720}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          aria-label={t("knowledgeNetwork.versions.diff.base")}
          onChange={(value) => setBase(parseKnVersionView(value))}
          options={options}
          style={{ minWidth: 180 }}
          value={asValue(base)}
        />
        <span>{"→"}</span>
        <Select
          aria-label={t("knowledgeNetwork.versions.diff.target")}
          onChange={(value) => setTarget(parseKnVersionView(value))}
          options={options}
          style={{ minWidth: 180 }}
          value={asValue(target)}
        />
        <Button onClick={() => compare()} type="primary">
          {t("knowledgeNetwork.versions.diff.compare")}
        </Button>
      </Space>
      {versioning.running_version === 0 ? (
        <Alert
          message={t("knowledgeNetwork.versions.diff.nothingToCompare")}
          showIcon
          type="info"
        />
      ) : (
        <KnDiffSummary error={error} loading={loading} result={result} />
      )}
    </Modal>
  );
}
