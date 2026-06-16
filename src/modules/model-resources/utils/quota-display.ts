import type { ModelQuota } from "@/modules/model-resources/types/quota";

const CURRENCY_SYMBOL: Record<number, string> = {
  0: "￥",
  1: "$",
};

const TOKEN_UNIT_LABEL: Record<number, string> = {
  1: "千",
  2: "万",
  3: "亿",
  4: "百万",
  5: "千万",
};

const PRICE_UNIT: Record<string, number> = {
  thousand: 1000,
  million: 1_000_000,
};

const PRICE_UNIT_LABEL: Record<string, string> = {
  thousand: "千",
  million: "百万",
};

export function isQuotaConfigured(record: Pick<ModelQuota, "inputTokens">) {
  return record.inputTokens !== -1;
}

export function formatTokenUnit(numType?: number) {
  if (!numType) {
    return "";
  }

  return TOKEN_UNIT_LABEL[numType === 3 ? 6 : numType] ?? "";
}

export function formatQuotaTokenAmount(
  tokens: number | undefined,
  numType: number | undefined,
  monthLabel: string,
) {
  if (tokens === undefined || tokens === -1) {
    return "--";
  }

  const unit = formatTokenUnit(numType);
  return `${tokens}${unit}/${monthLabel}`;
}

export function formatReferPrice(
  record: ModelQuota,
  type: "in" | "out",
  inLabel: string,
  outLabel: string,
  thousandLabel: string,
  millionLabel: string,
) {
  const price = type === "in" ? record.referPriceIn : record.referPriceOut;

  if (price === undefined || price === -1) {
    return "--";
  }

  const currency = CURRENCY_SYMBOL[record.currencyType ?? 0] ?? "￥";
  const priceType = record.priceType?.[0] ?? "thousand";
  const unitLabel =
    priceType === "million"
      ? millionLabel || PRICE_UNIT_LABEL.million
      : thousandLabel || PRICE_UNIT_LABEL.thousand;
  const prefix = record.billingType === 1 ? `${type === "in" ? inLabel : outLabel}：` : "";

  return `${prefix}${currency}${price}${currency === "￥" ? "元" : "美元"}/${unitLabel} tokens`;
}

function calculateTokenAmount(record: ModelQuota, type: "in" | "out") {
  const tokens = type === "in" ? record.inputTokens : record.outputTokens ?? 0;
  const referPrice = type === "in" ? record.referPriceIn ?? 0 : record.referPriceOut ?? 0;
  const numTypeIndex = type === "in" ? 0 : 1;
  const numType = record.numType?.[numTypeIndex] ?? 1;
  const priceType = record.priceType?.[0] ?? "thousand";

  if (tokens === -1 || referPrice === -1) {
    return 0;
  }

  return (
    (tokens * PRICE_UNIT[String(numType)] * referPrice) /
    (PRICE_UNIT[priceType] ?? 1000)
  );
}

export function formatEstimatedTotal(record: ModelQuota) {
  if (record.billingType === -1 || !isQuotaConfigured(record)) {
    return "--";
  }

  const inputAmount = calculateTokenAmount(record, "in");
  const outputAmount = record.billingType === 1 ? calculateTokenAmount(record, "out") : 0;
  const total = inputAmount + outputAmount;
  const currency = CURRENCY_SYMBOL[record.currencyType ?? 0] ?? "￥";

  return `${currency}${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function formatForecastAmount(
  tokens: number,
  referPrice: number,
  numType: number,
  priceType: string,
  currencySymbol: string,
) {
  const amount =
    (tokens * PRICE_UNIT[String(numType)] * referPrice) / (PRICE_UNIT[priceType] ?? 1000);

  return `${currencySymbol}${amount.toFixed(2)}`;
}

export const QUOTA_NUM_TYPE_OPTIONS = [
  { value: 1, labelKey: "modelResources.quotas.units.thousand" as const },
  { value: 2, labelKey: "modelResources.quotas.units.tenThousand" as const },
  { value: 4, labelKey: "modelResources.quotas.units.million" as const },
  { value: 5, labelKey: "modelResources.quotas.units.tenMillion" as const },
  { value: 6, labelKey: "modelResources.quotas.units.hundredMillion" as const },
];

export const QUOTA_PRICE_TYPE_OPTIONS = [
  { value: "thousand", labelKey: "modelResources.quotas.units.thousandTokens" as const },
  { value: "million", labelKey: "modelResources.quotas.units.millionTokens" as const },
];
