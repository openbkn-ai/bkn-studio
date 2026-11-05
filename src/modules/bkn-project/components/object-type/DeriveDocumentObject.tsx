/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { Alert, Checkbox, Input, Modal, Select, Space } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppButton } from "@/framework/ui/common/AppButton";
import { requestFailureText } from "@/modules/bkn-project/components/publish/messages";
import { deriveDocumentObject } from "@/modules/bkn-project/services/draft.service";
import type { Draft, DraftObjectType } from "@/modules/bkn-project/types/draft";

const P = "bknProject.documentDerivation";
export function DeriveDocumentObject({
  draft,
  object,
  projectId,
  disabled,
  onDerived,
}: {
  draft: Draft;
  object: DraftObjectType;
  projectId: string;
  disabled: boolean;
  onDerived: (draft: Draft) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"entity" | "file">("entity");
  const [name, setName] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [identity, setIdentity] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!["entity", "file", "in_document"].includes(object.document?.role ?? "")) return null;
  const available = object.properties.filter((p) => !p.readOnly);
  const identifiers = available.filter(
    (p) =>
      fields.includes(p.name) && ["string", "text", "integer", "unsigned integer"].includes(p.type),
  );
  const ready =
    name.trim() &&
    fields.length > 0 &&
    confirmed &&
    (role === "file" || identifiers.some((p) => p.name === identity));
  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    // Names stay business-facing; collision-safe API names remain internal.
    const used = new Set(
      [...draft.items.objectTypes, ...draft.items.relationTypes].map((item) => item.id),
    );
    let id = "";
    for (let i = 1; !id; i++) {
      const suffix = `_${role === "entity" ? "current" : "claim"}_${i}_doc`;
      const candidate = object.id.slice(0, 40 - suffix.length) + suffix;
      if (!used.has(candidate)) id = candidate;
    }
    try {
      const next = await deriveDocumentObject(projectId, draft, object, {
        id,
        name: name.trim(),
        role,
        fields,
        identity: role === "entity" ? identity : "",
        confirm: true,
      });
      setOpen(false);
      onDerived(next);
    } catch (e) {
      setError(requestFailureText(t, e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AppButton
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          setName("");
          setFields([]);
          setIdentity("");
          setConfirmed(false);
          setError("");
        }}
      >
        {t(`${P}.open`)}
      </AppButton>
      <Modal
        open={open}
        title={t(`${P}.open`)}
        onCancel={() => {
          if (!busy) setOpen(false);
        }}
        onOk={() => void save()}
        confirmLoading={busy}
        okText={t(`${P}.create`)}
        okButtonProps={{ disabled: !ready || busy }}
        closable={!busy}
        maskClosable={!busy}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert type="info" showIcon message={t(`${P}.help`)} />
          {error && <Alert type="error" message={error} />}
          <label>
            {t(`${P}.role`)}
            <Select
              aria-label={t(`${P}.role`)}
              value={role}
              disabled={busy}
              style={{ width: "100%" }}
              options={[
                { value: "entity", label: t(`${P}.entity`) },
                { value: "file", label: t(`${P}.file`) },
              ]}
              onChange={(next) => {
                setRole(next);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            {t(`${P}.name`)}
            <Input
              aria-label={t(`${P}.name`)}
              value={name}
              maxLength={128}
              disabled={busy}
              onChange={(e) => {
                setName(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            {t(`${P}.fields`)}
            <Select
              aria-label={t(`${P}.fields`)}
              mode="multiple"
              value={fields}
              disabled={busy}
              style={{ width: "100%" }}
              options={available.map((p) => ({ value: p.name, label: p.displayName }))}
              onChange={(next) => {
                setFields(next);
                setConfirmed(false);
                if (!next.includes(identity)) setIdentity("");
              }}
            />
          </label>
          {role === "entity" && (
            <label>
              {t(`${P}.identity`)}
              <Select
                aria-label={t(`${P}.identity`)}
                value={identity || undefined}
                disabled={busy}
                style={{ width: "100%" }}
                options={identifiers.map((p) => ({ value: p.name, label: p.displayName }))}
                onChange={(next) => {
                  setIdentity(next);
                  setConfirmed(false);
                }}
              />
            </label>
          )}
          <Checkbox
            checked={confirmed}
            disabled={busy}
            onChange={(e) => setConfirmed(e.target.checked)}
          >
            {t(`${P}.confirm`)}
          </Checkbox>
        </Space>
      </Modal>
    </>
  );
}
