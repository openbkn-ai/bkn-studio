/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Empty, Input, Modal, Spin, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { isCommunityBuild } from "@/framework/entitlement/types";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ResourcePermissionRequestAction } from "@/modules/knowledge-network/components/shared/ResourcePermissionRequestAction";
import { canRequestResourcePermission } from "@/modules/knowledge-network/components/shared/resource-permission-request";
import { attachKnowledgeNetworkCapabilities } from "@/modules/knowledge-network/services/capability-binding.service";
import {
  KNOWLEDGE_BASE_QUERY_OPERATION,
  listQueryableKnowledgeBases,
  type QueryableKnowledgeBase,
} from "@/modules/knowledge-network/services/knowledge-base.service";
import {
  knowledgeBaseBindingFailure,
  type KnowledgeBaseBindingFailure,
} from "@/modules/knowledge-network/utils/knowledge-base-binding-error";

import styles from "./KnowledgeBaseListPanel.module.css";

/** Someone who could pick a knowledge base can see it; querying it is what they may lack. */
const SEEN_OPERATIONS = ["view_detail"];

/**
 * Picks knowledge bases to mount. Only ones the caller may query are offered: mounting another
 * would be refused. Ones already mounted stay listed, ticked and disabled, so the list matches
 * what people know is there.
 */
export function KnowledgeBasePicker({
  mountedIds,
  networkId,
  onClose,
  onMounted,
}: {
  mountedIds: ReadonlySet<string>;
  networkId: string;
  onClose: () => void;
  onMounted: () => void;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const permissionRequestsEnabled = !isCommunityBuild(useEntitlement());
  const [keyword, setKeyword] = useState("");
  const [searched, setSearched] = useState("");
  const [items, setItems] = useState<QueryableKnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [listFailure, setListFailure] = useState<KnowledgeBaseBindingFailure | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState<KnowledgeBaseBindingFailure | null>(null);

  const load = useCallback(async (name: string) => {
    setLoading(true);
    setListFailure(null);
    try {
      setItems(await listQueryableKnowledgeBases(name));
      setSearched(name.trim());
    } catch (error) {
      setListFailure(knowledgeBaseBindingFailure(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  const mount = async () => {
    setSaving(true);
    setSaveFailure(null);
    try {
      const created = await attachKnowledgeNetworkCapabilities(
        networkId,
        selected.map((capabilityId) => ({ capabilityId, capabilityType: "knowledge_base" })),
      );
      void (created.length
        ? message.success(
            t("knowledgeNetwork.knowledgeBasesPicker.success", { count: created.length }),
          )
        : message.info(t("knowledgeNetwork.knowledgeBasesPicker.nothingNew")));
      onMounted();
    } catch (error) {
      setSaveFailure(knowledgeBaseBindingFailure(error));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, id] : current.filter((candidate) => candidate !== id),
    );

  const selectedItems = items.filter((item) => selected.includes(item.id));
  const canRequest = canRequestResourcePermission(
    "knowledge_base",
    SEEN_OPERATIONS,
    permissionRequestsEnabled,
  );

  let body;
  if (loading) {
    body = <Spin />;
  } else if (listFailure) {
    body = (
      <Alert
        action={
          <AppButton onClick={() => void load(keyword)} size="small">
            {t("common.retry")}
          </AppButton>
        }
        description={t(`knowledgeNetwork.knowledgeBasesFailure.${listFailure}`)}
        message={t("knowledgeNetwork.knowledgeBasesPicker.loadFailed")}
        showIcon
        type="warning"
      />
    );
  } else if (!items.length) {
    body = (
      <Empty
        description={
          searched
            ? t("knowledgeNetwork.knowledgeBasesPicker.noMatch", { keyword: searched })
            : t("knowledgeNetwork.knowledgeBasesPicker.none")
        }
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  } else {
    body = (
      <div className={styles.pickerList}>
        {items.map((item) => {
          const mounted = mountedIds.has(item.id);
          return (
            <label className={styles.pickerItem} key={item.id}>
              <Checkbox
                checked={mounted || selected.includes(item.id)}
                disabled={mounted || saving}
                onChange={(event) => toggle(item.id, event.target.checked)}
              />
              <span className={styles.pickerText}>
                <span>
                  {item.name}{" "}
                  {mounted ? <Tag>{t("knowledgeNetwork.knowledgeBasesPicker.mounted")}</Tag> : null}
                </span>
                {item.description ? <span className={styles.muted}>{item.description}</span> : null}
                {item.documentCount !== undefined ? (
                  <span className={styles.muted}>
                    {t("knowledgeNetwork.knowledgeBasesPicker.documents", {
                      count: item.documentCount,
                    })}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <Modal
      confirmLoading={saving}
      okButtonProps={{ disabled: selected.length === 0 }}
      okText={t("knowledgeNetwork.knowledgeBasesPicker.confirm")}
      onCancel={onClose}
      onOk={() => void mount()}
      open
      title={t("knowledgeNetwork.knowledgeBasesPicker.title")}
    >
      <p className={styles.hint}>{t("knowledgeNetwork.knowledgeBasesPicker.hint")}</p>
      <Input.Search
        allowClear
        onChange={(event) => setKeyword(event.target.value)}
        onSearch={(value) => void load(value)}
        placeholder={t("knowledgeNetwork.knowledgeBasesPicker.search")}
        value={keyword}
      />
      {saveFailure ? (
        <Alert
          className={styles.hint}
          description={
            saveFailure === "noPermission" && canRequest ? (
              <div className={styles.requests}>
                {selectedItems.map((item) => (
                  <span key={item.id}>
                    {t("knowledgeNetwork.knowledgeBasesPicker.requestFor", { name: item.name })}
                    <ResourcePermissionRequestAction
                      initialOperations={[KNOWLEDGE_BASE_QUERY_OPERATION]}
                      operations={SEEN_OPERATIONS}
                      resourceID={item.id}
                      resourceName={item.name}
                      resourceType="knowledge_base"
                      trigger="text"
                    />
                  </span>
                ))}
              </div>
            ) : undefined
          }
          message={t(`knowledgeNetwork.knowledgeBasesFailure.${saveFailure}`)}
          showIcon
          type="error"
        />
      ) : null}
      {body}
    </Modal>
  );
}
