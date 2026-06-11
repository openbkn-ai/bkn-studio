import { useParams } from "react-router-dom";

import { SkillDetailScene } from "@/modules/execution-factory/scenes/SkillDetailScene";

export function SkillDetailPage() {
  const { skillId } = useParams<{ skillId: string }>();

  if (!skillId) {
    return null;
  }

  return <SkillDetailScene skillId={skillId} />;
}
