import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Checkbox, Empty, Input, Select, Tag } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import type { ResourceGrant, ResourceRef } from "@/modules/system-admin/types/admin";
import {
  operationLabel,
  operationsForType,
  RESOURCE_TYPES,
  resourceTypeLabel,
  WILDCARD,
} from "@/modules/system-admin/utils/resource-catalog";

import styles from "@/modules/system-admin/scenes/admin.module.css";

type ResourceGrantEditorProps = {
  disabled?: boolean;
  /** 锁定到某条资源（如数据连接授权）：仅可选 operations。 */
  lockedResource?: ResourceRef;
  onChange: (next: ResourceGrant[]) => void;
  value: ResourceGrant[];
};

const sameResource = (a: ResourceRef, b: ResourceRef) => a.type === b.type && a.id === b.id;

export function ResourceGrantEditor({
  disabled,
  lockedResource,
  onChange,
  value,
}: ResourceGrantEditorProps) {
  const { t } = useTranslation();
  const [draftType, setDraftType] = useState<string>(lockedResource?.type ?? RESOURCE_TYPES[0].type);
  const [draftId, setDraftId] = useState<string>(lockedResource?.id ?? WILDCARD);
  const [wholeType, setWholeType] = useState<boolean>(!lockedResource);
  const [draftOps, setDraftOps] = useState<string[]>([]);

  const ops = useMemo(() => operationsForType(draftType), [draftType]);

  const resolvedId = lockedResource ? lockedResource.id : wholeType ? WILDCARD : draftId.trim();

  const addGrant = () => {
    if (!draftOps.length || (!lockedResource && !wholeType && !draftId.trim())) {
      return;
    }
    const resource: ResourceRef = { type: draftType, id: resolvedId };
    const existing = value.find((grant) => sameResource(grant.resource, resource));
    const next = existing
      ? value.map((grant) =>
          grant === existing
            ? { ...grant, operations: Array.from(new Set([...grant.operations, ...draftOps])) }
            : grant,
        )
      : [...value, { resource, operations: [...draftOps] }];
    onChange(next);
    setDraftOps([]);
    if (!lockedResource && !wholeType) {
      setDraftId("");
    }
  };

  const removeGrant = (grant: ResourceGrant) => {
    onChange(value.filter((item) => item !== grant));
  };

  return (
    <div className={styles.grantEditor}>
      {value.length ? (
        <div className={styles.grantList}>
          {value.map((grant, index) => (
            <div className={styles.grantItem} key={`${grant.resource.type}:${grant.resource.id}:${index}`}>
              <div className={styles.grantMeta}>
                <Tag className={styles.roleTag}>{resourceTypeLabel(grant.resource.type)}</Tag>
                <span className={styles.slugChip}>
                  {grant.resource.id === WILDCARD ? t("systemAdmin.grant.wholeType") : grant.resource.id}
                </span>
              </div>
              <div className={styles.chipRow}>
                {grant.operations.map((op) => (
                  <Tag className={styles.permChip} key={op}>
                    {grant.resource.id === WILDCARD || op === "*"
                      ? op === "*"
                        ? t("systemAdmin.grant.allOps")
                        : operationLabel(grant.resource.type, op)
                      : operationLabel(grant.resource.type, op)}
                  </Tag>
                ))}
              </div>
              {!disabled ? (
                <AppButton
                  className={[styles.actionLink, styles.actionDanger].join(" ")}
                  icon={<DeleteOutlined />}
                  onClick={() => removeGrant(grant)}
                  size="small"
                  type="link"
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("systemAdmin.grant.empty")}
          style={{ margin: "8px 0" }}
        />
      )}

      {!disabled ? (
        <div className={styles.grantAddRow}>
          {!lockedResource ? (
            <>
              <Select
                onChange={(type) => {
                  setDraftType(type);
                  setDraftOps([]);
                }}
                options={RESOURCE_TYPES.map((item) => ({ label: item.label, value: item.type }))}
                style={{ minWidth: 160 }}
                value={draftType}
              />
              <Input
                disabled={wholeType}
                onChange={(event) => setDraftId(event.target.value)}
                placeholder={t("systemAdmin.grant.resourceIdPlaceholder")}
                style={{ flex: 1, minWidth: 140 }}
                value={wholeType ? "" : draftId}
              />
              <Checkbox checked={wholeType} onChange={(event) => setWholeType(event.target.checked)}>
                {t("systemAdmin.grant.wholeType")}
              </Checkbox>
            </>
          ) : null}
          <Select
            mode="multiple"
            onChange={setDraftOps}
            options={ops.map((op) => ({ label: op.label, value: op.key }))}
            placeholder={t("systemAdmin.grant.operationsPlaceholder")}
            style={{ flex: 1, minWidth: 200 }}
            value={draftOps}
          />
          <AppButton icon={<PlusOutlined />} onClick={addGrant} type="primary">
            {t("systemAdmin.grant.add")}
          </AppButton>
        </div>
      ) : null}
    </div>
  );
}
