export type FunctionExecuteInput = {
  code: string;
  event?: Record<string, unknown>;
  timeout?: number;
};

export type FunctionExecuteResult = {
  output?: unknown;
  error?: string;
  durationMs?: number;
};

export type FunctionAiGenerateType =
  | "python_function_generator"
  | "metadata_param_generator";

export type FunctionAiGenerateInput = {
  type: FunctionAiGenerateType;
  query?: string;
  code?: string;
};

export type FunctionAiGenerateResult = {
  content?: unknown;
  prompt?: string;
};
