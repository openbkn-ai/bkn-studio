import { useParams } from "react-router-dom";

import { UnitFormScene } from "@/modules/execution-factory/scenes/UnitFormScene";

type UnitFormPageProps = {
  mode: "create" | "edit";
};

export function UnitFormPage({ mode }: UnitFormPageProps) {
  const { operatorId } = useParams<{ operatorId: string }>();

  return <UnitFormScene mode={mode} operatorId={operatorId} />;
}
