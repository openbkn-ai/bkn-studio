/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Checkbox, Form, Input, Modal, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { KnDiffSummary } from "@/modules/knowledge-network/components/versions/KnDiffSummary";
import { knVersionName } from "@/modules/knowledge-network/lib/kn-version-format";
import {
  diffKnVersions,
  isKnVersionConflict,
  publishKnVersion,
  readKnVersionErrorCode,
  readKnVersionProblems,
} from "@/modules/knowledge-network/services/kn-version.service";
import type {
  KnDiffResult,
  KnPublishResult,
  KnVersionProblem,
  KnVersioning,
} from "@/modules/knowledge-network/types/kn-version";

import styles from "./KnVersions.module.css";

type PublishVersionModalProps = {
  /** The network has functions or Skills mounted; their code is not part of a version. */
  hasCapabilities?: boolean;
  networkId: string;
  onClose: () => void;
  /** Called after a publish went through, and after a conflict that needs a reload. */
  onChanged: () => void;
  open: boolean;
  versioning: KnVersioning;
};

type FormValues = { label?: string; notes: string };

function ProblemList({ problems }: { problems: KnVersionProblem[] }) {
  return (
    <ul className={styles.problemList}>
      {problems.map((problem, index) => (
        <li key={`${problem.definition_id}-${index}`}>
          {[problem.definition_type, problem.definition_id].filter(Boolean).join(" ")}
          {problem.description ? `: ${problem.description}` : ""}
        </li>
      ))}
    </ul>
  );
}

