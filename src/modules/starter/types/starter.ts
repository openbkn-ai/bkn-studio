export type StarterRecordStatus = "disabled" | "enabled";

export type StarterRecord = {
  id: string;
  name: string;
  owner: string;
  status: StarterRecordStatus;
  updatedAt: string;
};

export type StarterListQuery = {
  keyword: string;
  page: number;
  pageSize: number;
};

export type StarterListResult = {
  items: StarterRecord[];
  total: number;
};

export type StarterMutationInput = {
  name: string;
  owner: string;
  summary: string;
};
