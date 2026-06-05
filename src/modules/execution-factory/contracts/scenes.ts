export type UnitManagementListSceneProps = {
  defaultKeyword?: string;
  onOpenDetail?: (operatorId: string) => void;
};

export type CatalogListSceneProps = {
  defaultKeyword?: string;
  onOpenDetail?: (operatorId: string) => void;
};

export type UnitFormSceneProps = {
  mode: "create" | "edit";
  operatorId?: string;
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

export type ToolboxFormSceneProps = {
  mode: "create" | "edit";
  boxId?: string;
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

export type ToolboxToolsSceneProps = {
  boxId: string;
  onBack?: () => void;
};

export type McpFormSceneProps = {
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

export type SkillFormSceneProps = {
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

export type SkillEditSceneProps = {
  skillId?: string;
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};
