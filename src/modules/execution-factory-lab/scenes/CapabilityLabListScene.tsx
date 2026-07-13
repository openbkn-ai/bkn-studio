/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Collapse, Dropdown, Input, Pagination, Select, Steps, Tag, Tooltip, message } from "antd";
import type { MenuProps } from "antd";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AddFunctionCapabilityDrawer } from "@/modules/execution-factory-lab/components/AddFunctionCapabilityDrawer";
import { AddHttpCapabilityDrawer } from "@/modules/execution-factory-lab/components/AddHttpCapabilityDrawer";
import { CapabilityCard } from "@/modules/execution-factory-lab/components/CapabilityCard";
import { CapabilityCardSkeleton } from "@/modules/execution-factory-lab/components/CapabilityCardSkeleton";
import { CapabilityDetailDrawer } from "@/modules/execution-factory-lab/components/CapabilityDetailDrawer";
import { ImportImpexDrawer } from "@/modules/execution-factory-lab/components/ImportImpexDrawer";
import { ImportOpenApiDrawer } from "@/modules/execution-factory-lab/components/ImportOpenApiDrawer";
import { ImportSkillDrawer } from "@/modules/execution-factory-lab/components/ImportSkillDrawer";
import { LabFilterHint } from "@/modules/execution-factory-lab/components/LabFilterHint";
import { LabPermissionHint } from "@/modules/execution-factory-lab/components/LabPermissionHint";
import { RegisterMcpDrawer } from "@/modules/execution-factory-lab/components/RegisterMcpDrawer";
import { useLabListFilters } from "@/modules/execution-factory-lab/hooks/useLabListFilters";
import { useLabFeatures } from "@/modules/execution-factory-lab/hooks/useLabFeatures";
import { executionFactoryLabPermissions } from "@/modules/execution-factory-lab/permissions";
import {
  getCapability,
  listCapabilities,
  listGroups,
} from "@/modules/execution-factory-lab/services/capabilities-lab.service";
import { createMenuPermissionForKey } from "@/modules/execution-factory-lab/utils/create-menu-permissions";
import type { CapabilityRecord } from "@/modules/execution-factory-lab/types/capability";

import styles from "./capability-lab.module.css";

function menuLabel(title: string, description: string) {
  return (
    <div>
      <div>{title}</div>
      <div className={styles.menuItemDesc}>{description}</div>
    </div>
  );
}

