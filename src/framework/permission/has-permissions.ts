export type PermissionCheckMode = "all" | "any";

type HasPermissionsInput = {
  currentPermissions: string[];
  mode?: PermissionCheckMode;
  requiredPermissions: string | string[];
};

export function hasPermissions({
  currentPermissions,
  mode = "all",
  requiredPermissions,
}: HasPermissionsInput) {
  const required = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  if (required.length === 0) {
    return true;
  }

  if (mode === "any") {
    return required.some((permission) =>
      currentPermissions.includes(permission),
    );
  }

  return required.every((permission) => currentPermissions.includes(permission));
}

