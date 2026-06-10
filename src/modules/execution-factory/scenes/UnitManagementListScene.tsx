import type { UnitManagementListSceneProps } from "@/modules/execution-factory/contracts/scenes";

import { ExecutionUnitListScene } from "./ExecutionUnitListScene";

export function UnitManagementListScene({
  defaultKeyword,
}: UnitManagementListSceneProps) {
  return (
    <ExecutionUnitListScene
      defaultKeyword={defaultKeyword}
      descriptionKey="executionFactory.unitManagementDescription"
      titleKey="executionFactory.unitManagementTitle"
      toolbarHintKey="executionFactory.toolbarHint"
    />
  );
}
