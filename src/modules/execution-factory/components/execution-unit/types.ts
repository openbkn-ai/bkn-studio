export type ExecutionUnitTab = "mcp" | "toolbox" | "operator" | "skill";

export type ExecutionUnitCardItem = {
  id: string;
  name: string;
  description?: string;
  metadataType?: string;
  isInternal?: boolean;
  toolCount?: number;
  releaseUser?: string;
  updateUser?: string;
  releaseTime?: number;
  updateTime?: number;
  status?: string;
  version?: string;
};
