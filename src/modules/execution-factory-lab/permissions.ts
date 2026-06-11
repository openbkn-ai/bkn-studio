export const executionFactoryLabPermissions = {
  capabilityView: "execution-factory-lab:capability:view",
  capabilityCreate: "execution-factory-lab:capability:create",
  capabilityEdit: "execution-factory-lab:capability:edit",
  capabilityPublish: "execution-factory-lab:capability:publish",
  capabilityDelete: "execution-factory-lab:capability:delete",
  capabilityDebug: "execution-factory-lab:capability:debug",
  mcpCreate: "execution-factory-lab:mcp:create",
  mcpPublish: "execution-factory-lab:mcp:publish",
  mcpDelete: "execution-factory-lab:mcp:delete",
  mcpDebug: "execution-factory-lab:mcp:debug",
  skillCreate: "execution-factory-lab:skill:create",
  skillPublish: "execution-factory-lab:skill:publish",
  skillDelete: "execution-factory-lab:skill:delete",
  impexExport: "execution-factory-lab:impex:export",
  impexImport: "execution-factory-lab:impex:import",
  catalogView: "execution-factory-lab:catalog:view",
  catalogInstall: "execution-factory-lab:catalog:install",
  functionCreate: "execution-factory-lab:function:create",
  functionDebug: "execution-factory-lab:function:debug",
} as const;

export const executionFactoryLabPermissionList = Object.values(executionFactoryLabPermissions);