export function CapabilityLabListScene() {
  const { t } = useTranslation();
  const location = useLocation();
  const { features } = useLabFeatures();
  const { runtimeConfig } = useAppServices();
  const userPermissions = useMemo(
    () => runtimeConfig.currentUser.permissions ?? [],
    [runtimeConfig.currentUser.permissions],
  );
  const {
    kind,
    setKind,
    status,
    setStatus,
    keyword,
    setKeyword,
    groupId,
    setGroupId,
    clearAll: clearStoredFilters,
  } = useLabListFilters("all");
  const [items, setItems] = useState<CapabilityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [functionOpen, setFunctionOpen] = useState(false);
  const [impexOpen, setImpexOpen] = useState(false);
  const [selected, setSelected] = useState<CapabilityRecord | undefined>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [detailInitialTab, setDetailInitialTab] = useState("overview");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listCapabilities({
        kind,
        keyword,
        groupId,
        status,
        page,
        pageSize,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : t("executionFactoryLab.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [groupId, keyword, kind, page, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listGroups().then(setGroups).catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    const state = location.state as { openCapabilityId?: string } | null;
    if (!state?.openCapabilityId) {
      return;
    }

    void getCapability(state.openCapabilityId)
      .then((cap) => {
        setSelected(cap);
        setDetailOpen(true);
        setHighlightIds([cap.id]);
        window.setTimeout(() => setHighlightIds([]), 3000);
      })
      .catch(() => {
        // Ignore navigation state errors; list remains usable.
      })
      .finally(() => {
        window.history.replaceState({}, document.title);
      });
  }, [location.state]);

  const openCreatedCapability = useCallback(
    async (
      capability: CapabilityRecord,
      successMessageKey: string,
      options?: { highlightIds?: string[]; initialTab?: string },
    ) => {
      message.success(t(successMessageKey));
      const ids = options?.highlightIds ?? [capability.id];
      setHighlightIds(ids);
      window.setTimeout(() => setHighlightIds([]), 3000);
      setDetailInitialTab(options?.initialTab ?? "overview");
      setSelected(capability);
      setDetailOpen(true);
      await load();
    },
    [load, t],
  );

  const debugTabForKind = (capKind: CapabilityRecord["kind"]) =>
    capKind === "http" || capKind === "mcp" || capKind === "function" ? "debug" : "overview";

  const hasActiveFilters =
    keyword.trim() !== "" || kind !== "all" || status !== "all" || Boolean(groupId);

  const clearFilters = () => {
    clearStoredFilters();
    setPage(1);
  };

  const canUseMenuItem = useCallback(
    (key: string) =>
      hasPermissions({
        currentPermissions: userPermissions,
        requiredPermissions: createMenuPermissionForKey(key),
      }),
    [userPermissions],
  );

  const buildMenuItem = useCallback(
    (
      key: string,
      title: string,
      description: string,
      onClick: () => void,
    ) => ({
      key,
      disabled: !canUseMenuItem(key),
      label: menuLabel(title, description),
      onClick: canUseMenuItem(key) ? onClick : undefined,
    }),
    [canUseMenuItem],
  );

  const advancedChildren = useMemo(() => {
    const children = [];
    if (features.function) {
      children.push(
        buildMenuItem(
          "function",
          t("executionFactoryLab.addFunctionTitle"),
          t("executionFactoryLab.addFunctionDesc"),
          () => setFunctionOpen(true),
        ),
      );
    }
    if (features.impex) {
      children.push(
        buildMenuItem(
          "impex",
          t("executionFactoryLab.importImpexTitle"),
          t("executionFactoryLab.importImpexDesc"),
          () => setImpexOpen(true),
        ),
      );
    }
    return children;
  }, [buildMenuItem, features.function, features.impex, t]);

  const addMenuItems: MenuProps["items"] = [
    {
      type: "group",
      label: t("executionFactoryLab.createMenuGroupApi"),
      children: [
        buildMenuItem(
          "http",
          t("executionFactoryLab.addHttpCapability"),
          t("executionFactoryLab.addHttpCapabilityDesc"),
          () => setAddOpen(true),
        ),
        buildMenuItem(
          "import",
          t("executionFactoryLab.importOpenApiTitle"),
          t("executionFactoryLab.importOpenApiDesc"),
          () => setImportOpen(true),
        ),
      ],
    },
    {
      type: "group",
      label: t("executionFactoryLab.createMenuGroupExt"),
      children: [
        buildMenuItem(
          "mcp",
          t("executionFactoryLab.registerMcpTitle"),
          t("executionFactoryLab.registerMcpDesc"),
          () => setMcpOpen(true),
        ),
        buildMenuItem(
          "skill",
          t("executionFactoryLab.importSkillTitle"),
          t("executionFactoryLab.importSkillDesc"),
          () => setSkillOpen(true),
        ),
      ],
    },
    ...(advancedChildren.length > 0
      ? [
          {
            type: "group" as const,
            label: t("executionFactoryLab.createMenuGroupAdvanced"),
            children: advancedChildren,
          },
        ]
      : []),
  ];

  const kindOptions = [
    { value: "all", label: t("executionFactoryLab.kindFilterAll") },
    { value: "http", label: t("executionFactoryLab.kindFilterHttp") },
    { value: "mcp", label: t("executionFactoryLab.kindFilterMcp") },
    { value: "skill", label: t("executionFactoryLab.kindFilterSkill") },
    ...(features.function
      ? [{ value: "function", label: t("executionFactoryLab.kindFilterFunction") }]
      : []),
  ];

  const statusOptions = [
    { value: "all", label: t("executionFactoryLab.statusFilterAll") },
    { value: "published", label: t("executionFactoryLab.statusPublished") },
    { value: "draft", label: t("executionFactoryLab.statusDraft") },
    { value: "offline", label: t("executionFactoryLab.statusOffline") },
  ];

  const listContent = (
    <section className={styles.page}>
      <div className={styles.intro}>
        <div className={styles.introTitleRow}>
          <h2 className={styles.introTitle}>{t("executionFactoryLab.capabilitiesTitle")}</h2>
          <Tooltip title={t("executionFactoryLab.experimentBadgeTooltip")}>
            <Tag className={styles.experimentTag}>{t("executionFactoryLab.experimentBadge")}</Tag>
          </Tooltip>
        </div>
        <p className={styles.introDescription}>
          {t("executionFactoryLab.capabilitiesDescription")}
        </p>
        <Collapse
          className={styles.dualTrackCollapse}
          ghost
          items={[
            {
              key: "dual-track",
              label: t("executionFactoryLab.dualTrackTitle"),
              children: <p style={{ margin: 0 }}>{t("executionFactoryLab.dualTrackBody")}</p>,
            },
          ]}
        />
      </div>

      {error ? <Alert message={error} showIcon type="error" /> : null}

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <Tooltip title={t("executionFactoryLab.kindFilterHint")}>
            <Select
              disabled={loading}
              onChange={(value) => {
                setKind(value);
                setPage(1);
              }}
              options={kindOptions}
              style={{ width: 160 }}
              value={kind}
            />
          </Tooltip>
          <Select
            allowClear={false}
            disabled={loading}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={statusOptions}
            placeholder={t("executionFactoryLab.statusFilter")}
            style={{ width: 140 }}
            value={status}
          />
          <div>
            <LabFilterHint
              label={t("executionFactoryLab.groupFilter")}
              tooltip={t("executionFactoryLab.groupFilterHint")}
            />
            <Select
              allowClear
              disabled={loading}
              onChange={(value) => {
                setGroupId(value || undefined);
                setPage(1);
              }}
              options={[
                { value: "", label: t("executionFactoryLab.groupFilterAll") },
                ...groups.map((group) => ({ value: group.id, label: group.name })),
              ]}
              placeholder={t("executionFactoryLab.groupFilter")}
              style={{ marginTop: 4, width: 200 }}
              value={groupId ?? ""}
            />
          </div>
          <Input.Search
            allowClear
            disabled={loading}
            onSearch={(value) => {
              setKeyword(value.trim());
              setPage(1);
            }}
            placeholder={t("executionFactoryLab.searchPlaceholder")}
            style={{ width: 260 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <LabPermissionHint permissions={executionFactoryLabPermissions.capabilityCreate}>
          <Dropdown menu={{ items: addMenuItems }}>
            <AppButton type="primary">{t("executionFactoryLab.addCapability")}</AppButton>
          </Dropdown>
        </LabPermissionHint>
      </div>

      {loading && items.length === 0 ? <CapabilityCardSkeleton /> : null}

      {!loading && total === 0 ? (
        <div className={styles.empty}>
          <p>
            {hasActiveFilters
              ? t("executionFactoryLab.emptyFiltered")
              : t("executionFactoryLab.emptyCapabilities")}
          </p>
          {!hasActiveFilters ? (
            <div className={styles.emptySteps}>
              <Steps
                direction="vertical"
                items={[
                  {
                    title: t("executionFactoryLab.emptyStepCatalog"),
                    description: t("executionFactoryLab.emptyStepCatalogDesc"),
                  },
                  {
                    title: t("executionFactoryLab.emptyStepDebug"),
                    description: t("executionFactoryLab.emptyStepDebugDesc"),
                  },
                  {
                    title: t("executionFactoryLab.emptyStepPublish"),
                    description: t("executionFactoryLab.emptyStepPublishDesc"),
                  },
                ]}
                size="small"
              />
            </div>
          ) : null}
          <div className={styles.emptyActions}>
            {hasActiveFilters ? (
              <AppButton onClick={clearFilters}>{t("executionFactoryLab.clearFiltersAction")}</AppButton>
            ) : (
              <>
                <LabPermissionHint permissions={executionFactoryLabPermissions.capabilityCreate}>
                  <AppButton onClick={() => setAddOpen(true)} type="primary">
                    {t("executionFactoryLab.addCapability")}
                  </AppButton>
                </LabPermissionHint>
                {features.catalog ? (
                  <Link to="/execution-factory-lab/catalog">
                    <AppButton>{t("executionFactoryLab.emptyCatalogCta")}</AppButton>
                  </Link>
                ) : null}
                {features.impex ? (
                  <LabPermissionHint permissions={executionFactoryLabPermissions.impexImport}>
                    <AppButton onClick={() => setImpexOpen(true)}>
                      {t("executionFactoryLab.importImpexTitle")}
                    </AppButton>
                  </LabPermissionHint>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : !loading ? (
        <div className={styles.grid}>
          {items.map((capability) => (
            <CapabilityCard
              capability={capability}
              highlighted={highlightIds.includes(capability.id)}
              key={capability.id}
              onClick={(item) => {
                setSelected(item);
                setDetailInitialTab("overview");
                setDetailOpen(true);
              }}
            />
          ))}
        </div>
      ) : null}

      {total > 0 ? (
        <Pagination
          current={page}
          disabled={loading}
          onChange={(next) => setPage(next)}
          pageSize={pageSize}
          showSizeChanger={false}
          style={{ marginTop: 16, textAlign: "right" }}
          total={total}
        />
      ) : null}

      <AddHttpCapabilityDrawer
        onClose={() => setAddOpen(false)}
        onCreated={(capability) =>
          void openCreatedCapability(capability, "executionFactoryLab.createSuccess", {
            initialTab: debugTabForKind(capability.kind),
          })
        }
        open={addOpen}
      />

      <ImportOpenApiDrawer
        onClose={() => setImportOpen(false)}
        onImported={(capability, allCapabilities) =>
          void openCreatedCapability(capability, "executionFactoryLab.createSuccessOpenApi", {
            highlightIds: allCapabilities.map((item) => item.id),
            initialTab: debugTabForKind(capability.kind),
          })
        }
        open={importOpen}
      />

      <RegisterMcpDrawer
        onClose={() => setMcpOpen(false)}
        onRegistered={(capability) =>
          void openCreatedCapability(capability, "executionFactoryLab.createSuccessMcp", {
            initialTab: "debug",
          })
        }
        open={mcpOpen}
      />

      <ImportSkillDrawer
        onClose={() => setSkillOpen(false)}
        onImported={(capability) =>
          void openCreatedCapability(capability, "executionFactoryLab.createSuccessSkill")
        }
        open={skillOpen}
      />

      <AddFunctionCapabilityDrawer
        onClose={() => setFunctionOpen(false)}
        onCreated={(capability) =>
          void openCreatedCapability(capability, "executionFactoryLab.createSuccessFunction", {
            initialTab: "debug",
          })
        }
        open={functionOpen}
      />

      <ImportImpexDrawer
        onClose={() => setImpexOpen(false)}
        onImported={() => {
          message.success(t("executionFactoryLab.importImpexSuccess"));
          void load();
        }}
        open={impexOpen}
      />

      <CapabilityDetailDrawer
        capability={selected}
        initialTab={detailInitialTab}
        onClose={() => {
          setDetailOpen(false);
          setDetailInitialTab("overview");
        }}
        onUpdated={() => void load()}
        open={detailOpen}
      />
    </section>
  );

  return (
    <PermissionGate
      fallback={
        <section className={styles.page}>
          <Alert
            message={t("executionFactoryLab.permissionDeniedHint")}
            showIcon
            type="warning"
          />
        </section>
      }
      permissions={executionFactoryLabPermissions.capabilityView}
    >
      {listContent}
    </PermissionGate>
  );
}
