import type { UnitManagementListSceneProps } from "@/modules/execution-factory/contracts/scenes";
import {
  getDefaultManagementTab,
  getManagementTabs,
  isCapabilityUxV2,
} from "@/modules/execution-factory/utils/capability-ux";

import { ExecutionUnitListScene } from "./ExecutionUnitListScene";

export function UnitManagementListScene({
  defaultKeyword,
}: UnitManagementListSceneProps) {
  const capabilityUxV2 = isCapabilityUxV2();

  return (
    <ExecutionUnitListScene
      defaultKeyword={defaultKeyword}
      defaultTab={getDefaultManagementTab()}
      descriptionKey={
        capabilityUxV2
          ? "executionFactory.capabilityManagementDescription"
          : "executionFactory.unitManagementDescription"
      }
      tabs={getManagementTabs()}
      titleKey={
        capabilityUxV2
          ? "executionFactory.capabilityManagementTitle"
          : "executionFactory.unitManagementTitle"
      }
      toolbarHintKey={
        capabilityUxV2
          ? "executionFactory.capabilityToolbarHint"
          : "executionFactory.toolbarHint"
      }
    />
  );
}
