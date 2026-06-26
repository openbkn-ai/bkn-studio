import { CopyOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { buildMcpSnippet, buildRestSnippet } from "@/modules/api-keys/utils/api-key-usage";

import styles from "./UsageBlocks.module.css";

function CodeBlock({ title, code, onCopy }: { title: string; code: string; onCopy: () => void }) {
  return (
    <div className={styles.block}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <button type="button" className={styles.copy} onClick={onCopy}>
          <CopyOutlined /> {/* copy */}
        </button>
      </div>
      <pre className={styles.pre}>{code}</pre>
    </div>
  );
}

/** 把密钥（或 <YOUR_API_KEY> 占位）填进 REST / MCP 用法示例。 */
export function UsageBlocks({ keyValue }: { keyValue: string }) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const rest = buildRestSnippet(keyValue);
  const mcp = buildMcpSnippet(keyValue);
  const copy = (text: string) => {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => message.success(t("apiKeys.secretModal.copied")))
      .catch(() => message.error(t("apiKeys.secretModal.copyFailed")));
  };
  return (
    <div className={styles.stack}>
      <CodeBlock title={t("apiKeys.usage.rest")} code={rest} onCopy={() => copy(rest)} />
      <CodeBlock title={t("apiKeys.usage.mcp")} code={mcp} onCopy={() => copy(mcp)} />
    </div>
  );
}
