export const starterModuleManifest = {
  id: "starter",
  name: "Starter",
  permissions: ["starter:create", "starter:edit", "starter:toggle"],
  requiresShell: true,
  supportsEmbedded: false,
  supportsReadOnly: false,
  services: ["starter/mock-service"],
  scenes: [],
} as const;
