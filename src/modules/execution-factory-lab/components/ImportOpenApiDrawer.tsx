import { Alert, Drawer, Input, Modal } from "antd";



import { useState } from "react";



import { useTranslation } from "react-i18next";



import { AppButton } from "@/framework/ui/common/AppButton";

import { importOpenApiCapabilities } from "@/modules/execution-factory-lab/services/capabilities-lab.service";

import type { CapabilityRecord } from "@/modules/execution-factory-lab/types/capability";



type ImportOpenApiDrawerProps = {

  open: boolean;

  onClose: () => void;

  onImported?: (capability: CapabilityRecord, allCapabilities: CapabilityRecord[]) => void;

};



export function ImportOpenApiDrawer({ open, onClose, onImported }: ImportOpenApiDrawerProps) {

  const { t } = useTranslation();

  const [serviceUrl, setServiceUrl] = useState("http://ef-oss-mock:8080");

  const [openapiText, setOpenapiText] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);



  const handleSubmit = async () => {

    setError(null);

    setLoading(true);

    try {

      JSON.parse(openapiText);

      const result = await importOpenApiCapabilities({

        openapiSpec: openapiText,

        serviceUrl,

      });

      const capabilities = result.capabilities;

      const capability = capabilities[0];

      if (!capability) {

        throw new Error(t("executionFactoryLab.importOpenApiEmpty"));

      }



      if (capabilities.length > 1) {

        Modal.info({

          content: t("executionFactoryLab.importOpenApiBatchHint", { count: capabilities.length }),

          title: t("executionFactoryLab.importOpenApiBatchTitle"),

        });

      }



      onImported?.(capability, capabilities);

      onClose();

    } catch (submitError) {

      setError(submitError instanceof Error ? submitError.message : String(submitError));

    } finally {

      setLoading(false);

    }

  };



  return (

    <Drawer

      onClose={onClose}

      open={open}

      title={t("executionFactoryLab.importOpenApiTitle")}

      width={640}

      extra={

        <AppButton loading={loading} onClick={() => void handleSubmit()} type="primary">

          {t("executionFactoryLab.importOpenApiSubmit")}

        </AppButton>

      }

    >

      {error ? <Alert message={error} showIcon style={{ marginBottom: 12 }} type="error" /> : null}

      <Input

        onChange={(event) => setServiceUrl(event.target.value)}

        placeholder={t("executionFactoryLab.serviceUrlLabel")}

        style={{ marginBottom: 12 }}

        value={serviceUrl}

      />

      <Input.TextArea

        autoSize={{ minRows: 12, maxRows: 24 }}

        onChange={(event) => setOpenapiText(event.target.value)}

        placeholder={t("executionFactoryLab.importOpenApiPlaceholder")}

        value={openapiText}

      />

    </Drawer>

  );

}
