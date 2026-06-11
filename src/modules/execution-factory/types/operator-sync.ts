import type { OperatorCategory, OperatorExecuteControl } from "@/modules/execution-factory/types/operator";

export type OperatorSyncPublishInput = {
  enabled?: boolean;
  name?: string;
  category?: OperatorCategory;
  executeControl?: OperatorExecuteControl;
  directPublish?: boolean;
};
