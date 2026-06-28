import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { AntdProviders } from "@/framework/ui/AntdProviders";
import { ExperienceScene } from "@/modules/knowledge-network/scenes/ExperienceScene";

export function ExperiencePage() {
  const runtimeConfig = useRuntimeConfig();

  return (
    <AntdProviders runtimeConfig={runtimeConfig}>
      <ExperienceScene />
    </AntdProviders>
  );
}
