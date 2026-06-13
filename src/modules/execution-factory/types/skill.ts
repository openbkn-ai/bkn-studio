export type SkillStatus = "unpublish" | "published" | "offline";

export type SkillRecord = {
  skillId: string;
  name: string;
  description?: string;
  version?: string;
  status: SkillStatus;
  category?: string;
  categoryName?: string;
  createTime?: number;
  createUser?: string;
  updateTime?: number;
};

export type SkillListQuery = {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: SkillStatus;
  category?: string;
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

export type SkillFileSummary = {
  relPath: string;
  fileType?: string;
  size?: number;
  mimeType?: string;
};

export type SkillManagementFileReadResult = {
  skillId: string;
  relPath: string;
  url?: string;
  content?: string;
  mimeType?: string;
  fileType?: string;
  size?: number;
};

export type SkillFilePreviewResult =
  | { kind: "text"; content: string }
  | { kind: "binary"; url: string; mimeType?: string; size?: number };

export type SkillContentResult = {
  content?: string;
  /** @deprecated use fileSummaries */
  files?: string[];
  fileSummaries?: SkillFileSummary[];
  downloadUrl?: string;
  fileType?: string;
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
