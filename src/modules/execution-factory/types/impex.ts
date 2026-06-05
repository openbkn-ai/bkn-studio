export type ImpexComponentType = "operator" | "toolbox" | "mcp";

export type ImpexImportMode = "create" | "upsert";

export type ImpexExportResult = Record<string, unknown>;

export type ImpexImportResult = {
  type: ImpexComponentType;
  id?: string;
};
