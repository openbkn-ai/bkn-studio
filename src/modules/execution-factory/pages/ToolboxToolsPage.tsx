import { useParams } from "react-router-dom";

import { ToolboxToolsScene } from "@/modules/execution-factory/scenes/ToolboxToolsScene";

export function ToolboxToolsPage() {
  const { boxId } = useParams<{ boxId: string }>();

  if (!boxId) {
    return null;
  }

  return <ToolboxToolsScene boxId={boxId} />;
}
