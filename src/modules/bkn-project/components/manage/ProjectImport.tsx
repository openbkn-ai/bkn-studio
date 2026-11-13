/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { UploadOutlined } from "@ant-design/icons";
import { Alert, Form, Input, Modal, Select, Table, Upload } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  MAX_PROJECT_NAME_LENGTH,
  ProjectTargetFields,
  type TargetValues,
  VersioningConfirmModal,
} from "@/modules/bkn-project/components/NewProjectModal";
import {
  type CatalogMapping,
  importFailureText,
  MAX_PACKAGE_MB,
  prefillCatalogMapping,
} from "@/modules/bkn-project/components/manage/manageMessages";
import { namingLanguageLabelKey } from "@/modules/bkn-project/components/manage/projectLanguage";
import {
  importProjectPackage,
  previewProjectPackage,
} from "@/modules/bkn-project/services/project.service";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import {
  MAX_PROJECT_PACKAGE_BYTES,
  type Project,
  type ProjectCatalog,
  type ProjectNetwork,
  type ProjectPackagePreview,
} from "@/modules/bkn-project/types/project";

import styles from "./ProjectManage.module.css";

const PACKAGE_ACCEPT = ".bknproj,.zip";

/** Further parts a package may bring, as the dialog names them; others are not listed. */
const EDITION_KEYS: Record<string, string> = {
  knowledge_base: "bknProject.import.contents.knowledgeBase",
  terms: "bknProject.import.contents.terms",
};

type FormValues = TargetValues & { name: string };

