import { useParams } from "react-router-dom";

import { ToolboxFormScene } from "@/modules/execution-factory/scenes/ToolboxFormScene";

type ToolboxFormPageProps = {
  mode: "create" | "edit";
};

export function ToolboxFormPage({ mode }: ToolboxFormPageProps) {
  const { boxId } = useParams<{ boxId: string }>();

  return <ToolboxFormScene boxId={boxId} mode={mode} />;
}
