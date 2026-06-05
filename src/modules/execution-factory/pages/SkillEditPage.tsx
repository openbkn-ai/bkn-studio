import { useParams } from "react-router-dom";

import { SkillEditScene } from "@/modules/execution-factory/scenes/SkillEditScene";

export function SkillEditPage() {
  const { skillId } = useParams<{ skillId: string }>();

  return <SkillEditScene skillId={skillId} />;
}
