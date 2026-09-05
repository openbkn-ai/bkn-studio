/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApartmentOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  PartitionOutlined,
  QuestionCircleOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Modal, Tooltip, message } from "antd";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { AppButton } from "@/framework/ui/common/AppButton";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import type { PermissionCheckMode } from "@/framework/permission/has-permissions";
import { canAccessHomeAction } from "@/modules/home/lib/action-access";
import { systemAdminPermissions } from "@/modules/system-admin/permissions";
import {
  readHomeBuildState,
  type HomeBuildStage,
  writeHomeBuildState,
} from "@/modules/home/lib/build-path-state";

import styles from "./HomeScene.module.css";

type BuildStageId = HomeBuildStage;

type BuildStage = {
  id: BuildStageId;
  icon: ReactNode;
  required: Array<{
    descriptionKey: string;
    impactKey: string;
    outcomeKey: string;
    optional?: boolean;
    path: string;
    permissionMode?: PermissionCheckMode;
    permissions?: string | string[];
    showDetails?: boolean;
    summaryKey?: string;
    titleKey: string;
  }>;
};

const PLATFORM_STAGES: BuildStage[] = [
  {
    id: "environment",
    icon: <SafetyCertificateOutlined />,
    required: [
      {
        descriptionKey: "home.platform.stages.environment.required.permission.description",
        impactKey: "home.platform.stages.environment.required.permission.impact",
        outcomeKey: "home.platform.stages.environment.required.permission.outcome",
        path: "/system/users",
        permissionMode: "any",
        permissions: systemAdminPermissions.users,
        showDetails: false,
        summaryKey: "home.platform.stages.environment.required.permission.summary",
        titleKey: "home.platform.stages.environment.required.permission.title",
      },
      {
        descriptionKey: "home.platform.stages.environment.required.largeModel.description",
        impactKey: "home.platform.stages.environment.required.largeModel.impact",
        outcomeKey: "home.platform.stages.environment.required.largeModel.outcome",
        path: "/model-resources/models?tab=llm",
        permissions: "model-resources:large-model:view",
        summaryKey: "home.platform.stages.environment.required.largeModel.summary",
        titleKey: "home.platform.stages.environment.required.largeModel.title",
      },
      {
        descriptionKey: "home.platform.stages.environment.required.smallModel.description",
        impactKey: "home.platform.stages.environment.required.smallModel.impact",
        outcomeKey: "home.platform.stages.environment.required.smallModel.outcome",
        path: "/model-resources/models?tab=small-model",
        permissions: "model-resources:small-model:view",
        summaryKey: "home.platform.stages.environment.required.smallModel.summary",
        titleKey: "home.platform.stages.environment.required.smallModel.title",
      },
    ],
  },
  {
    id: "data",
    icon: <DatabaseOutlined />,
    required: [
      {
        descriptionKey: "home.platform.stages.data.required.connection.description",
        impactKey: "home.platform.stages.data.required.connection.impact",
        outcomeKey: "home.platform.stages.data.required.connection.outcome",
        path: "/data-connect",
        permissionMode: "any",
        permissions: [
          "catalog:view_detail",
          "catalog:create",
          "catalog:modify",
          "catalog:delete",
        ],
        summaryKey: "home.platform.stages.data.required.connection.summary",
        titleKey: "home.platform.stages.data.required.connection.title",
      },
      {
        descriptionKey: "home.platform.stages.data.required.discovery.description",
        impactKey: "home.platform.stages.data.required.discovery.impact",
        outcomeKey: "home.platform.stages.data.required.discovery.outcome",
        path: "/data-connect/discover",
        permissionMode: "any",
        permissions: "catalog:task_manage",
        summaryKey: "home.platform.stages.data.required.discovery.summary",
        titleKey: "home.platform.stages.data.required.discovery.title",
      },
      {
        descriptionKey: "home.platform.stages.data.required.semanticUnderstanding.description",
        impactKey: "home.platform.stages.data.required.semanticUnderstanding.impact",
        outcomeKey: "home.platform.stages.data.required.semanticUnderstanding.outcome",
        optional: true,
        path: "/data-directory",
        permissionMode: "any",
        permissions: ["catalog:view_detail", "resource:view_detail"],
        summaryKey: "home.platform.stages.data.required.semanticUnderstanding.summary",
        titleKey: "home.platform.stages.data.required.semanticUnderstanding.title",
      },
      {
        descriptionKey: "home.platform.stages.data.required.indexBuild.description",
        impactKey: "home.platform.stages.data.required.indexBuild.impact",
        outcomeKey: "home.platform.stages.data.required.indexBuild.outcome",
        optional: true,
        path: "/data-directory",
        permissionMode: "any",
        permissions: ["catalog:task_manage"],
        summaryKey: "home.platform.stages.data.required.indexBuild.summary",
        titleKey: "home.platform.stages.data.required.indexBuild.title",
      },
    ],
  },
  {
    id: "model",
    icon: <PartitionOutlined />,
    required: [
      {
        descriptionKey: "home.platform.stages.model.required.network.description",
        impactKey: "home.platform.stages.model.required.network.impact",
        outcomeKey: "home.platform.stages.model.required.network.outcome",
        path: "/knowledge-network",
        permissionMode: "any",
        permissions: [
          "knowledge-network:view",
          "knowledge-network:create",
          "knowledge-network:edit",
          "knowledge-network:delete",
          "knowledge-network:import",
          "knowledge-network:export",
          "knowledge-network:preview",
          "knowledge-network:concept-group:view",
          "knowledge-network:metric:view",
          "knowledge-network:metric:create",
          "knowledge-network:metric:edit",
          "knowledge-network:metric:delete",
          "knowledge-network:metric:query",
        ],
        showDetails: false,
        summaryKey: "home.platform.stages.model.required.network.summary",
        titleKey: "home.platform.stages.model.required.network.title",
      },
      {
        descriptionKey: "home.platform.stages.model.required.conceptGroup.description",
        impactKey: "home.platform.stages.model.required.conceptGroup.impact",
        outcomeKey: "home.platform.stages.model.required.conceptGroup.outcome",
        optional: true,
        path: "/knowledge-network",
        permissionMode: "any",
        permissions: [
          "knowledge-network:view",
          "knowledge-network:concept-group:view",
          "knowledge-network:metric:view",
        ],
        summaryKey: "home.platform.stages.model.required.conceptGroup.summary",
        titleKey: "home.platform.stages.model.required.conceptGroup.title",
      },
      {
        descriptionKey: "home.platform.stages.model.required.objectType.description",
        impactKey: "home.platform.stages.model.required.objectType.impact",
        outcomeKey: "home.platform.stages.model.required.objectType.outcome",
        path: "/knowledge-network",
        permissionMode: "any",
        permissions: [
          "knowledge-network:view",
          "knowledge-network:preview",
          "knowledge-network:concept-group:view",
          "knowledge-network:metric:view",
        ],
        showDetails: false,
        summaryKey: "home.platform.stages.model.required.objectType.summary",
        titleKey: "home.platform.stages.model.required.objectType.title",
      },
      {
        descriptionKey: "home.platform.stages.model.required.relationType.description",
        impactKey: "home.platform.stages.model.required.relationType.impact",
        outcomeKey: "home.platform.stages.model.required.relationType.outcome",
        optional: true,
        path: "/knowledge-network",
        permissionMode: "any",
        permissions: [
          "knowledge-network:view",
          "knowledge-network:preview",
          "knowledge-network:concept-group:view",
          "knowledge-network:metric:view",
        ],
        summaryKey: "home.platform.stages.model.required.relationType.summary",
        titleKey: "home.platform.stages.model.required.relationType.title",
      },
      {
        descriptionKey: "home.platform.stages.model.required.metric.description",
        impactKey: "home.platform.stages.model.required.metric.impact",
        outcomeKey: "home.platform.stages.model.required.metric.outcome",
        optional: true,
        path: "/knowledge-network",
        permissionMode: "any",
        permissions: [
          "knowledge-network:view",
          "knowledge-network:metric:view",
          "knowledge-network:metric:query",
        ],
        summaryKey: "home.platform.stages.model.required.metric.summary",
        titleKey: "home.platform.stages.model.required.metric.title",
      },
      {
        descriptionKey: "home.platform.stages.model.required.metricExecutionTool.description",
        impactKey: "home.platform.stages.model.required.metricExecutionTool.impact",
        outcomeKey: "home.platform.stages.model.required.metricExecutionTool.outcome",
        optional: true,
        path: "/execution-factory/units",
        permissionMode: "any",
        permissions: ["execution-factory:operator:view", "execution-factory:toolbox:view"],
        summaryKey: "home.platform.stages.model.required.metricExecutionTool.summary",
        titleKey: "home.platform.stages.model.required.metricExecutionTool.title",
      },
      {
        descriptionKey: "home.platform.stages.model.required.actionType.description",
        impactKey: "home.platform.stages.model.required.actionType.impact",
        outcomeKey: "home.platform.stages.model.required.actionType.outcome",
        optional: true,
        path: "/knowledge-network",
        permissionMode: "any",
        permissions: [
          "knowledge-network:create",
          "knowledge-network:edit",
          "knowledge-network:delete",
          "knowledge-network:import",
          "knowledge-network:export",
          "knowledge-network:preview",
          "knowledge-network:concept-group:view",
          "knowledge-network:metric:view",
          "knowledge-network:metric:create",
          "knowledge-network:metric:edit",
          "knowledge-network:metric:delete",
          "knowledge-network:metric:query",
        ],
        summaryKey: "home.platform.stages.model.required.actionType.summary",
        titleKey: "home.platform.stages.model.required.actionType.title",
      },
    ],
  },
  {
    id: "validate",
    icon: <CheckCircleOutlined />,
    required: [
      {
        descriptionKey: "home.platform.stages.validate.required.chat.description",
        impactKey: "home.platform.stages.validate.required.chat.impact",
        optional: true,
        outcomeKey: "home.platform.stages.validate.required.chat.outcome",
        path: "/knowledge-network",
        permissionMode: "any",
        permissions: [
          "knowledge-network:create",
          "knowledge-network:edit",
          "knowledge-network:delete",
          "knowledge-network:import",
          "knowledge-network:export",
          "knowledge-network:preview",
          "knowledge-network:concept-group:view",
          "knowledge-network:metric:view",
          "knowledge-network:metric:create",
          "knowledge-network:metric:edit",
          "knowledge-network:metric:delete",
          "knowledge-network:metric:query",
        ],
        titleKey: "home.platform.stages.validate.required.chat.title",
      },
      {
        descriptionKey: "home.platform.stages.validate.required.mcpDebug.description",
        impactKey: "home.platform.stages.validate.required.mcpDebug.impact",
        optional: true,
        outcomeKey: "home.platform.stages.validate.required.mcpDebug.outcome",
        path: "/knowledge-network",
        permissionMode: "any",
        permissions: [
          "knowledge-network:preview",
          "knowledge-network:metric:query",
        ],
        titleKey: "home.platform.stages.validate.required.mcpDebug.title",
      },
      {
        descriptionKey: "home.platform.stages.validate.required.traceAnalysis.description",
        impactKey: "home.platform.stages.validate.required.traceAnalysis.impact",
        optional: true,
        outcomeKey: "home.platform.stages.validate.required.traceAnalysis.outcome",
        path: "/observability/business-provenance",
        titleKey: "home.platform.stages.validate.required.traceAnalysis.title",
      },
      {
        descriptionKey: "home.platform.stages.validate.required.integration.description",
        impactKey: "home.platform.stages.validate.required.integration.impact",
        optional: true,
        outcomeKey: "home.platform.stages.validate.required.integration.outcome",
        path: "/knowledge-network/integration",
        permissionMode: "any",
        permissions: [
          "knowledge-network:create",
          "knowledge-network:edit",
          "knowledge-network:delete",
          "knowledge-network:import",
          "knowledge-network:export",
          "knowledge-network:preview",
          "knowledge-network:concept-group:view",
          "knowledge-network:metric:view",
          "knowledge-network:metric:create",
          "knowledge-network:metric:edit",
          "knowledge-network:metric:delete",
          "knowledge-network:metric:query",
        ],
        titleKey: "home.platform.stages.validate.required.integration.title",
      },
    ],
  },
];

