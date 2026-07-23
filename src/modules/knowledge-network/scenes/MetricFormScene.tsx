/**

 * Copyright (c) 2026 OpenBKN

 * SPDX-License-Identifier: LicenseRef-OpenBKN

 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional

 * Conditions. See LICENSE for the full text.

 */



import { Alert, Form, Input, Select, Spin } from "antd";

import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "react-i18next";

import { useNavigate, useParams } from "react-router-dom";



import { useAppServices } from "@/framework/context/use-app-services";

import { extractRequestErrorMessage } from "@/framework/request/error-message";

import { AppButton } from "@/framework/ui/common/AppButton";

import { MetricCalculationEditor } from "@/modules/knowledge-network/components/metric/MetricCalculationEditor";

import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";

import {

  ResourceTagsSelect,

  validateKnowledgeNetworkTags,

} from "@/modules/knowledge-network/components/shared/ResourceTagsSelect";

import {

  createKnowledgeNetworkMetric,

  getKnowledgeNetworkObjectType,

  getKnowledgeNetworkMetric,

  listKnowledgeNetworkObjectTypes,

  updateKnowledgeNetworkMetric,

} from "@/modules/knowledge-network/services/knowledge-network.service";

import type { MetricFormSceneProps } from "@/modules/knowledge-network/contracts/scenes";

