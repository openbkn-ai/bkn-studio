export type KnowledgeNetworkTaskJobType = "full" | "incremental";

export type KnowledgeNetworkTaskState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "canceled";

export type KnowledgeNetworkTaskRecord = {
  duration: string;
  finishTime: string;
  id: string;
  jobType: KnowledgeNetworkTaskJobType;
  name: string;
  startTime: string;
  state: KnowledgeNetworkTaskState;
  stateDetail?: string;
};

export type KnowledgeNetworkTaskChildRecord = {
  conceptName: string;
  conceptType: string;
  duration: string;
  id: string;
  state: KnowledgeNetworkTaskState;
  stateDetail?: string;
};
