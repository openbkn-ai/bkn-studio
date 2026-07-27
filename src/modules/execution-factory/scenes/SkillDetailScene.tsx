/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  FileZipOutlined,
  HistoryOutlined,
  IdcardOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Layout, Spin, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { SkillDetailSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { DetailBasicInfoButton } from "@/modules/execution-factory/components/DetailBasicInfoButton";
import { EntityListRail } from "@/modules/execution-factory/components/EntityListRail";
import { SkillFilePreview } from "@/modules/execution-factory/components/SkillFilePreview";
import { SkillFileTreeView } from "@/modules/execution-factory/components/SkillFileTreeView";
import { SkillHistoryDrawer } from "@/modules/execution-factory/components/SkillHistoryDrawer";
import {
  downloadSkillPackage,
  getSkill,
  getSkillManagementContent,
  getSkillMarket,
  previewSkillManagementFile,
} from "@/modules/execution-factory/services/skill.service";
import type {
  SkillContentResult,
  SkillFilePreviewResult,
  SkillFileSummary,
  SkillRecord,
  SkillStatus,
} from "@/modules/execution-factory/types/skill";
import {
  formatOptionalTimestamp,
  resolveSkillCategoryLabel,
} from "@/modules/execution-factory/utils/detail-display";
import { formatAuditUserDisplay } from "@/modules/execution-factory/utils/audit-user-display";
import { formatExecutionUnitTime } from "@/modules/execution-factory/utils/format-timestamp";
import { useAuditUserDirectory } from "@/modules/execution-factory/utils/use-audit-user-directory";

import styles from "./toolbox-detail.module.css";

const { Sider, Content } = Layout;

const statusColorMap: Record<SkillStatus, string> = {
  published: "green",
  offline: "default",
  unpublish: "blue",
};

function buildFileEntries(content: SkillContentResult | null): SkillFileSummary[] {
  const summaries = content?.fileSummaries ?? [];
  const hasSkillMd = summaries.some((item) => item.relPath === "SKILL.md");

  if (!hasSkillMd && content?.content) {
    return [{ relPath: "SKILL.md", mimeType: "text/markdown" }, ...summaries];
  }

  if (summaries.length === 0 && content?.content) {
    return [{ relPath: "SKILL.md", mimeType: "text/markdown" }];
  }

  return summaries;
}

export function SkillDetailScene({ skillId, onBack }: SkillDetailSceneProps) {
  const { t } = useTranslation();
  const auditUserDirectory = useAuditUserDirectory();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const catalogContext = searchParams.get("from") === "catalog";
  const [record, setRecord] = useState<SkillRecord | null>(null);
  const [content, setContent] = useState<SkillContentResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<SkillFileSummary | null>(null);
  const [preview, setPreview] = useState<SkillFilePreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contentLoadError, setContentLoadError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [railKeyword, setRailKeyword] = useState("");

  const fileEntries = useMemo(() => buildFileEntries(content), [content]);
  const visibleFileEntries = useMemo(() => {
    const keyword = railKeyword.trim().toLowerCase();

    if (!keyword) {
      return fileEntries;
    }

    return fileEntries.filter((item) => item.relPath.toLowerCase().includes(keyword));
  }, [fileEntries, railKeyword]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setContentLoadError(null);
    setContent(null);
    setSelectedFile(null);
    setPreview(null);
    setPreviewError(null);

    try {
      const nextRecord = catalogContext
        ? await getSkillMarket(skillId)
        : await getSkill(skillId);
      setRecord(nextRecord);

      if (!catalogContext) {
        try {
          setContent(await getSkillManagementContent(skillId));
        } catch (error) {
          setContentLoadError(extractRequestErrorMessage(error));
        }
      }
    } catch (error) {
      setRecord(null);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [catalogContext, skillId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (fileEntries.length === 0) {
      setSelectedFile(null);
      return;
    }

    setSelectedFile((current) => {
      if (current && fileEntries.some((item) => item.relPath === current.relPath)) {
        return current;
      }

      return fileEntries.find((item) => item.relPath === "SKILL.md") ?? fileEntries[0] ?? null;
    });
  }, [fileEntries]);

  useEffect(() => {
    if (!selectedFile || catalogContext) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      setPreview(null);

      try {
        const nextPreview = await previewSkillManagementFile(skillId, selectedFile.relPath, {
          skillMdContent: content?.content,
        });
        if (!cancelled) {
          setPreview(nextPreview);
        }
      } catch (error) {
        if (!cancelled) {
          setPreviewError(extractRequestErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalogContext, content?.content, selectedFile, skillId]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    if (window.history.length > 1) {
      void navigate(-1);
      return;
    }

    void navigate(
      catalogContext
        ? "/execution-factory/catalog?activeTab=skill"
        : "/execution-factory/units?activeTab=skill",
    );
  };

  const statusTag = useMemo(() => {
    if (!record?.status) {
      return null;
    }

    return (
      <Tag color={statusColorMap[record.status]}>
        {t(`executionFactory.skillStatuses.${record.status}`)}
      </Tag>
    );
  }, [record?.status, t]);

  const basicInfoItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return [
      {
        key: "skillId",
        label: t("executionFactory.skillIdLabel"),
        value: record.skillId,
        icon: <IdcardOutlined />,
        variant: "mono" as const,
        span: "full" as const,
      },
      {
        key: "category",
        label: t("executionFactory.category"),
        value: resolveSkillCategoryLabel(record, t),
        icon: <AppstoreOutlined />,
        variant: "accent" as const,
      },
      {
        key: "createUser",
        label: t("executionFactory.createUser"),
        value: formatAuditUserDisplay({ directory: auditUserDirectory, id: record.createUser }),
        icon: <UserOutlined />,
      },
      {
        key: "createTime",
        label: t("executionFactory.createTime"),
        value: formatOptionalTimestamp(record.createTime),
        icon: <CalendarOutlined />,
      },
      {
        key: "updateTime",
        label: t("executionFactory.updateTime"),
        value: formatOptionalTimestamp(record.updateTime),
        icon: <ClockCircleOutlined />,
      },
    ];
  }, [auditUserDirectory, record, t]);

  const handleDownload = async () => {
    if (!record) {
      return;
    }

    setDownloading(true);
    try {
      await downloadSkillPackage(skillId, record.name);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderMain}>
          <button
            aria-label={t("common.back")}
            className={styles.backChevron}
            onClick={handleBack}
            type="button"
          >
            <ArrowLeftOutlined />
          </button>
          <span className={styles.pageHeaderIcon}>
            <FileZipOutlined />
          </span>
          <h1 className={styles.pageHeaderTitle}>
            {record?.name ?? t("executionFactory.skillDetailTitle")}
          </h1>
          {record ? statusTag : null}
          {record?.version ? <Tag>{record.version}</Tag> : null}
        </div>
        {record ? (
          <div className={styles.pageHeaderActions}>
            {/* 进来即可用：不再要求先点「编辑 SKILL」切态。基础信息统一走抽屉；市场预览态（from=catalog）无编辑/历史接口，整块隐藏。 */}
            <DetailBasicInfoButton items={basicInfoItems} />
            {!catalogContext ? (
              <>
            <PermissionGate permissions="execution-factory:skill:view">
              <AppButton icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>
                {t("executionFactory.skillHistoryTitle")}
              </AppButton>
            </PermissionGate>
            <PermissionGate permissions="execution-factory:skill:edit">
              <AppButton
                onClick={() => {
                  void navigate(`/execution-factory/skills/${skillId}/edit`);
                }}
                type="primary"
              >
                {t("executionFactory.cardMenu.edit")}
              </AppButton>
            </PermissionGate>
            <PermissionGate permissions="execution-factory:skill:view">
              <AppButton icon={<DownloadOutlined />} loading={downloading} onClick={() => void handleDownload()}>
                {t("executionFactory.cardMenu.download")}
              </AppButton>
            </PermissionGate>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {record ? (
        <div className={styles.pageSubline}>
          {record.description ? <span>{record.description}</span> : null}
          <span>
            <ThunderboltOutlined />{" "}
            {t("executionFactory.skillFileCountLabel", { count: fileEntries.length })}
          </span>
          <span>
            <ClockCircleOutlined /> {formatExecutionUnitTime(record.updateTime)}
          </span>
        </div>
      ) : null}

      {loadError ? (
        <Alert message={loadError} showIcon style={{ marginBottom: 16 }} type="error" />
      ) : null}

      {catalogContext && !content ? (
        <Alert message={t("executionFactory.skillDetailCatalogContentHint")} showIcon style={{ marginBottom: 16 }} type="warning" />
      ) : null}

      {loading ? (
        <div className={styles.emptyWrap}>
          <Spin size="large" />
        </div>
      ) : record ? (
        <>
          {contentLoadError ? (
            <Alert message={contentLoadError} showIcon style={{ marginBottom: 16 }} type="error" />
          ) : null}

          {fileEntries.length > 0 ? (
            <Layout className={styles.layout}>
              <Sider className={styles.sider} width={320}>
                {/* 与工具 / 函数 / MCP 三处列表栏同一套外壳；文件树有层级，压平成
                    卡片就没了，所以走 EntityListRail 的自绘出口。 */}
                <EntityListRail
                  headLayout="inline"
                  icon={<FileTextOutlined />}
                  search={{
                    onChange: setRailKeyword,
                    placeholder: t("executionFactory.skillFilterFiles"),
                    value: railKeyword,
                  }}
                  title={t("executionFactory.skillFileListTitle", { count: fileEntries.length })}
                >
                  {visibleFileEntries.length === 0 ? (
                    <div className={styles.railEmpty}>
                      {t("executionFactory.skillFileListEmptyFiltered")}
                    </div>
                  ) : (
                    <SkillFileTreeView
                      files={visibleFileEntries}
                      onSelectFile={(relPath) => {
                        const nextFile = fileEntries.find((item) => item.relPath === relPath);
                        if (nextFile) {
                          setSelectedFile(nextFile);
                        }
                      }}
                      selectedPath={selectedFile?.relPath}
                      showFileMeta
                    />
                  )}
                </EntityListRail>
              </Sider>
              <Content className={`${styles.content} ${styles.contentFill}`}>
                <SkillFilePreview
                  downloadUrl={preview?.kind === "binary" ? preview.url : undefined}
                  errorMessage={previewError}
                  loading={previewLoading}
                  relPath={selectedFile?.relPath}
                  text={preview?.kind === "text" ? preview.content : undefined}
                />
              </Content>
            </Layout>
          ) : content?.content ? (
            <div className={`${styles.layout} ${styles.contentFill}`}>
              <SkillFilePreview relPath="SKILL.md" text={content.content} />
            </div>
          ) : (
            <div className={styles.emptyWrap}>
              <Empty description={t("executionFactory.skillContentEmpty")} />
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyWrap}>
          <Empty />
        </div>
      )}

      <SkillHistoryDrawer
        onClose={() => setHistoryOpen(false)}
        onUpdated={() => {
          setHistoryOpen(false);
          void loadDetail();
        }}
        open={historyOpen}
        skillId={skillId}
      />
    </section>
  );
}