/** The page header's import: pick a package, check what it holds, map it here, create the project. */
export function ProjectImport({
  catalogs,
  catalogsError,
  className,
  networks,
  networksError,
  onImported,
  onOpen,
}: {
  catalogs: ProjectCatalog[];
  catalogsError: string | null;
  className?: string;
  networks: ProjectNetwork[];
  networksError: string | null;
  onImported: (project: Project) => void;
  /** Called as a package is picked, for the page to read again what failed to load. */
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<FormValues>();
  const mode = Form.useWatch("mode", form) ?? "existing";
  const [reading, setReading] = useState(false);
  const [pkg, setPkg] = useState<{ file: File; preview: ProjectPackagePreview } | null>(null);
  const [mapping, setMapping] = useState<CatalogMapping>({});
  const [mappingMissing, setMappingMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [askVersioning, setAskVersioning] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Catalogs that arrive after the package was read still pre-select the unpaired ones.
  useEffect(() => {
    if (pkg) {
      setMapping((current) => prefillCatalogMapping(pkg.preview.catalogs, catalogs, current));
    }
  }, [catalogs, pkg]);

  const pick = async (file: File) => {
    if (file.size > MAX_PROJECT_PACKAGE_BYTES) {
      void message.error(t("bknProject.import.errors.tooLarge", { max: MAX_PACKAGE_MB }));
      return;
    }
    onOpen?.();
    setReading(true);
    try {
      const preview = await previewProjectPackage(file);
      setMapping(prefillCatalogMapping(preview.catalogs, catalogs));
      setPkg({ file, preview });
    } catch (error) {
      void message.error(importFailureText(t, error));
    } finally {
      setReading(false);
    }
  };

  const close = () => {
    if (submitting) {
      return;
    }
    setPkg(null);
    setMapping({});
    setMappingMissing(false);
    setFailure(null);
    setAskVersioning(false);
  };

  const submit = async (enableVersioning = false) => {
    if (!pkg) {
      return;
    }
    const values = await form.validateFields().catch(() => null);
    const missing = pkg.preview.catalogs.some((item) => !mapping[item.id]);
    setMappingMissing(missing);
    if (!values || missing) {
      return;
    }
    setSubmitting(true);
    setFailure(null);
    try {
      const project = await importProjectPackage(pkg.file, {
        catalogMapping: Object.fromEntries(
          pkg.preview.catalogs.map((item) => [item.id, mapping[item.id] ?? ""]),
        ),
        name: values.name,
        ...(values.mode === "new"
          ? { newKnName: values.newKnName }
          : { knId: values.knId, ...(enableVersioning ? { enableVersioning } : {}) }),
      });
      setAskVersioning(false);
      setPkg(null);
      setMapping({});
      onImported(project);
    } catch (error) {
      if (projectErrorCode(error) === "Project.VersioningRequired") {
        setAskVersioning(true);
      } else {
        setAskVersioning(false);
        setFailure(importFailureText(t, error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const preview = pkg?.preview;
  const contents = preview
    ? [
        t("bknProject.import.contents.documents", { count: preview.contents.documents }),
        preview.contents.requirement ? t("bknProject.import.contents.requirement") : null,
        preview.contents.draft ? t("bknProject.import.contents.draft") : null,
        preview.contents.confirmedFiles
          ? t("bknProject.import.contents.confirmed", { count: preview.contents.confirmedFiles })
          : null,
        ...preview.contents.editions.map((edition) =>
          EDITION_KEYS[edition] ? t(EDITION_KEYS[edition]) : null,
        ),
      ].filter((item): item is string => Boolean(item))
    : [];

  return (
    <>
      <Upload
        accept={PACKAGE_ACCEPT}
        beforeUpload={(file) => {
          void pick(file);
          return false;
        }}
        showUploadList={false}
      >
        <AppButton className={className} icon={<UploadOutlined />} loading={reading}>
          {t("bknProject.import.button")}
        </AppButton>
      </Upload>

      <Modal
        cancelButtonProps={{ disabled: submitting }}
        cancelText={t("common.cancel")}
        closable={!submitting}
        confirmLoading={submitting}
        destroyOnHidden
        maskClosable={false}
        okText={t("bknProject.import.submit")}
        onCancel={close}
        onOk={() => void submit()}
        open={Boolean(pkg)}
        title={t("bknProject.import.title")}
        width={640}
      >
        <VersioningConfirmModal
          onCancel={() => setAskVersioning(false)}
          onConfirm={() => void submit(true)}
          open={askVersioning}
          submitting={submitting}
        />
        {preview ? (
          <>
            <dl className={styles.summary}>
              <dt>{t("bknProject.import.packageName")}</dt>
              <dd>{preview.name}</dd>
              <dt>{t("bknProject.contentLanguage.label")}</dt>
              <dd>{t(namingLanguageLabelKey(preview.namingLanguage))}</dd>
              <dt>{t("bknProject.import.sourceNetwork")}</dt>
              <dd>{preview.kn.name || preview.kn.id}</dd>
              <dt>{t("bknProject.import.contents.label")}</dt>
              <dd>{contents.join(t("bknProject.listSeparator"))}</dd>
            </dl>
            <Form<FormValues>
              form={form}
              initialValues={{ mode: "existing", name: preview.name }}
              layout="vertical"
              preserve={false}
            >
              <Form.Item
                label={t("bknProject.create.name")}
                name="name"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: t("bknProject.create.nameRequired"),
                  },
                  {
                    max: MAX_PROJECT_NAME_LENGTH,
                    message: t("bknProject.create.nameTooLong", { max: MAX_PROJECT_NAME_LENGTH }),
                  },
                ]}
              >
                <Input placeholder={t("bknProject.create.namePlaceholder")} />
              </Form.Item>
              <ProjectTargetFields mode={mode} networks={networks} networksError={networksError} />
              {preview.catalogs.length ? (
                <Form.Item
                  extra={t("bknProject.import.catalogs.hint")}
                  label={t("bknProject.import.catalogs.label")}
                >
                  <Table
                    className={styles.mappingTable}
                    columns={[
                      {
                        dataIndex: "name",
                        key: "name",
                        title: t("bknProject.import.catalogs.from"),
                      },
                      {
                        key: "target",
                        render: (_, item: ProjectCatalog) => (
                          <Select
                            aria-label={t("bknProject.import.catalogs.toLabel", {
                              name: item.name,
                            })}
                            className={styles.mappingSelect}
                            onChange={(value: string) =>
                              setMapping((current) => ({ ...current, [item.id]: value }))
                            }
                            optionFilterProp="label"
                            options={catalogs.map((catalog) => ({
                              label: catalog.name,
                              value: catalog.id,
                            }))}
                            placeholder={t("bknProject.create.catalogsPlaceholder")}
                            showSearch
                            status={mappingMissing && !mapping[item.id] ? "error" : undefined}
                            value={mapping[item.id]}
                          />
                        ),
                        title: t("bknProject.import.catalogs.to"),
                      },
                    ]}
                    dataSource={preview.catalogs}
                    pagination={false}
                    rowKey="id"
                    size="small"
                  />
                </Form.Item>
              ) : null}
            </Form>
            <div className={styles.stack}>
              {catalogsError ? (
                <Alert
                  description={catalogsError}
                  message={t("bknProject.create.catalogsLoadFailed")}
                  showIcon
                  type="error"
                />
              ) : null}
              {mappingMissing ? (
                <Alert
                  message={t("bknProject.import.errors.catalogMapping")}
                  showIcon
                  type="error"
                />
              ) : null}
              {failure ? <Alert message={failure} showIcon type="error" /> : null}
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