import type {
  KnowledgeNetworkMetricMutationPayload,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import { createDefaultMetricCalculationFormula } from "@/modules/knowledge-network/types/knowledge-network";

import { mergeBoundObjectTypeOption } from "@/modules/knowledge-network/utils/metric-object-type-options";



import styles from "./MetricFormScene.module.css";

function resetObjectTypeDependentFields(

  form: ReturnType<typeof Form.useForm<KnowledgeNetworkMetricMutationPayload>>[0],

) {

  form.setFieldsValue({

    calculationFormula: createDefaultMetricCalculationFormula(),

    timeDimension: {

      defaultRangePolicy: "last_24h",

      property: "",

    },

    unit: undefined,

    unitType: undefined,

  });

}



export function MetricFormScene({

  metricId: metricIdProp,

  mode,

  networkId: networkIdProp,

  onBack,

  onSubmitSuccess,

}: MetricFormSceneProps) {

  const { t } = useTranslation();

  const navigate = useNavigate();

  const { message } = useAppServices();

  const params = useParams<{

    metricId?: string;

    networkId: string;

  }>();

  const metricId = metricIdProp ?? params.metricId ?? "";

  const networkId = networkIdProp ?? params.networkId ?? "";

  const [form] = Form.useForm<KnowledgeNetworkMetricMutationPayload>();

  const [loading, setLoading] = useState(mode === "edit");

  const [submitting, setSubmitting] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);

  const [pageTitle, setPageTitle] = useState(t("knowledgeNetwork.metricCreateTitle"));

  const objectTypeId = Form.useWatch("scopeRef", form);



  const listPath = `/knowledge-network/workspace/${networkId}/metrics`;



  const objectTypeOptions = useMemo(

    () => objectTypes.map((item) => ({ label: item.name, value: item.id })),

    [objectTypes],

  );



  useEffect(() => {

    const loadData = async () => {

      if (!networkId) {

        return;

      }



      setLoadError(null);



      try {

        const objectTypeResult = await listKnowledgeNetworkObjectTypes(networkId);

        if (mode === "edit" && metricId) {

          setLoading(true);

          const detail = await getKnowledgeNetworkMetric(networkId, metricId);

          if (!detail) {

            throw new Error(t("common.notFound"));

          }



          const boundObjectTypeId =

            detail.scopeType === "object_type" ? detail.scopeRef.trim() : "";

          let boundObjectType: KnowledgeNetworkObjectTypeRecord | null = null;

          if (

            boundObjectTypeId &&

            !objectTypeResult.some((item) => item.id === boundObjectTypeId)

          ) {

            try {

              boundObjectType = await getKnowledgeNetworkObjectType(networkId, boundObjectTypeId);

            } catch {

              boundObjectType = null;

            }

          }

          setObjectTypes(

            mergeBoundObjectTypeOption(objectTypeResult, boundObjectTypeId, boundObjectType),

          );



          form.setFieldsValue({

            calculationFormula: detail.calculationFormula,

            description: detail.description,

            metricType: detail.metricType,

            name: detail.name,

            scopeRef: boundObjectTypeId,

            scopeType: "object_type",

            tags: detail.tags,

            timeDimension: detail.timeDimension,

            unit: detail.unit,

            unitType: detail.unitType,

          });

          setPageTitle(detail.name);

        } else {

          setObjectTypes(objectTypeResult);

          form.setFieldsValue({

            calculationFormula: createDefaultMetricCalculationFormula(),

            description: "",

            metricType: "atomic",

            name: "",

            scopeRef: objectTypeResult[0]?.id ?? "",

            scopeType: "object_type",

            tags: [],

            timeDimension: {

              defaultRangePolicy: "last_24h",

              property: "",

            },

          });

        }

      } catch (error) {

        setLoadError(extractRequestErrorMessage(error));

      } finally {

        setLoading(false);

      }

    };



    void loadData();

  }, [form, metricId, mode, networkId, t]);



  const handleSubmit = async () => {

    try {

      const values = await form.validateFields();

      setSubmitting(true);

      let savedMetric = null;



      const payload: KnowledgeNetworkMetricMutationPayload = {

        ...values,

        scopeType: "object_type",

      };



      if (mode === "create") {

        savedMetric = await createKnowledgeNetworkMetric(networkId, payload);

      } else if (metricId) {

        savedMetric = await updateKnowledgeNetworkMetric(networkId, metricId, payload);

      }



      void message.success(t("common.success"));



      if (onSubmitSuccess) {

        onSubmitSuccess();

        return;

      }



      void navigate(

        mode === "create"

          ? listPath

          : `/knowledge-network/workspace/${networkId}/metrics/${savedMetric?.id ?? metricId}/detail`,

      );

    } catch (error) {

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

        if (onBack) {

          onBack();

          return;

        }



        void navigate(listPath);

      }}

      subtitle={

        mode === "create"

          ? t("knowledgeNetwork.metricCreateDescription")

          : t("knowledgeNetwork.metricEditDescription")

      }

      title={mode === "create" ? t("knowledgeNetwork.metricCreateTitle") : pageTitle}

    >

      {loadError ? <Alert message={loadError} showIcon style={{ marginBottom: 12 }} type="error" /> : null}

      <div className={styles.formLayout}>

        <div className={styles.formPanel}>

          <Form colon={false} form={form} layout="vertical" requiredMark>

            <Form.Item hidden name="scopeType">

              <Input />

            </Form.Item>



            <section className={styles.sectionCard}>

              <h3 className={styles.sectionTitle}>{t("knowledgeNetwork.metricBasicInfo")}</h3>



              <div className={styles.fieldGrid}>

                <Form.Item

                  className={styles.fieldFull}

                  label={t("knowledgeNetwork.metricName")}

                  name="name"

                  rules={[

                    { message: t("knowledgeNetwork.metricNameRequired"), required: true },

                    { max: 40, message: t("knowledgeNetwork.objectTypeNameMaxLength") },

                  ]}

                >

                  <Input maxLength={40} placeholder={t("knowledgeNetwork.metricNamePlaceholder")} />

                </Form.Item>



                <Form.Item

                  className={styles.fieldFull}

                  label={t("knowledgeNetwork.metricTags")}

                  name="tags"

                  rules={[

                    {

                      validator: (rule, value) => validateKnowledgeNetworkTags(t, rule, value),

                    },

                  ]}

                >

                  <ResourceTagsSelect />

                </Form.Item>



                <Form.Item

                  className={styles.fieldFull}

                  label={t("knowledgeNetwork.descriptionField")}

                  name="description"

                >

                  <Input.TextArea

                    placeholder={t("knowledgeNetwork.metricDescriptionPlaceholder")}

                    rows={2}

                  />

                </Form.Item>

              </div>

            </section>



            <section className={styles.sectionCard}>

              <h3 className={styles.sectionTitle}>{t("knowledgeNetwork.metricConfigSection")}</h3>



              <div className={styles.fieldGrid}>

                <Form.Item

                  label={t("knowledgeNetwork.metricBoundObjectType")}

                  name="scopeRef"

                  rules={[

                    { message: t("knowledgeNetwork.metricBoundObjectTypeRequired"), required: true },

                  ]}

                >

                  <Select

                    onChange={() => resetObjectTypeDependentFields(form)}

                    optionFilterProp="label"

                    options={objectTypeOptions}

                    placeholder={t("knowledgeNetwork.metricBoundObjectTypePlaceholder")}

                    showSearch

                  />

                </Form.Item>



                <Form.Item

                  label={t("knowledgeNetwork.metricType")}

                  name="metricType"

                  rules={[{ message: t("knowledgeNetwork.metricTypeRequired"), required: true }]}

                >

                  <Select

                    disabled

                    options={[{ label: t("knowledgeNetwork.metricTypeAtomic"), value: "atomic" }]}

                    placeholder={t("knowledgeNetwork.pleaseSelect")}

                  />

                </Form.Item>



              </div>



              <MetricCalculationEditor

                embedded

                form={form}

                networkId={networkId}

                objectTypeId={objectTypeId}

                objectTypes={objectTypes}

              />

            </section>

          </Form>

        </div>

      </div>

    </KnowledgeNetworkResourceConfigShell>

  );

}


