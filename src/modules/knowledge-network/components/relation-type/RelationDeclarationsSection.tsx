/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Collapse, Form, Input, Radio, Select, Tag, Tooltip } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { listKnowledgeNetworkRelationTypePage } from "@/modules/knowledge-network/services/relation-type.service";
import type {
  KnowledgeNetworkRelationTypeRecord,
  RelationCharacteristic,
  RelationDeclarations,
  RelationEnd,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  CARDINALITY_LABEL_KEYS,
  type ClearedRelationDeclaration,
  fitRelationDeclarations,
  hasSameEnds,
  isSymmetric,
  normalizeRelationDeclarations,
  RELATION_CARDINALITIES,
  RELATION_CHARACTERISTICS,
  type RelationEnds,
  SYMMETRIC_CARDINALITIES,
} from "@/modules/knowledge-network/utils/relation-declarations";
import { isDeprecated } from "@/modules/knowledge-network/utils/definition-declarations";

import styles from "./RelationDeclarationsSection.module.css";
import { useRelationSentence } from "./use-relation-sentence";

const PREFIX = "knowledgeNetwork.relationDeclarations";
const PANEL_KEY = "relation-declarations";

/** The backend's limit on a reverse name, the same as on a relation's other names. */
export const REVERSE_NAME_MAX_LENGTH = 40;

type ClearedNotice =
  { kind: "ends" } | { kind: "symmetric"; names: ClearedRelationDeclaration[] } | null;

type RelationDeclarationsSectionProps = {
  ends: RelationEnds;
  networkId: string;
  onChange: (value: RelationDeclarations | undefined) => void;
  /** Opens the section, as a refused save does. */
  refused?: boolean;
  /** The relation type edited, which is no fallback path for itself; absent while creating. */
  relationTypeId?: string;
  relationName: string;
  sourceName: string;
  targetName: string;
  value: RelationDeclarations | undefined;
};