export function PublishVersionModal({
  hasCapabilities,
  networkId,
  onChanged,
  onClose,
  open,
  versioning,
}: PublishVersionModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const draft = versioning.draft;
  const outdated = Boolean(draft?.outdated);
  const base = draft?.base_version ?? 0;
  const running = versioning.running_version;
  const [againstBase, setAgainstBase] = useState<KnDiffResult | null>(null);
  const [againstRunning, setAgainstRunning] = useState<KnDiffResult | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [confirmedOutdated, setConfirmedOutdated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<KnVersionProblem[]>([]);
  const [conflict, setConflict] = useState(false);
  const [published, setPublished] = useState<KnPublishResult | null>(null);

  // A new opening starts from an empty form.
  useEffect(() => {
    if (!open) {
      return;
    }
    form.resetFields();
    setConfirmedOutdated(false);
    setError(null);
    setProblems([]);
    setConflict(false);
    setPublished(null);
  }, [form, open]);

  useEffect(() => {
    // After a publish the network reloads and the draft moves on; the completion page stays.
    if (!open || published) {
      return;
    }
    let cancelled = false;
    setAgainstBase(null);
    setAgainstRunning(null);
    setDiffError(null);

    if (running === 0) {
      // Nothing is running yet, so there is nothing to compare with.
      return;
    }

    setDiffLoading(true);
    void Promise.all([
      outdated && base > 0 && base !== running
        ? // The upstream may be gone (Community keeps two versions); then only the other diff shows.
          diffKnVersions(networkId, base, "draft").catch(() => null)
        : Promise.resolve(null),
      diffKnVersions(networkId, "running", "draft"),
    ])
      .then(([baseResult, runningResult]) => {
        if (!cancelled) {
          setAgainstBase(baseResult);
          setAgainstRunning(runningResult);
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setDiffError(extractRequestErrorMessage(nextError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDiffLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // Re-run only when the modal opens for another draft state.
  }, [base, networkId, open, outdated, published, running, draft?.revision]);

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    setError(null);
    setProblems([]);
    try {
      const result = await publishKnVersion(networkId, {
        allowOutdatedBase: outdated,
        expectedDraftRevision: draft?.revision ?? 0,
        expectedRunningVersion: running,
        label: values.label,
        notes: values.notes,
      });
      setPublished(result);
      onChanged();
    } catch (nextError) {
      const code = readKnVersionErrorCode(nextError);
      if (isKnVersionConflict(nextError)) {
        setConflict(true);
      } else if (code === "ValidationFailed") {
        setProblems(readKnVersionProblems(nextError));
        setError(t("knowledgeNetwork.versions.publish.validationFailed"));
      } else if (code === "NothingToPublish") {
        setError(t("knowledgeNetwork.versions.publish.nothingToPublish"));
      } else {
        setError(extractRequestErrorMessage(nextError));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (published) {
    return (
      <Modal
        footer={
          <Button onClick={onClose} type="primary">
            {t("knowledgeNetwork.versions.done")}
          </Button>
        }
        onCancel={onClose}
        open={open}
        title={t("knowledgeNetwork.versions.publish.doneTitle", {
          version: knVersionName(published.version),
        })}
      >
        <Typography.Paragraph>
          {t("knowledgeNetwork.versions.publish.doneBody", {
            version: knVersionName(published.version),
          })}
        </Typography.Paragraph>
        {published.purged_version ? (
          <Alert
            message={t("knowledgeNetwork.versions.publish.purgedNotice", {
              version: knVersionName(published.purged_version),
            })}
            showIcon
            type="info"
          />
        ) : null}
        {published.warnings?.length ? (
          <Alert
            description={
              <ul className={styles.problemList}>
                {published.warnings.map((warning, index) => (
                  <li key={`${warning.definition_id}-${index}`}>
                    {[warning.category, warning.definition_id].filter(Boolean).join(" ")}
                    {warning.description ? `: ${warning.description}` : ""}
                  </li>
                ))}
              </ul>
            }
            message={t("knowledgeNetwork.versions.publish.warnings")}
            showIcon
            type="warning"
          />
        ) : null}
      </Modal>
    );
  }

  const purgesPrevious = !versioning.full_history && versioning.previous_version > 0;

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={submitting}
      destroyOnHidden
      okButtonProps={{ disabled: conflict || (outdated && !confirmedOutdated) }}
      okText={t("knowledgeNetwork.versions.publish.action")}
      onCancel={onClose}
      onOk={() => void submit()}
      open={open}
      title={t("knowledgeNetwork.versions.publish.title")}
      width={1040}
    >
      <div className={styles.diff}>
        {conflict ? (
          <Alert
            action={
              <Button
                onClick={() => {
                  onChanged();
                  onClose();
                }}
                size="small"
              >
                {t("knowledgeNetwork.versions.reload")}
              </Button>
            }
            message={t("knowledgeNetwork.versions.conflict")}
            showIcon
            type="warning"
          />
        ) : null}
        {outdated ? (
          <Alert
            description={
              <Checkbox
                checked={confirmedOutdated}
                onChange={(event) => setConfirmedOutdated(event.target.checked)}
              >
                {t("knowledgeNetwork.versions.publish.confirmOutdated")}
              </Checkbox>
            }
            message={t("knowledgeNetwork.versions.outdated", {
              base: knVersionName(base),
              running: knVersionName(running),
            })}
            showIcon
            type="warning"
          />
        ) : null}
        {purgesPrevious ? (
          <Alert
            message={t("knowledgeNetwork.versions.publish.communityPurge", {
              version: knVersionName(versioning.previous_version),
            })}
            showIcon
            type="info"
          />
        ) : null}
        {hasCapabilities ? (
          <Alert message={t("knowledgeNetwork.versions.capabilityNote")} showIcon type="info" />
        ) : null}
        {againstBase ? (
          <>
            <Typography.Text strong>
              {t("knowledgeNetwork.versions.publish.diffAgainstBase", {
                version: knVersionName(base),
              })}
            </Typography.Text>
            <KnDiffSummary
              baseLabel={knVersionName(base)}
              result={againstBase}
              targetLabel={t("knowledgeNetwork.versions.draft")}
            />
          </>
        ) : null}
        {running > 0 ? (
          <>
            <Typography.Text strong>
              {t("knowledgeNetwork.versions.publish.diffAgainstRunning", {
                version: knVersionName(running),
              })}
            </Typography.Text>
            <KnDiffSummary
              baseLabel={knVersionName(running)}
              error={diffError}
              loading={diffLoading}
              result={againstRunning}
              targetLabel={t("knowledgeNetwork.versions.draft")}
            />
          </>
        ) : (
          <Alert
            message={t("knowledgeNetwork.versions.publish.firstVersion")}
            showIcon
            type="info"
          />
        )}
        <Form<FormValues> form={form} layout="vertical">
          <Form.Item
            label={t("knowledgeNetwork.versions.publish.notes")}
            name="notes"
            rules={[
              {
                required: true,
                whitespace: true,
                message: t("knowledgeNetwork.versions.publish.notesRequired"),
              },
            ]}
          >
            <Input.TextArea maxLength={1000} rows={3} showCount />
          </Form.Item>
          <Form.Item
            extra={t("knowledgeNetwork.versions.publish.labelHint")}
            label={t("knowledgeNetwork.versions.publish.label")}
            name="label"
          >
            <Input maxLength={64} placeholder="v1.0.0" />
          </Form.Item>
        </Form>
        {error ? (
          <Alert
            description={problems.length ? <ProblemList problems={problems} /> : undefined}
            message={error}
            showIcon
            type="error"
          />
        ) : null}
      </div>
    </Modal>
  );
}
