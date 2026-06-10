export const MODEL_SERIES_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "qwen", label: "通义千问" },
  { value: "claude", label: "Claude" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "internlm", label: "InternLM" },
  { value: "chatglm", label: "ChatGLM" },
  { value: "llama", label: "Llama" },
  { value: "baidu", label: "Baidu" },
  { value: "others", label: "其他" },
];

export function getModelSeriesLabel(series?: string) {
  return MODEL_SERIES_OPTIONS.find((item) => item.value === series)?.label ?? series ?? "--";
}

export function formatNumberWithCommas(value?: number | string) {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
