export type FunctionParameterDef = {
  name?: string;
  type?: string;
  description?: string;
};

export type FunctionInputPayload = {
  name?: string;
  description?: string;
  code?: string;
  script_type?: "python";
  inputs?: FunctionParameterDef[];
  outputs?: FunctionParameterDef[];
  dependencies?: Array<{ name?: string; version?: string }>;
};
