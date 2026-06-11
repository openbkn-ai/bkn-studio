import { useParams } from "react-router-dom";

import { McpDetailScene } from "@/modules/execution-factory/scenes/McpDetailScene";

export function McpDetailPage() {
  const { mcpId } = useParams<{ mcpId: string }>();

  if (!mcpId) {
    return null;
  }

  return <McpDetailScene mcpId={mcpId} />;
}
