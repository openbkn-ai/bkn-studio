import type { CatalogListSceneProps } from "@/modules/execution-factory/contracts/scenes";

import { ExecutionUnitListScene } from "./ExecutionUnitListScene";

export function CatalogListScene({ defaultKeyword }: CatalogListSceneProps) {
  return (
    <ExecutionUnitListScene
      defaultKeyword={defaultKeyword}
      defaultTab="toolbox"
      descriptionKey="executionFactory.catalogDescription"
      marketMode
      titleKey="executionFactory.catalogTitle"
      toolbarHintKey="executionFactory.catalogToolbarHint"
    />
  );
}
