import { Alert, Form, Input, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import {
  DEFAULT_RESOURCE_COLOR,
  ResourceColorSelect,
} from "@/modules/knowledge-network/components/shared/ResourceColorSelect";
import {
  ResourceTagsSelect,
  validateKnowledgeNetworkTags,
} from "@/modules/knowledge-network/components/shared/ResourceTagsSelect";
import {
  createKnowledgeNetworkConceptGroup,
  getKnowledgeNetworkConceptGroup,
  updateKnowledgeNetworkConceptGroup,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type { ConceptGroupMutationPayload } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ConceptGroupFormScene.module.css";

type ConceptGroupFormSceneProps = {
  mode: "create" | "edit";
};

export function ConceptGroupFormScene({ mode }: ConceptGroupFormSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const { conceptGroupId = "", networkId = "" } = useParams<{
    conceptGroupId?: string;
    networkId: string;
  }>();
  const [form] = Form.useForm<ConceptGroupMutationPayload>();
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState(t("knowledgeNetwork.conceptGroupCreateTitle"));

  const listPath = `/knowledge-network/workspace/${networkId}/concept-groups`;

  useEffect(() => {
    const loadData = async () => {
      if (mode !== "edit" || !networkId || !conceptGroupId) {
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const detail = await getKnowledgeNetworkConceptGroup(networkId, conceptGroupId);
        if (!detail) {
          throw new Error(t("common.notFound"));
        }

        form.setFieldsValue({
          color: detail.color ?? DEFAULT_RESOURCE_COLOR,
          description: detail.description,
          name: detail.name,
          tags: detail.tags ?? [],
        });
        setPageTitle(detail.name);
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [conceptGroupId, form, mode, networkId, t]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      setSubmitting(true);
      if (mode === "edit" && conceptGroupId) {
        await updateKnowledgeNetworkConceptGroup(networkId, conceptGroupId, values);
      } else {
        await createKnowledgeNetworkConceptGroup(networkId, values);
      }

      void message.success(t("common.success"));
      void navigate(listPath);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }

      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        <AppButton loading={submitting} onClick={() => void handleSubmit()} type="primary">
          {t("common.save")}
        </AppButton>
      }
      onBack={() => {
        void navigate(listPath);
      }}
      subtitle={
        mode === "create"
          ? t("knowledgeNetwork.conceptGroupCreateDescription")
          : t("knowledgeNetwork.conceptGroupEditDescription")
      }
      title={pageTitle}
    >
      {loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      <div className={styles.formPanel}>
        <Form
          colon={false}
          form={form}
          initialValues={{
            color: DEFAULT_RESOURCE_COLOR,
            description: "",
            name: "",
            tags: [],
          }}
          labelAlign="left"
          labelCol={{ span: 4 }}
          wrapperCol={{ span: 20 }}
        >
          <Form.Item
            label={t("knowledgeNetwork.conceptGroupName")}
            name="name"
            rules={[
              {
                message: t("knowledgeNetwork.conceptGroupNameRequired"),
                required: true,
              },
              {
                max: 40,
                message: t("knowledgeNetwork.objectTypeNameMaxLength"),
              },
            ]}
          >
            <Input maxLength={40} showCount />
          </Form.Item>
          <Form.Item label={t("knowledgeNetwork.color")} name="color">
            <ResourceColorSelect inModal={false} />
          </Form.Item>
          <Form.Item
            label={t("common.tag")}
            name="tags"
            rules={[
              {
                validator: (rule, value) => validateKnowledgeNetworkTags(t, rule, value),
              },
            ]}
          >
            <ResourceTagsSelect />
          </Form.Item>
          <Form.Item label={t("knowledgeNetwork.descriptionField")} name="description">
            <Input.TextArea autoSize={{ minRows: 6, maxRows: 10 }} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </div>
    </KnowledgeNetworkResourceConfigShell>
  );
}