const ENGINEERING_SKILLS = [
  {
    command: "npx skills add https://github.com/openbkn-ai/bkn-engineering --skill bkn-requirement",
    icon: <FileTextOutlined />,
    id: "requirement",
  },
  {
    command: "npx skills add https://github.com/openbkn-ai/bkn-engineering --skill bkn-ontology-builder",
    icon: <ApartmentOutlined />,
    id: "ontologyBuilder",
  },
  {
    command: "npx skills add https://github.com/openbkn-ai/bkn-engineering --skill bkn-creator",
    icon: <RocketOutlined />,
    id: "creator",
  },
] as const;

function greetingKey(hour: number, hasName: boolean) {
  const suffix = hasName ? "" : "Anonymous";

  if (hour < 12) {
    return `home.greeting.morning${suffix}`;
  }

  if (hour < 18) {
    return `home.greeting.afternoon${suffix}`;
  }

  return `home.greeting.evening${suffix}`;
}

export function HomeScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const runtimeConfig = useRuntimeConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);
  const { path: activePath, stage: activeStage } = readHomeBuildState(searchParams);

  const userName = runtimeConfig.currentUser.name?.trim();
  const greeting = userName
    ? t(greetingKey(new Date().getHours(), true), { name: userName })
    : t(greetingKey(new Date().getHours(), false));
  const currentStage = PLATFORM_STAGES.find((stage) => stage.id === activeStage) ?? PLATFORM_STAGES[0];

  const copyInstallCommand = (command: string) => {
    void writeTextToClipboard(command).then(
      () => message.success(t("home.engineering.install.copied")),
      () => message.error(t("home.engineering.install.copyFailed")),
    );
  };

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <h1>{greeting}</h1>
          <p className={styles.introduction}>{t("home.introduction")}</p>
        </div>
      </header>

      <div className={styles.pathTabsOuter}>
        <div className={styles.pathTabs} role="tablist" aria-label={t("home.pathLabel")}>
          {(["engineering", "platform"] as const).map((path) => (
            <button
              aria-selected={activePath === path}
              className={activePath === path ? styles.pathTabActive : styles.pathTab}
              key={path}
              onClick={() => setSearchParams(writeHomeBuildState(searchParams, { path, stage: activeStage }))}
              role="tab"
              type="button"
            >
              {t(`home.paths.${path}.title`)}
            </button>
          ))}
        </div>
      </div>

      <main className={styles.content}>
        <div className={styles.contentInner}>
          {activePath === "platform" ? (
          <section aria-labelledby="platform-build-title" className={styles.buildArea}>
            <div className={styles.sectionHeading}>
              <div>
                <h2 id="platform-build-title">{t("home.paths.platform.heading")}</h2>
                <p className={styles.platformDescription}>{t("home.paths.platform.description")}</p>
              </div>
              <div className={styles.sectionActionSpacer} aria-hidden />
            </div>

            <ol className={styles.stageRail}>
              {PLATFORM_STAGES.map((stage, index) => (
                <li className={styles.stageRailItem} key={stage.id}>
                  <button
                    aria-current={activeStage === stage.id ? "step" : undefined}
                    className={activeStage === stage.id ? styles.stageButtonActive : styles.stageButton}
                    onClick={() => setSearchParams(writeHomeBuildState(searchParams, { path: "platform", stage: stage.id }))}
                    type="button"
                  >
                    <span className={styles.stageNumber}>{index + 1}</span>
                    <span className={styles.stageFlowIcon} aria-hidden>{stage.icon}</span>
                    <span className={styles.stageCopy}>
                      <strong>{t(`home.platform.stages.${stage.id}.title`)}</strong>
                      <small>{t(`home.platform.stages.${stage.id}.summary`)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <div className={styles.stageDetail}>
              <div className={styles.actionSectionHeader}>
                <h3>{t("home.platform.required")}</h3>
                <p>{t(`home.platform.stages.${currentStage.id}.detail`)}</p>
              </div>

              <div className={styles.actionList}>
                {currentStage.required.map((action, index) => {
                  const actionAllowed = canAccessHomeAction(
                    runtimeConfig.currentUser.permissions,
                    action,
                  );
                  const actionButton = (
                    <button
                      aria-disabled={!actionAllowed}
                      className={styles.actionNavigate}
                      disabled={!actionAllowed}
                      onClick={() => void navigate(action.path)}
                      type="button"
                    >
                      <span className={styles.actionOrdinal}>{index + 1}</span>
                      <span className={styles.actionMain}>
                        <strong>
                          {t(action.titleKey)}
                          {action.optional ? <span className={styles.optionalBadge}>{t("home.platform.optional")}</span> : null}
                        </strong>
                        <small>{t(action.summaryKey ?? action.descriptionKey)}</small>
                      </span>
                      <ArrowRightOutlined aria-hidden />
                    </button>
                  );

                  return (
                    <div className={styles.actionRowCompact} key={action.titleKey}>
                      {actionAllowed ? actionButton : (
                        <Tooltip title={t("home.platform.noPermission")}>
                          <span className={styles.actionNavigateTarget}>{actionButton}</span>
                        </Tooltip>
                      )}
                      {action.showDetails !== false ? (
                        <Tooltip
                          autoAdjustOverflow
                          color="var(--color-bg-surface)"
                          overlayClassName={styles.actionDetailsTooltip}
                          placement="left"
                          title={(
                            <div className={styles.actionTooltipContent}>
                              <p>
                                <strong>{t("home.platform.configurationLabel")}</strong>
                                {t(action.descriptionKey)}
                              </p>
                              <p>
                                <strong>{t("home.platform.roleLabel")}</strong>
                                {t(action.outcomeKey)}
                              </p>
                              <p>
                                <strong>{t("home.platform.impactLabel")}</strong>
                                {t(action.impactKey)}
                              </p>
                            </div>
                          )}
                        >
                          <button
                            aria-label={t("home.platform.details")}
                            className={styles.actionHelp}
                            type="button"
                          >
                            <QuestionCircleOutlined />
                          </button>
                        </Tooltip>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
          ) : (
          <section aria-labelledby="engineering-build-title" className={styles.buildArea}>
            <div className={styles.sectionHeading}>
              <div>
                <h2 id="engineering-build-title">{t("home.paths.engineering.heading")}</h2>
                <p>{t("home.paths.engineering.description")}</p>
              </div>
              <AppButton
                className={styles.sectionAction}
                onClick={() => setSkillsModalOpen(true)}
              >
                {t("home.engineering.install.trigger")}
              </AppButton>
            </div>

            <ol className={styles.skillFlow}>
              {ENGINEERING_SKILLS.map((skill, index) => (
                <li className={styles.skillFlowItem} key={skill.id}>
                  <span className={styles.skillNumber}>{index + 1}</span>
                  <span className={styles.skillIcon} aria-hidden>{skill.icon}</span>
                  <div className={styles.skillBody}>
                    <div className={styles.skillTitleRow}>
                      <h3>{t(`home.engineering.skills.${skill.id}.title`)}</h3>
                      <span aria-hidden>{t("home.engineering.skillNameSeparator")}</span>
                      <code>{`bkn-${skill.id === "ontologyBuilder" ? "ontology-builder" : skill.id}`}</code>
                    </div>
                    <dl>
                      <div>
                        <dt>{t("home.engineering.labels.scenario")}</dt>
                        <dd>{t(`home.engineering.skills.${skill.id}.scenario`)}</dd>
                      </div>
                      <div>
                        <dt>{t("home.engineering.labels.output")}</dt>
                        <dd>{t(`home.engineering.skills.${skill.id}.output`)}</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              ))}
            </ol>

          </section>
          )}
        </div>
      </main>

      <Modal
        className={styles.skillsModal}
        footer={null}
        onCancel={() => setSkillsModalOpen(false)}
        open={skillsModalOpen}
        title={t("home.engineering.install.title")}
        width={1080}
      >
        <p className={styles.skillsModalDescription}>{t("home.engineering.install.description")}</p>
        <div className={styles.installList}>
          {ENGINEERING_SKILLS.map((skill) => (
            <section className={styles.installItem} key={skill.id}>
              <div>
                <div className={styles.installTitleBlock}>
                  <h3>{t(`home.engineering.skills.${skill.id}.title`)}</h3>
                  <span aria-hidden>{t("home.engineering.skillNameSeparator")}</span>
                  <code>{`bkn-${skill.id === "ontologyBuilder" ? "ontology-builder" : skill.id}`}</code>
                </div>
                <p>{t(`home.engineering.skills.${skill.id}.scenario`)}</p>
              </div>
              <div className={styles.installCommand}>
                <code>{skill.command}</code>
                <AppButton
                  aria-label={t("home.engineering.install.copyCommand")}
                  icon={<CopyOutlined />}
                  onClick={() => copyInstallCommand(skill.command)}
                  size="small"
                >
                  {t("home.engineering.install.copyCommand")}
                </AppButton>
              </div>
            </section>
          ))}
        </div>
      </Modal>
    </section>
  );
}
