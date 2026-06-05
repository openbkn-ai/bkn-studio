import type { RuntimeUser } from "@/framework/runtime/types";
import { defaultDevPermissions } from "@/framework/runtime/module-manifests";

export const defaultDevRuntimeUser: RuntimeUser = {
  businessDomainId: "bd_public",
  id: "local-admin",
  name: "Local Admin",
  permissions: defaultDevPermissions,
  roles: ["admin"],
};
