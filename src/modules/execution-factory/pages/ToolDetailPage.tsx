import { useParams } from "react-router-dom";

import { ToolDetailScene } from "@/modules/execution-factory/scenes/ToolDetailScene";

export function ToolDetailPage() {
  const { boxId, toolId } = useParams<{ boxId: string; toolId: string }>();

  if (!boxId || !toolId) {
    return null;
  }

  return <ToolDetailScene boxId={boxId} toolId={toolId} />;
}
