import { getRuntimeConfig } from "@/framework/runtime/config";

const DEFAULT_BUSINESS_DOMAIN = "bd_public";

export function getExecutionFactoryApiHeaders() {
  const runtime = getRuntimeConfig();
  const businessDomainId =
    runtime.currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  const headers: Record<string, string> = {
    "x-business-domain": businessDomainId,
  };

  if (runtime.currentUser.id) {
    headers.user_id = runtime.currentUser.id;
  }

  return headers;
}
