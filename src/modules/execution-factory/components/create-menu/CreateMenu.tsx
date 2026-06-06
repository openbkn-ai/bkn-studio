import { PlusOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

import { CreateMcpDrawer } from "./CreateMcpDrawer";
import { CreateOperatorModal } from "./CreateOperatorModal";
import { CreateSkillModal } from "./CreateSkillModal";
import { CreateToolboxModal } from "./CreateToolboxModal";
import styles from "./create-menu.module.css";

type CreateMenuProps = {
  activeTab: ExecutionUnitTab;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
  onMcpCreated?: (mcpId: string) => void;
  onRefresh?: () => void;
};

function getCreatePermission(activeTab: ExecutionUnitTab) {
  switch (activeTab) {
    case "operator":
      return "execution-factory:operator:create";
    case "toolbox":
      return "execution-factory:toolbox:create";
    case "mcp":
      return "execution-factory:mcp:create";
    case "skill":
      return "execution-factory:skill:create";
    default:
      return undefined;
  }
}

function getCreateLabel(activeTab: ExecutionUnitTab, t: (key: string) => string) {
  switch (activeTab) {
    case "operator":
      return t("executionFactory.createOperatorButton");
    case "toolbox":
      return t("executionFactory.createToolboxButton");
    case "mcp":
      return t("executionFactory.createMcpButton");
    case "skill":
      return t("executionFactory.importSkillButton");
    default:
      return t("common.create");
  }
}

function openCreateOverlay(
  activeTab: ExecutionUnitTab,
  setters: {
    setOperatorOpen: (open: boolean) => void;
    setToolboxOpen: (open: boolean) => void;
    setMcpOpen: (open: boolean) => void;
    setSkillOpen: (open: boolean) => void;
  },
) {
  switch (activeTab) {
    case "operator":
      setters.setOperatorOpen(true);
      break;
    case "toolbox":
      setters.setToolboxOpen(true);
      break;
    case "mcp":
      setters.setMcpOpen(true);
      break;
    case "skill":
      setters.setSkillOpen(true);
      break;
    default:
      break;
  }
}

export function CreateMenu({
  activeTab,
  autoOpen = false,
  onAutoOpenHandled,
  onMcpCreated,
  onRefresh,
}: CreateMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);

  const permission = getCreatePermission(activeTab);

  const handlePrimaryClick = () => {
    openCreateOverlay(activeTab, {
      setOperatorOpen,
      setToolboxOpen,
      setMcpOpen,
      setSkillOpen,
    });
  };

  useEffect(() => {
    if (!autoOpen || !permission) {
      return;
    }

    openCreateOverlay(activeTab, {
      setOperatorOpen,
      setToolboxOpen,
      setMcpOpen,
      setSkillOpen,
    });
    onAutoOpenHandled?.();
  }, [activeTab, autoOpen, onAutoOpenHandled, permission]);

  if (!permission) {
    return null;
  }

  return (
    <>
      <PermissionGate permissions={permission}>
        <div className={styles.toolbarRow}>
          <AppButton icon={<PlusOutlined />} onClick={handlePrimaryClick} type="primary">
            {getCreateLabel(activeTab, t)}
          </AppButton>
        </div>
      </PermissionGate>

      <CreateOperatorModal onClose={() => setOperatorOpen(false)} open={operatorOpen} />
      <CreateToolboxModal
        onClose={() => setToolboxOpen(false)}
        onCreated={(boxId) => {
          onRefresh?.();
          void navigate(`/execution-factory/toolboxes/${boxId}/tools?action=edit`);
        }}
        open={toolboxOpen}
      />
      <CreateMcpDrawer
        onClose={() => setMcpOpen(false)}
        onCreated={(mcpId) => {
          onRefresh?.();
          onMcpCreated?.(mcpId);
        }}
        open={mcpOpen}
      />
      <CreateSkillModal
        onClose={() => setSkillOpen(false)}
        onImported={() => {
          onRefresh?.();
        }}
        open={skillOpen}
      />
    </>
  );
}
