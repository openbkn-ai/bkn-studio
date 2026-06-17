import { Space, Tag, Tree } from "antd";
import type { DataNode } from "antd/es/tree";
import type { TreeProps } from "antd/es/tree";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import type { AdminDepartment } from "@/modules/system-admin/types/admin";

import styles from "@/modules/system-admin/scenes/admin.module.css";

const deptTypeLabelKey: Record<string, string> = {
  org: "systemAdmin.users.deptDrawer.typeOrg",
  dept: "systemAdmin.users.deptDrawer.typeDept",
};

type DepartmentTreeProps = {
  deptMembers: Record<string, string[]>;
  departments: AdminDepartment[];
  onAddChild: (parentId: string) => void;
  onDelete: (dept: AdminDepartment) => void;
  onEdit: (dept: AdminDepartment) => void;
  onMembers: (dept: AdminDepartment) => void;
  onReparent: (dragId: string, newParentId: string | null) => void;
};

export function DepartmentTree({
  deptMembers,
  departments,
  onAddChild,
  onDelete,
  onEdit,
  onMembers,
  onReparent,
}: DepartmentTreeProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();

  const byId = useMemo(
    () => new Map(departments.map((dept) => [dept.id, dept])),
    [departments],
  );

  const { treeData, expandedKeys } = useMemo(() => {
    const keys: string[] = [];
    const childrenOf = (parentId: string | null): DataNode[] =>
      departments
        .filter((dept) => dept.parentId === parentId)
        .map((dept) => {
          keys.push(dept.id);
          return {
            key: dept.id,
            title: (
              <div className={styles.deptNode}>
                <span className={styles.deptNodeName}>{dept.name}</span>
                <Tag className={styles.permChip}>
                  {deptTypeLabelKey[dept.type] ? t(deptTypeLabelKey[dept.type]) : dept.type}
                </Tag>
                <span className={styles.deptNodeCount}>
                  {(deptMembers[dept.id] ?? []).length} {t("systemAdmin.users.deptNode.memberUnit")}
                </span>
                <Space className={styles.deptNodeActions} onClick={(e) => e.stopPropagation()}>
                  <PermissionGate permissions="admin-dept:members">
                    <AppButton className={styles.actionLink} onClick={() => onMembers(dept)} type="link">
                      {t("systemAdmin.users.actions.members")}
                    </AppButton>
                  </PermissionGate>
                  <PermissionGate permissions="admin-dept:create">
                    <AppButton className={styles.actionLink} onClick={() => onAddChild(dept.id)} type="link">
                      {t("systemAdmin.users.actions.addChild")}
                    </AppButton>
                  </PermissionGate>
                  <PermissionGate permissions="admin-dept:edit">
                    <AppButton className={styles.actionLink} onClick={() => onEdit(dept)} type="link">
                      {t("systemAdmin.users.actions.edit")}
                    </AppButton>
                  </PermissionGate>
                  <PermissionGate permissions="admin-dept:delete">
                    <AppButton
                      className={[styles.actionLink, styles.actionDanger].join(" ")}
                      onClick={() => onDelete(dept)}
                      type="link"
                    >
                      {t("systemAdmin.users.actions.delete")}
                    </AppButton>
                  </PermissionGate>
                </Space>
              </div>
            ),
            children: childrenOf(dept.id),
          };
        });
    const data = childrenOf(null);
    return { treeData: data, expandedKeys: keys };
  }, [departments, deptMembers, onAddChild, onDelete, onEdit, onMembers, t]);

  // 拖拽 re-parent：拖到节点上 → 成其子级；拖到间隙 → 与目标同级。
  const handleDrop: TreeProps["onDrop"] = (info) => {
    const dragId = String(info.dragNode.key);
    const dropId = String(info.node.key);
    const newParentId = info.dropToGap ? (byId.get(dropId)?.parentId ?? null) : dropId;

    if (dragId === newParentId) {
      return;
    }
    if ((byId.get(dragId)?.parentId ?? null) === newParentId) {
      return; // 没变化
    }
    // 不能移到自己的子孙下（成环）。
    const descendants = new Set<string>();
    const collect = (id: string) => {
      for (const child of departments.filter((d) => d.parentId === id)) {
        descendants.add(child.id);
        collect(child.id);
      }
    };
    collect(dragId);
    if (newParentId && descendants.has(newParentId)) {
      void message.error(t("systemAdmin.users.deptNode.cycleError"));
      return;
    }
    onReparent(dragId, newParentId);
  };

  return (
    <Tree
      blockNode
      className={styles.deptTree}
      draggable={{ icon: false }}
      expandedKeys={expandedKeys}
      onDrop={handleDrop}
      selectable={false}
      treeData={treeData}
    />
  );
}
