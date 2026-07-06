/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Drawer, Space, Steps } from "antd";

import { useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "react-i18next";

import { useNavigate } from "react-router-dom";



import { useAppServices } from "@/framework/context/use-app-services";

import { extractRequestErrorMessage } from "@/framework/request/error-message";

import { AppButton } from "@/framework/ui/common/AppButton";

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

import { registerOpenApiImport } from "@/modules/execution-factory/services/import-openapi.service";
import { registerQuickApi } from "@/modules/execution-factory/services/quick-api.service";

import type { CapabilityUxMode } from "@/modules/execution-factory/utils/capability-ux";

import {

  canReturnToModeStep,

  getCapabilityModesForTab,

  getDefaultCapabilityModeForTab,

  shouldSkipCapabilityModeStep,

} from "@/modules/execution-factory/utils/capability-ux";



import { AddCapabilityModeStep } from "./AddCapabilityModeStep";

import { CreateMcpDrawer } from "./CreateMcpDrawer";

import { CreateSkillForm } from "./CreateSkillForm";

import { CreateToolboxForm } from "./CreateToolboxForm";

import {
  ImportOpenApiCapabilityForm,
  type ImportOpenApiCapabilityFormHandle,
} from "./ImportOpenApiCapabilityForm";
import { QuickAddApiForm, type QuickAddApiFormHandle } from "./QuickAddApiForm";
import { buildQuickApiSubmitError } from "./quick-api-submit-error";

import styles from "./create-menu.module.css";



export type CreatedCapabilityPayload = {

  id: string;

  tab: ExecutionUnitTab;

  toolId?: string;

};



type AddCapabilityWizardProps = {

  contextTab?: ExecutionUnitTab;

  initialBoxId?: string;

  initialMode?: CapabilityUxMode;

  lockInitialMode?: boolean;

  onClose: () => void;

  onRefresh?: () => void;

  onCreated?: (payload: CreatedCapabilityPayload) => void;

  open: boolean;

};



const FUNCTION_TOOLBOX_FORM_ID = "create-function-toolbox-form";
const IMPORT_OPENAPI_FORM_ID = "import-openapi-capability-form";



export function AddCapabilityWizard({

  contextTab,

  initialBoxId,

  initialMode,

  lockInitialMode = false,

  onClose,

  onRefresh,

  onCreated,

  open,

}: AddCapabilityWizardProps) {

  const { t } = useTranslation();

  const { message } = useAppServices();

  const navigate = useNavigate();

  const quickApiFormRef = useRef<QuickAddApiFormHandle>(null);
  const importOpenApiFormRef = useRef<ImportOpenApiCapabilityFormHandle>(null);

  const allowedModes = useMemo(() => getCapabilityModesForTab(contextTab), [contextTab]);

  const skipModeStep =
    lockInitialMode || shouldSkipCapabilityModeStep(contextTab, { initialBoxId });

  const [step, setStep] = useState(0);

  const [mode, setMode] = useState<CapabilityUxMode | undefined>(

    initialMode ?? getDefaultCapabilityModeForTab(contextTab),

  );

  const [submitting, setSubmitting] = useState(false);



  useEffect(() => {

    if (!open) {

      return;

    }



    const resolvedMode = initialMode ?? getDefaultCapabilityModeForTab(contextTab);

    setMode(resolvedMode);

    setStep(skipModeStep ? 1 : 0);

    setSubmitting(false);

  }, [contextTab, initialBoxId, initialMode, open, skipModeStep]);



  const showModeStep = step === 0 && !skipModeStep;

  const configureStepIndex = skipModeStep ? 0 : 1;



  const stepItems = useMemo(() => {

    if (skipModeStep) {

      return [{ title: t("executionFactory.addCapabilityStepConfigure") }];

    }



    return [

      { title: t("executionFactory.addCapabilityStepMode") },

      { title: t("executionFactory.addCapabilityStepConfigure") },

    ];

  }, [skipModeStep, t]);



  const wizardTitle = useMemo(() => {

    if (showModeStep) {

      return t("executionFactory.addCapabilityWizardTitle");

    }



    switch (mode) {

      case "mcp":

        return t("executionFactory.addMcpWizardTitle");

      case "skill":

        return t("executionFactory.addSkillWizardTitle");

      case "quick-api":

        return t("executionFactory.addApiWizardTitle");

      case "import-openapi":

        return t("executionFactory.importOpenApiCapabilityTitle");

      case "function":

        return t("executionFactory.addCapabilityFunctionTitle");

      case "advanced-operator":

        return t("executionFactory.addCapabilityAdvancedTitle");

      default:

        return t("executionFactory.addCapabilityWizardTitle");

    }

  }, [mode, showModeStep, t]);



  const handleClose = () => {

    setStep(0);

    onClose();

  };



  const handleCreated = (tab: ExecutionUnitTab, id: string, toolId?: string) => {

    onRefresh?.();

    onCreated?.({ tab, id, toolId });

    handleClose();

  };



  const handleBackFromConfigure = () => {

    if (!lockInitialMode && canReturnToModeStep(allowedModes)) {

      setStep(0);

      return;

    }



    handleClose();

  };



  const handleQuickApiSubmit = async (payload: {

    openapiSpec: string;

    serviceUrl: string;

    values: {

      toolboxMode: "existing" | "new";

      boxId?: string;

      toolboxName?: string;

      toolboxDescription?: string;

      category?: string;

      summary?: string;

      operatorSync?: import("@/modules/execution-factory/types/operator-sync").OperatorSyncPublishInput;

    };

  }) => {

    setSubmitting(true);



    try {

      const result = await registerQuickApi({

        openapiSpec: payload.openapiSpec,

        serviceUrl: payload.serviceUrl,

        boxId: initialBoxId ?? payload.values.boxId,

        toolboxName: payload.values.toolboxName,

        toolboxDescription: payload.values.toolboxDescription,

        category: payload.values.category,

        operatorSync: payload.values.operatorSync,

        toolName: payload.values.summary,

      });

      void message.success(
        result.operatorId
          ? t("executionFactory.quickApiCreateWithOperatorSuccess")
          : t("executionFactory.quickApiCreateSuccess"),
      );

      handleCreated("toolbox", result.boxId, result.toolIds[0]);

    } catch (error) {

      const submitError = buildQuickApiSubmitError(error);
      quickApiFormRef.current?.showSubmitError(submitError);
      void message.error(submitError.message);

    } finally {

      setSubmitting(false);

    }

  };



  const handleAdvancedOperator = () => {

    void navigate("/execution-factory/units/new?metadataType=openapi");

    handleClose();

  };

  const handleImportOpenApiSubmit = async (payload: {
    openapiSpec: string;
    values: {
      toolboxMode: "existing" | "new";
      boxId?: string;
      toolboxName?: string;
      toolboxDescription?: string;
      serviceUrl?: string;
      useRule?: string;
      category?: string;
      operatorSync?: import("@/modules/execution-factory/types/operator-sync").OperatorSyncPublishInput;
    };
  }) => {
    setSubmitting(true);

    try {
      const result = await registerOpenApiImport({
        openapiSpec: payload.openapiSpec,
        boxId: initialBoxId ?? payload.values.boxId,
        toolboxName: payload.values.toolboxName,
        toolboxDescription: payload.values.toolboxDescription,
        serviceUrl: payload.values.serviceUrl,
        useRule: payload.values.useRule,
        category: payload.values.category,
        operatorSync: payload.values.operatorSync,
      });

      if (result.failureCount > 0) {
        void message.warning(
          t("executionFactory.importOpenApiCapabilityPartial", {
            success: result.successCount,
            failed: result.failureCount,
          }),
        );
      } else if (result.operatorId) {
        void message.success(t("executionFactory.importOpenApiCapabilityWithOperatorSuccess", {
          count: result.successCount,
        }));
      } else {
        void message.success(
          t("executionFactory.importOpenApiCapabilitySuccess", {
            count: result.successCount,
          }),
        );
      }

      handleCreated("toolbox", result.boxId, result.toolIds[0]);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {

    if (showModeStep) {

      return (

        <AddCapabilityModeStep

          allowedModes={allowedModes}

          mode={mode}

          onModeChange={setMode}

        />

      );

    }



    switch (mode) {

      case "quick-api":

        return (

          <QuickAddApiForm

            formId="quick-add-api-form"

            initialBoxId={initialBoxId}

            onSubmit={(payload) => void handleQuickApiSubmit(payload)}

            ref={quickApiFormRef}

          />

        );

      case "import-openapi":
        return (
          <ImportOpenApiCapabilityForm
            formId={IMPORT_OPENAPI_FORM_ID}
            initialBoxId={initialBoxId}
            onSubmit={(payload) => void handleImportOpenApiSubmit(payload)}
            ref={importOpenApiFormRef}
          />
        );

      case "function":

        return (

          <>

            <CreateToolboxForm

              formId={FUNCTION_TOOLBOX_FORM_ID}

              lockMetadataType="function"

              onCreated={(boxId) => handleCreated("toolbox", boxId)}

            />

          </>

        );

      case "mcp":

        return (

          <CreateMcpDrawer

            embedded

            onClose={handleBackFromConfigure}

            onCreated={(mcpId) => handleCreated("mcp", mcpId)}

            open

          />

        );

      case "skill":

        return (

          <CreateSkillForm

            formId="create-skill-form"

            onImported={(skillId) => handleCreated("skill", skillId)}

          />

        );

      case "advanced-operator":

        return (

          <div>

            <p className={styles.modalHint}>{t("executionFactory.addCapabilityAdvancedHint")}</p>

            <Space direction="vertical" style={{ width: "100%" }}>

              <AppButton block onClick={handleAdvancedOperator} type="primary">

                {t("executionFactory.addCapabilityAdvancedOpenApi")}

              </AppButton>

              <AppButton

                block

                onClick={() => {

                  void navigate("/execution-factory/units/new?metadataType=function");

                  handleClose();

                }}

              >

                {t("executionFactory.addCapabilityAdvancedFunction")}

              </AppButton>

            </Space>

          </div>

        );

      default:

        return null;

    }

  };



  const renderFooter = () => {

    if (showModeStep) {

      return (

        <Space>

          <AppButton onClick={handleClose}>{t("common.cancel")}</AppButton>

          <AppButton disabled={!mode} onClick={() => setStep(1)} type="primary">

            {t("common.next")}

          </AppButton>

        </Space>

      );

    }



    if (mode === "quick-api") {

      return (

        <Space>

          {initialBoxId ? (

            <AppButton onClick={handleClose}>{t("common.cancel")}</AppButton>

          ) : (

            <AppButton onClick={handleBackFromConfigure}>{t("common.back")}</AppButton>

          )}

          <AppButton
            form="quick-add-api-form"
            htmlType="submit"
            loading={submitting}
            type="primary"
          >
            {t("executionFactory.quickApiSave")}
          </AppButton>

        </Space>

      );

    }

    if (mode === "import-openapi") {
      return (
        <Space>
          {initialBoxId ? (
            <AppButton onClick={handleClose}>{t("common.cancel")}</AppButton>
          ) : (
            <AppButton onClick={handleBackFromConfigure}>{t("common.back")}</AppButton>
          )}
          <AppButton
            form={IMPORT_OPENAPI_FORM_ID}
            htmlType="submit"
            loading={submitting}
            type="primary"
          >
            {t("executionFactory.importOpenApiCapabilitySave")}
          </AppButton>
        </Space>
      );
    }

    if (mode === "function") {

      return (

        <Space>

          <AppButton onClick={handleBackFromConfigure}>{t("common.back")}</AppButton>

          <AppButton form={FUNCTION_TOOLBOX_FORM_ID} htmlType="submit" type="primary">

            {t("common.confirm")}

          </AppButton>

        </Space>

      );

    }



    if (mode === "mcp") {

      return (

        <AppButton onClick={handleBackFromConfigure}>

          {!lockInitialMode && canReturnToModeStep(allowedModes) ? t("common.back") : t("common.cancel")}

        </AppButton>

      );

    }



    if (mode === "skill") {

      return (

        <Space>

          <AppButton onClick={handleBackFromConfigure}>

            {!lockInitialMode && canReturnToModeStep(allowedModes) ? t("common.back") : t("common.cancel")}

          </AppButton>

          <AppButton form="create-skill-form" htmlType="submit" type="primary">

            {t("common.confirm")}

          </AppButton>

        </Space>

      );

    }



    if (mode === "advanced-operator") {

      return (

        <Space>

          <AppButton onClick={handleBackFromConfigure}>{t("common.back")}</AppButton>

          <AppButton onClick={handleClose}>{t("common.cancel")}</AppButton>

        </Space>

      );

    }



    return null;

  };



  return (

    <Drawer

      destroyOnClose

      footer={<div className={styles.wizardFooter}>{renderFooter()}</div>}

      onClose={handleClose}

      open={open}

      title={wizardTitle}

      width={840}

    >

      <Steps

        className={styles.wizardSteps}

        current={showModeStep ? 0 : configureStepIndex}

        items={stepItems}

        size="small"

      />

      {renderBody()}

    </Drawer>

  );

}
