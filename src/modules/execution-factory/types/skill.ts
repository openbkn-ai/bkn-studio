export type SkillStatus = "unpublish" | "published" | "offline";

export type SkillRecord = {
  skillId: string;
  name: string;
  description?: string;
  version?: string;
  status: SkillStatus;
  category?: string;
  categoryName?: string;
  createUser?: string;
  updateTime?: number;
};

export type SkillListQuery = {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: SkillStatus;
};

export type SkillListResult = {
  items: SkillRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type SkillRegisterInput = {
  fileType: "zip" | "content";
  file: Blob | string;
  category?: string;
  source?: string;
};

export type SkillContentResult = {
  content?: string;
  files?: string[];
  downloadUrl?: string;
};

export type SkillMetadataEditInput = {
  name: string;
  description: string;
  category: "other_category" | "system";
  source?: "custom" | "internal";
};

export type SkillPackageUpdateInput = {
  fileType: "zip" | "content";
  file: Blob | string;
};

export type SkillHistoryRecord = {
  skillId: string;
  name: string;
  description?: string;
  version: string;
  status: SkillStatus | "editing";
  releaseUser?: string;
  releaseTime?: number;
};
