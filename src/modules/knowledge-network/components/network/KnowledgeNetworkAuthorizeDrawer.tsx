/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Drawer, Empty, Popconfirm, Select, Spin, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  KNOWLEDGE_NETWORK_GRANTABLE_OPERATIONS,
  listKnowledgeNetworkGrants,
  removeKnowledgeNetworkGrant,
  searchKnowledgeNetworkGrantableUsers,
  setKnowledgeNetworkGrant,
  type GrantableUser,
  type KnowledgeNetworkGrant,
} from "@/modules/knowledge-network/services/authorization.service";

import styles from "./KnowledgeNetworkAuthorizeDrawer.module.css";

type KnowledgeNetworkAuthorizeDrawerProps = {
  networkId: string;
  networkName: string;
  onClose: () => void;
  open: boolean;
};

/** Operations only an administrator can hand out, shown read-only so a grant never looks truncated. */
const NON_GRANTABLE_OPERATIONS = new Set(["authorize", "create"]);

function displayAccessor(grant: KnowledgeNetworkGrant) {
  if (grant.account && grant.name && grant.name !== grant.account) {
    return `${grant.name} (${grant.account})`;
  }
  return grant.account || grant.name || grant.accessorId;
}

/**
 * Sharing panel for one knowledge network, opened by its owner.
 *
 * It is deliberately not the platform authorization page in miniature: there is no object picker,
 * because the object is the network you opened it from, and no platform-wide listing. What an owner
 * needs is "who can reach my network, and with what", so that is the whole screen.
 *
 * The current grants are loaded before anything can be edited, because the write is a REPLACE:
 * submitting a checkbox set that was not seeded from the existing one would silently drop
 * operations someone already had.
 */
export function KnowledgeNetworkAuthorizeDrawer({
  networkId,
  networkName,
  onClose,
  open,
}: KnowledgeNetworkAuthorizeDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();

  const [grants, setGrants] = useState<KnowledgeNetworkGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [candidates, setCandidates] = useState<GrantableUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [selectedOps, setSelectedOps] = useState<string[]>(["view_detail"]);
  const [editingAccessorId, setEditingAccessorId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!networkId) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      setGrants(await listKnowledgeNetworkGrants(networkId));
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  const searchUsers = useCallback(
    async (keyword: string) => {
      if (!networkId) {
        return;
      }
      setSearching(true);
      try {
        setCandidates(await searchKnowledgeNetworkGrantableUsers(networkId, keyword));
      } catch {
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    },
    [networkId],
  );

  useEffect(() => {
    if (!open) {
      setEditingAccessorId(null);
      setSelectedUserId(undefined);
      setSelectedOps(["view_detail"]);
      setCandidates([]);
      return;
    }
    void load();
    void searchUsers("");
  }, [load, open, searchUsers]);

  // Someone who already has the network must not be added twice: the second grant would replace the
  // first, which reads as "added" but is really "overwrote". Editing is the explicit path for that.
  const grantedIds = useMemo(
    () => new Set(grants.map((grant) => grant.accessorId)),
    [grants],
  );
  const userOptions = useMemo(
    () =>
      candidates
        .filter((user) => editingAccessorId === user.id || !grantedIds.has(user.id))
        .map((user) => ({
          label: user.name && user.name !== user.account ? `${user.name} (${user.account})` : user.account,
          value: user.id,
        })),
    [candidates, editingAccessorId, grantedIds],
  );

  const startEdit = (grant: KnowledgeNetworkGrant) => {
    setEditingAccessorId(grant.accessorId);
    setSelectedUserId(grant.accessorId);
    // Seed from what they hold today, minus what this surface cannot write back.
    setSelectedOps(grant.operations.filter((op) => !NON_GRANTABLE_OPERATIONS.has(op)));
  };

  const resetForm = () => {
    setEditingAccessorId(null);
    setSelectedUserId(undefined);
    setSelectedOps(["view_detail"]);
  };

  const handleSubmit = async () => {
    if (!selectedUserId) {
      void message.error(t("knowledgeNetwork.authorizePickUser"));
      return;
    }
    if (selectedOps.length === 0) {
      void message.error(t("knowledgeNetwork.authorizePickOperation"));
      return;
    }
    setSaving(true);
    try {
      await setKnowledgeNetworkGrant(networkId, selectedUserId, selectedOps);
      void message.success(t("knowledgeNetwork.authorizeSaved"));
      resetForm();
      await load();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (grant: KnowledgeNetworkGrant) => {
    setSaving(true);
    try {
      await removeKnowledgeNetworkGrant(networkId, grant.accessorId);
      void message.success(t("knowledgeNetwork.authorizeRemoved"));
      if (editingAccessorId === grant.accessorId) {
        resetForm();
      }
      await load();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      onClose={onClose}
      open={open}
      title={t("knowledgeNetwork.authorizeTitle", { name: networkName })}
      width={560}
    >
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t("knowledgeNetwork.authorizeCurrent")}</div>
        {loadError ? <Alert message={loadError} showIcon type="error" /> : null}
        <Spin spinning={loading}>
          {grants.length === 0 && !loading ? (
            <Empty
              description={t("knowledgeNetwork.authorizeEmpty")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <ul className={styles.grantList}>
              {grants.map((grant) => (
                <li className={styles.grantRow} key={grant.accessorId}>
                  <div className={styles.grantWho}>{displayAccessor(grant)}</div>
                  <div className={styles.grantOps}>
                    {grant.operations.map((op) => (
                      <Tag key={op}>{t(`knowledgeNetwork.authorizeOp.${op}`, op)}</Tag>
                    ))}
                  </div>
                  <div className={styles.grantActions}>
                    <AppButton onClick={() => startEdit(grant)} size="small" type="link">
                      {t("common.edit")}
                    </AppButton>
                    <Popconfirm
                      onConfirm={() => void handleRemove(grant)}
                      title={t("knowledgeNetwork.authorizeRemoveConfirm")}
                    >
                      <AppButton danger size="small" type="link">
                        {t("common.delete")}
                      </AppButton>
                    </Popconfirm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Spin>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {editingAccessorId
            ? t("knowledgeNetwork.authorizeEditTitle")
            : t("knowledgeNetwork.authorizeAddTitle")}
        </div>
        <Select
          disabled={Boolean(editingAccessorId)}
          filterOption={false}
          loading={searching}
          notFoundContent={searching ? <Spin size="small" /> : null}
          onChange={setSelectedUserId}
          onSearch={(keyword) => void searchUsers(keyword)}
          options={userOptions}
          placeholder={t("knowledgeNetwork.authorizeUserPlaceholder")}
          showSearch
          style={{ width: "100%" }}
          value={selectedUserId}
        />
        <Checkbox.Group
          className={styles.opGroup}
          onChange={(values) => setSelectedOps(values)}
          options={KNOWLEDGE_NETWORK_GRANTABLE_OPERATIONS.map((op) => ({
            label: t(`knowledgeNetwork.authorizeOp.${op}`, op),
            value: op,
          }))}
          value={selectedOps}
        />
        <div className={styles.hint}>{t("knowledgeNetwork.authorizeReplaceHint")}</div>
        <div className={styles.formActions}>
          <AppButton loading={saving} onClick={() => void handleSubmit()} type="primary">
            {editingAccessorId ? t("common.save") : t("knowledgeNetwork.authorizeAdd")}
          </AppButton>
          {editingAccessorId ? (
            <AppButton onClick={resetForm}>{t("common.cancel")}</AppButton>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}
