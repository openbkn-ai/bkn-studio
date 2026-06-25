import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { AntdProviders } from "@/framework/ui/AntdProviders";
import { EvalScene } from "@/modules/knowledge-network/scenes/EvalScene";

export function EvalPage() {
  const runtimeConfig = useRuntimeConfig();

  return (
    <AntdProviders runtimeConfig={runtimeConfig}>
      <EvalScene />
    </AntdProviders>
  );
}
