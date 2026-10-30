/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Modal, Spin } from "antd";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { propertyTypeKey } from "@/modules/bkn-project/components/draft/evidence";
import { draftSourceChanges, getSourceChanges } from "@/modules/bkn-project/services/draft.service";
import { getProjectStatus, projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import type { Draft, SourceChanges, SourceColumnChange } from "@/modules/bkn-project/types/draft";
import type { ProjectNextAction } from "@/modules/bkn-project/types/publish";

import styles from "./SourceChanges.module.css";

const PREFIX = "bknProject.model.sourceChanges";

const ERRORS = new Set([
  "NotOwner",
  "NoSourceChanges",
  "NotReady",
  "ProjectArchived",
  "SourceUnreachable",
]);

/** One column change in business words: the property or column by its name, then what follows. */
function changeText(t: TFunction, change: SourceColumnChange) {
  const property = change.propertyName || change.property;
  const field = change.fieldName || change.field;
  const type = (value: string) => t(propertyTypeKey(value));
  const main =
    change.change === "added"
      ? t(`${PREFIX}.added`, { field })
      : change.change === "removed"
        ? t(`${PREFIX}.removed`, { property })
        : change.change === "retyped"
          ? t(`${PREFIX}.retyped`, {
              from: type(change.fromType),
              property,
              to: type(change.toType),
            })
          : t(`${PREFIX}.otherChange`, { field });
  const notes = [
    change.excluded
      ? t(`${PREFIX}.excluded.${change.excluded === "privacy" ? "privacy" : "type"}`)
      : "",
    change.unsupported ? t(`${PREFIX}.unsupported`) : "",
    change.key ? t(`${PREFIX}.key`) : "",
    change.relations.length
      ? t(`${PREFIX}.relations`, {
          names: change.relations.map((item) => item.name).join(t("bknProject.listSeparator")),
        })
      : "",
  ].filter(Boolean);
  return [main, ...notes].join(t(`${PREFIX}.join`));
}

/**
 * Says when the tables the draft binds changed since it was drafted, and offers to write the
 * changes into the draft. Writing keeps every decision; the draft is then confirmed and published
 * again as usual.
 */
export function SourceChangesNotice({
  archived,
  draftUpdateTime,
  onDrafted,
  projectId,
}: {
  archived: boolean;
  /** The draft as shown; the project's state is read again whenever it changes. */
  draftUpdateTime: number;
  onDrafted: (draft: Draft) => void;
  projectId: string;
}) {
  const { t } = useTranslation();
  const [action, setAction] = useState<ProjectNextAction | null>(null);
  const [changed, setChanged] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getProjectStatus(projectId)
      .then((status) => {
        if (active) {
          setChanged(status.stale.includes("source_changed"));
          setAction(
            status.nextActions.find((item) => item.action === "draft_source_changes") ?? null,
          );
        }
      })
      // Without the state the notice stays away; the rest of the page does not depend on it.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [draftUpdateTime, projectId]);

  if (!changed && !action) {
    return null;
  }
  return (
    <>
      <Alert
        action={
          <AppButton onClick={() => setOpen(true)} size="small">
            {t(`${PREFIX}.view`)}
          </AppButton>
        }
        message={t(`${PREFIX}.notice`)}
        showIcon
        type="warning"
      />
      {open ? (
        <SourceChangesDialog
          canDraft={!archived && action?.allowed !== false}
          onClose={() => setOpen(false)}
          onDrafted={(draft) => {
            setOpen(false);
            setChanged(false);
            setAction(null);
            onDrafted(draft);
          }}
          projectId={projectId}
        />
      ) : null}
    </>
  );
}

function SourceChangesDialog({
  canDraft,
  onClose,
  onDrafted,
  projectId,
}: {
  canDraft: boolean;
  onClose: () => void;
  onDrafted: (draft: Draft) => void;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [changes, setChanges] = useState<SourceChanges | null>(null);
  const [failed, setFailed] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setChanges(null);
    try {
      setChanges(await getSourceChanges(projectId));
    } catch {
      setFailed(true);
    }
  }, [projectId]);
  useEffect(() => {
    void load();
  }, [load]);

  const draft = async () => {
    if (!changes) {
      return;
    }
    setDrafting(true);
    try {
      onDrafted(await draftSourceChanges(projectId, changes.signature));
      message.success(t(`${PREFIX}.done`));
    } catch (error) {
      const code = projectErrorCode(error) ?? "";
      const name = code.slice(code.lastIndexOf(".") + 1);
      if (name === "SourceChangesOutdated") {
        // The draft or a table moved since the read: show what is there now, to write again.
        message.warning(t(`${PREFIX}.outdated`));
        void load();
      } else {
        message.error(t(`${PREFIX}.error.${ERRORS.has(name) ? name : "other"}`));
      }
    } finally {
      setDrafting(false);
    }
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={drafting}
      destroyOnHidden
      // Whether anything is left to write is the server's to say (NoSourceChanges).
      okButtonProps={{ disabled: !canDraft || changes?.state !== "changed" }}
      okText={t(`${PREFIX}.draft`)}
      onCancel={onClose}
      onOk={() => void draft()}
      open
      title={t(`${PREFIX}.title`)}
      width={720}
    >
      {failed ? (
        <Alert
          action={
            <AppButton onClick={() => void load()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={t(`${PREFIX}.loadFailed`)}
          showIcon
          type="error"
        />
      ) : !changes ? (
        <Spin />
      ) : changes.state === "unreachable" ? (
        <Alert message={t(`${PREFIX}.unreachable`)} showIcon type="warning" />
      ) : changes.state === "in_step" ? (
        <p className={styles.muted}>{t(`${PREFIX}.inStep`)}</p>
      ) : (
        <div className={styles.stack}>
          <p className={styles.muted}>{t(`${PREFIX}.explain`)}</p>
          {changes.objectTypes.map((objectType) => (
            <section className={styles.stack} key={objectType.id}>
              <span className={styles.title}>
                {t(`${PREFIX}.objectType`, { name: objectType.name, table: objectType.table })}
              </span>
              {objectType.inDraft ? null : (
                <span className={styles.muted}>{t(`${PREFIX}.onlyPublished`)}</span>
              )}
              <ul className={styles.changeList}>
                {objectType.changes.map((change) => (
                  <li key={`${change.change}:${change.field}:${change.property}`}>
                    {changeText(t, change)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {changes.relationTypes.length ? (
            <ul className={styles.changeList}>
              {changes.relationTypes.map((relation) => (
                <li key={relation.id}>
                  {t(`${PREFIX}.relationLost`, {
                    fields: relation.removed.join(t("bknProject.listSeparator")),
                    name: relation.name,
                  })}
                </li>
              ))}
            </ul>
          ) : null}
          {changes.missingTables.length ? (
            <p className={styles.muted}>
              {t(`${PREFIX}.missingTables`, {
                names: changes.missingTables
                  .map((item) => item.name)
                  .join(t("bknProject.listSeparator")),
              })}
            </p>
          ) : null}
          {canDraft ? null : <p className={styles.muted}>{t(`${PREFIX}.ownerOnly`)}</p>}
        </div>
      )}
    </Modal>
  );
}
