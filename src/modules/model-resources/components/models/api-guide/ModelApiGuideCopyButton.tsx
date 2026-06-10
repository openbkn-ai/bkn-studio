import { CopyOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";

type ModelApiGuideCopyButtonProps = {
  className?: string;
  text: string;
};

export function ModelApiGuideCopyButton({ className, text }: ModelApiGuideCopyButtonProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(t("modelResources.models.apiGuide.copySuccess"));
    } catch {
      message.error(t("modelResources.models.apiGuide.copyFailed"));
    }
  };

  return (
    <AppButton
      aria-label={t("modelResources.models.apiGuide.copy")}
      className={className}
      icon={<CopyOutlined />}
      onClick={() => void handleCopy()}
      size="small"
      type="text"
    />
  );
}
