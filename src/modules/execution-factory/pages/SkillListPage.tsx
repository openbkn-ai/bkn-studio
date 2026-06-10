import { ExecutionUnitTabRedirect } from "@/modules/execution-factory/pages/ExecutionUnitTabRedirect";

/** @deprecated Use `ExecutionUnitListScene` via `/execution-factory/units?activeTab=skill` instead. */
export function SkillListPage() {
  return (
    <ExecutionUnitTabRedirect activeTab="skill" migrationFrom="legacy-skill-list" />
  );
}
