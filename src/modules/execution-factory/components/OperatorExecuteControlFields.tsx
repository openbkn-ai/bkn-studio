import { Collapse, Form, InputNumber, Select } from "antd";
import { useTranslation } from "react-i18next";

type OperatorExecuteControlFieldsProps = {
  namePrefix?: (string | number)[];
};

export function OperatorExecuteControlFields({
  namePrefix = ["executeControl"],
}: OperatorExecuteControlFieldsProps) {
  const { t } = useTranslation();
  const retryPrefix = [...namePrefix, "retryPolicy"];

  return (
    <>
      <Form.Item
        label={t("executionFactory.executeControlTimeout")}
        name={[...namePrefix, "timeout"]}
        tooltip={t("executionFactory.executeControlTimeoutHint")}
      >
        <InputNumber min={0} step={1000} style={{ width: "100%" }} />
      </Form.Item>
      <Collapse
        ghost
        items={[
          {
            key: "retry",
            label: t("executionFactory.executeControlRetryPolicy"),
            children: (
              <>
                <Form.Item
                  label={t("executionFactory.executeControlMaxAttempts")}
                  name={[...retryPrefix, "maxAttempts"]}
                >
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item
                  label={t("executionFactory.executeControlInitialDelay")}
                  name={[...retryPrefix, "initialDelay"]}
                >
                  <InputNumber min={0} step={100} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item
                  label={t("executionFactory.executeControlMaxDelay")}
                  name={[...retryPrefix, "maxDelay"]}
                >
                  <InputNumber min={0} step={100} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item
                  label={t("executionFactory.executeControlBackoffFactor")}
                  name={[...retryPrefix, "backoffFactor"]}
                >
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item
                  label={t("executionFactory.executeControlRetryStatusCodes")}
                  name={[...retryPrefix, "retryStatusCodes"]}
                  tooltip={t("executionFactory.executeControlRetryStatusCodesHint")}
                >
                  <Select mode="tags" placeholder="500" tokenSeparators={[","]} />
                </Form.Item>
                <Form.Item
                  label={t("executionFactory.executeControlRetryErrorCodes")}
                  name={[...retryPrefix, "retryErrorCodes"]}
                  tooltip={t("executionFactory.executeControlRetryErrorCodesHint")}
                >
                  <Select mode="tags" placeholder="TIMEOUT" tokenSeparators={[","]} />
                </Form.Item>
              </>
            ),
          },
        ]}
      />
    </>
  );
}
