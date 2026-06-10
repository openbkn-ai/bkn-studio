export type MockActionToolParameter = {
  name: string;
  required?: boolean;
  type?: string;
};

export type MockActionTool = {
  boxId: string;
  boxName: string;
  parameters: MockActionToolParameter[];
  toolId: string;
  toolName: string;
  type: "tool";
};
