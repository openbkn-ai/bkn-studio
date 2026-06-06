import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";

type BackendMetadata = {
  api_spec?: unknown;
  function_content?: {
    code?: string;
    dependencies?: FunctionInputPayload["dependencies"];
    script_type?: string;
  };
};

export function serializeOpenApiSpec(metadata?: BackendMetadata): string | undefined {
  if (!metadata?.api_spec) {
    return undefined;
  }

  if (typeof metadata.api_spec === "string") {
    return metadata.api_spec;
  }

  return JSON.stringify(metadata.api_spec, null, 2);
}

export function mapFunctionContent(
  metadata?: BackendMetadata,
): FunctionInputPayload | undefined {
  const content = metadata?.function_content;

  if (!content?.code) {
    return undefined;
  }

  return {
    code: content.code,
    script_type: (content.script_type as "python") ?? "python",
    dependencies: content.dependencies,
  };
}