export function RelationDeclarationsSection({
  ends,
  networkId,
  onChange,
  refused,
  relationTypeId,
  relationName,
  sourceName,
  targetName,
  value,
}: RelationDeclarationsSectionProps) {
  const { t } = useTranslation();
  // The join basis is not edited here, so a relation declaring only that reads as not declared.
  const declared = Boolean(normalizeRelationDeclarations({ ...value, verification: undefined }));
  const [open, setOpen] = useState(declared);
  const [notice, setNotice] = useState<ClearedNotice>(null);
  const [candidates, setCandidates] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const sameEnds = hasSameEnds(ends);
  const symmetric = isSymmetric(value);
  const secondary = value?.importance === "secondary";
  const sentence = useRelationSentence(value, { source: sourceName, target: targetName });

  useEffect(() => {
    if (refused) {
      setOpen(true);
    }
  }, [refused]);

  // Characteristics belong to a relation from an object type to itself: other ends clear them.
  // Only a change of ends clears here; the handlers below keep the rest in shape.
  const { sourceObjectTypeId, targetObjectTypeId } = ends;
  const previousEnds = useRef(`${sourceObjectTypeId}\u0000${targetObjectTypeId}`);
  useEffect(() => {
    const key = `${sourceObjectTypeId}\u0000${targetObjectTypeId}`;
    // Ends being chosen again, as after a change of mapping mode, keep what they may allow.
    if (previousEnds.current === key || !sourceObjectTypeId || !targetObjectTypeId) {
      return;
    }
    previousEnds.current = key;
    const { cleared, value: next } = fitRelationDeclarations(value, {
      sourceObjectTypeId,
      targetObjectTypeId,
    });
    if (cleared.length) {
      onChange(next);
      setNotice({ kind: "ends" });
    }
  }, [onChange, sourceObjectTypeId, targetObjectTypeId, value]);

  useEffect(() => {
    if (!secondary || !ends.sourceObjectTypeId || !ends.targetObjectTypeId) {
      setCandidates([]);
      return;
    }
    let active = true;
    setCandidatesLoading(true);
    void listKnowledgeNetworkRelationTypePage(networkId, {
      direction: "asc",
      limit: -1,
      offset: 0,
      sort: "name",
      sourceObjectTypeId: ends.sourceObjectTypeId,
      targetObjectTypeId: ends.targetObjectTypeId,
    })
      .then((page) => {
        if (active) {
          // The backend checks the rest: the primary's cardinality, a second fallback path.
          setCandidates(
            page.entries.filter(
              (item) =>
                item.id !== relationTypeId &&
                item.declarations?.importance !== "secondary" &&
                !isDeprecated({ declarations: item.definitionDeclarations }),
            ),
          );
        }
      })
      .catch(() => {
        if (active) {
          setCandidates([]);
        }
      })
      .finally(() => {
        if (active) {
          setCandidatesLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [ends.sourceObjectTypeId, ends.targetObjectTypeId, networkId, relationTypeId, secondary]);

  const update = (patch: Partial<RelationDeclarations>) => onChange({ ...value, ...patch });

  const handleCharacteristicsChange = (next: RelationCharacteristic[]) => {
    const { cleared, value: fittedValue } = fitRelationDeclarations(
      { ...value, characteristics: next },
      ends,
    );
    onChange(fittedValue);
    setNotice(cleared.length ? { kind: "symmetric", names: cleared } : null);
  };

  const fallbackOptions = useMemo(() => {
    const options = candidates.map((item) => ({
      label: t(`${PREFIX}.fallbackForOption`, { id: item.id, name: item.name }),
      value: item.id,
    }));
    const current = value?.fallbackFor;
    if (current && !candidatesLoading && !candidates.some((item) => item.id === current)) {
      options.push({ label: t(`${PREFIX}.fallbackForMissing`, { id: current }), value: current });
    }
    return options;
  }, [candidates, candidatesLoading, t, value?.fallbackFor]);

  const endName = (end: RelationEnd) => (end === "source" ? sourceName : targetName);
  const requiredEnds = value?.requiredEnds ?? [];

  const noticeText =
    notice?.kind === "ends"
      ? t(`${PREFIX}.cleared.ends`)
      : notice?.kind === "symmetric"
        ? t(`${PREFIX}.cleared.symmetric`, {
            names: notice.names
              .map((name) => t(`${PREFIX}.clearedName.${name}`))
              .join(t(`${PREFIX}.separator`)),
          })
        : null;

  const body = (
    <Form colon={false} component="div" layout="vertical">
      {noticeText ? (
        <Alert
          className={styles.cleared}
          closable
          message={noticeText}
          onClose={() => setNotice(null)}
          showIcon
          type="info"
        />
      ) : null}
      {symmetric ? null : (
        <Form.Item
          label={t(`${PREFIX}.reverseName`)}
          tooltip={t(`${PREFIX}.reverseNameHint`, { name: relationName })}
        >
          <Input
            maxLength={REVERSE_NAME_MAX_LENGTH}
            onChange={(event) => update({ reverseName: event.target.value })}
            showCount
            value={value?.reverseName ?? ""}
          />
        </Form.Item>
      )}
      <div className={styles.row}>
        <Form.Item
          label={t(`${PREFIX}.cardinality`)}
          // What the declared cardinality and required ends mean, or what a cardinality is.
          tooltip={sentence ?? t(`${PREFIX}.cardinalityHint`)}
        >
          <Select
            allowClear
            aria-label={t(`${PREFIX}.cardinality`)}
            onChange={(next?: RelationDeclarations["cardinality"]) => update({ cardinality: next })}
            options={(symmetric ? SYMMETRIC_CARDINALITIES : RELATION_CARDINALITIES).map(
              (cardinality) => ({
                label: t(`${PREFIX}.cardinalityOption.${CARDINALITY_LABEL_KEYS[cardinality]}`),
                value: cardinality,
              }),
            )}
            placeholder={t(`${PREFIX}.notDeclared`)}
            value={value?.cardinality}
          />
        </Form.Item>
        <Form.Item label={t(`${PREFIX}.requiredEnds`)} tooltip={t(`${PREFIX}.requiredEndsHint`)}>
          {symmetric ? (
            <Checkbox
              checked={requiredEnds.length === 2}
              onChange={(event) =>
                update({ requiredEnds: event.target.checked ? ["source", "target"] : undefined })
              }
            >
              {t(`${PREFIX}.requiredBoth`)}
            </Checkbox>
          ) : (
            <Checkbox.Group
              className={styles.stack}
              onChange={(next) => update({ requiredEnds: next })}
              options={(["source", "target"] as const).map((end) => ({
                // The end by name; what checking it means is on hover.
                label: (
                  <Tooltip
                    title={t(`${PREFIX}.requiredEnd.${end}`, {
                      source: endName("source"),
                      target: endName("target"),
                    })}
                  >
                    <span>{t(`${PREFIX}.requiredEndOption.${end}`, { name: endName(end) })}</span>
                  </Tooltip>
                ),
                value: end,
              }))}
              value={requiredEnds}
            />
          )}
        </Form.Item>
      </div>
      {sameEnds ? (
        <Form.Item
          label={t(`${PREFIX}.characteristics`)}
          tooltip={t(`${PREFIX}.characteristicsHint`)}
        >
          <Checkbox.Group
            onChange={(next) => handleCharacteristicsChange(next)}
            options={RELATION_CHARACTERISTICS.map((characteristic) => ({
              label: (
                <Tooltip title={t(`${PREFIX}.characteristicHint.${characteristic}`)}>
                  <span>{t(`${PREFIX}.characteristic.${characteristic}`)}</span>
                </Tooltip>
              ),
              value: characteristic,
            }))}
            value={value?.characteristics ?? []}
          />
        </Form.Item>
      ) : null}
      <div className={styles.row}>
        <Form.Item label={t(`${PREFIX}.importance`)} tooltip={t(`${PREFIX}.importanceHint`)}>
          <Radio.Group
            onChange={(event) =>
              update(
                event.target.value === "secondary"
                  ? { importance: "secondary" }
                  : { fallbackFor: undefined, importance: undefined },
              )
            }
            options={(["primary", "secondary"] as const).map((importance) => ({
              label: t(`${PREFIX}.importanceOption.${importance}`),
              value: importance,
            }))}
            value={secondary ? "secondary" : "primary"}
          />
        </Form.Item>
        {secondary ? (
          <Form.Item label={t(`${PREFIX}.fallbackFor`)} tooltip={t(`${PREFIX}.fallbackForHint`)}>
            <Select
              allowClear
              aria-label={t(`${PREFIX}.fallbackFor`)}
              loading={candidatesLoading}
              onChange={(next?: string) => update({ fallbackFor: next })}
              options={fallbackOptions}
              placeholder={t(`${PREFIX}.fallbackForNone`)}
              value={value?.fallbackFor}
            />
          </Form.Item>
        ) : null}
      </div>
    </Form>
  );

  return (
    <Collapse
      activeKey={open ? [PANEL_KEY] : []}
      className={styles.section}
      items={[
        {
          children: body,
          forceRender: true,
          key: PANEL_KEY,
          label: (
            <span className={styles.title}>
              {t(`${PREFIX}.title`)}
              {declared ? null : (
                <Tag className={styles.undeclared}>{t(`${PREFIX}.notDeclared`)}</Tag>
              )}
            </span>
          ),
        },
      ]}
      onChange={(keys) => setOpen((Array.isArray(keys) ? keys : [keys]).includes(PANEL_KEY))}
    />
  );
}
