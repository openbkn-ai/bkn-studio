import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type {
  FunctionAiGenerateInput,
  FunctionAiGenerateResult,
  FunctionAiGenerateType,
  FunctionExecuteInput,
  FunctionExecuteResult,
} from "@/modules/execution-factory/types/function";

const API_PREFIX = "/agent-operator-integration/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

export async function executeFunction(
  input: FunctionExecuteInput,
): Promise<FunctionExecuteResult> {
  if (useMock) {
    return {
      output: { echo: input.event ?? {}, status: "ok" },
      durationMs: 84,
    };
  }

  const response = await http.post<{
    data?: unknown;
    duration_ms?: number;
    error?: string;
  }>(
    `${API_PREFIX}/function/execute`,
    {
      code: input.code,
      event: input.event,
      timeout: input.timeout,
    },
    { headers: getBusinessDomainHeaders() },
  );

  return {
    output: response.data.data,
    error: response.data.error,
    durationMs: response.data.duration_ms,
  };
}

export async function generateFunction(
  input: FunctionAiGenerateInput,
): Promise<FunctionAiGenerateResult> {
  if (useMock) {
    if (input.type === "metadata_param_generator") {
      return {
        content: {
          description: "Generated function metadata from code.",
          inputs: [{ name: "event", type: "object" }],
          name: "generated_handler",
          outputs: [{ name: "result", type: "object" }],
          use_rule: "Pass event payload as input.",
        },
      };
    }

    return {
      content: `def handler(event):\n    """${input.query ?? "Generated function"}"""\n    return event`,
    };
  }

  const response = await http.post<{
    content?: unknown;
  }>(
    `${API_PREFIX}/ai_generate/function/${input.type}`,
    {
      code: input.code,
      query: input.query,
    },
    { headers: getBusinessDomainHeaders() },
  );

  return { content: response.data.content };
}

export async function getFunctionPrompt(
  type: FunctionAiGenerateType,
): Promise<FunctionAiGenerateResult> {
  if (useMock) {
    return {
      prompt:
        "Describe the Python function you want to generate. Include inputs, outputs, and behavior.",
    };
  }

  const response = await http.get<{
    description?: string;
    system_prompt?: string;
  }>(`${API_PREFIX}/ai_generate/prompt/${type}`, {
    headers: getBusinessDomainHeaders(),
  });

  return {
    prompt: response.data.system_prompt ?? response.data.description,
  };
}
