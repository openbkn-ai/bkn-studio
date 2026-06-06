import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { RouteLoading } from "@/app/router/RouteLoading";
import { ExecutionUnitTabRedirect } from "@/modules/execution-factory/pages/ExecutionUnitTabRedirect";

const UnitManagementListPage = lazy(async () => {
  const module = await import("@/modules/execution-factory/pages/UnitManagementListPage");
  return { default: module.UnitManagementListPage };
});

const CatalogListPage = lazy(async () => {
  const module = await import("@/modules/execution-factory/pages/CatalogListPage");
  return { default: module.CatalogListPage };
});

const UnitFormPage = lazy(async () => {
  const module = await import("@/modules/execution-factory/pages/UnitFormPage");
  return { default: module.UnitFormPage };
});

const ToolboxFormPage = lazy(async () => {
  const module = await import("@/modules/execution-factory/pages/ToolboxFormPage");
  return { default: module.ToolboxFormPage };
});

const ToolboxToolsPage = lazy(async () => {
  const module = await import("@/modules/execution-factory/pages/ToolboxToolsPage");
  return { default: module.ToolboxToolsPage };
});

const SkillEditPage = lazy(async () => {
  const module = await import("@/modules/execution-factory/pages/SkillEditPage");
  return { default: module.SkillEditPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const executionFactoryRoutes: RouteObject[] = [
  {
    path: "execution-factory/units",
    handle: {
      console: {
        descriptionKey: "executionFactory.unitManagementDescription",
        menuKey: "execution-unit-management",
        titleKey: "executionFactory.unitManagementTitle",
      },
    },
    element: withRouteLoading(<UnitManagementListPage />),
  },
  {
    path: "execution-factory/units/new",
    handle: {
      console: {
        descriptionKey: "executionFactory.createDescription",
        menuKey: "execution-unit-management",
        titleKey: "executionFactory.createTitle",
      },
    },
    element: withRouteLoading(<UnitFormPage mode="create" />),
  },
  {
    path: "execution-factory/units/:operatorId/edit",
    handle: {
      console: {
        descriptionKey: "executionFactory.editDescription",
        menuKey: "execution-unit-management",
        titleKey: "executionFactory.editTitle",
      },
    },
    element: withRouteLoading(<UnitFormPage mode="edit" />),
  },
  {
    path: "execution-factory/toolboxes/new",
    handle: {
      console: {
        descriptionKey: "executionFactory.toolboxCreateDescription",
        menuKey: "execution-unit-management",
        titleKey: "executionFactory.toolboxCreateTitle",
      },
    },
    element: withRouteLoading(<ExecutionUnitTabRedirect activeTab="toolbox" openCreate />),
  },
  {
    path: "execution-factory/toolboxes/:boxId/edit",
    handle: {
      console: {
        descriptionKey: "executionFactory.toolboxEditDescription",
        menuKey: "execution-unit-management",
        titleKey: "executionFactory.toolboxEditTitle",
      },
    },
    element: withRouteLoading(<ToolboxFormPage mode="edit" />),
  },
  {
    path: "execution-factory/toolboxes/:boxId/tools",
    handle: {
      console: {
        descriptionKey: "executionFactory.toolboxToolsDescription",
        menuKey: "execution-unit-management",
        titleKey: "executionFactory.toolboxToolsPageTitle",
      },
    },
    element: withRouteLoading(<ToolboxToolsPage />),
  },
  {
    path: "execution-factory/mcp",
    handle: {
      console: {
        descriptionKey: "executionFactory.mcpListDescription",
        menuKey: "mcp-management",
        titleKey: "executionFactory.mcpListTitle",
      },
    },
    element: withRouteLoading(<ExecutionUnitTabRedirect activeTab="mcp" />),
  },
  {
    path: "execution-factory/mcp/new",
    handle: {
      console: {
        descriptionKey: "executionFactory.mcpCreateDescription",
        menuKey: "mcp-management",
        titleKey: "executionFactory.mcpCreateTitle",
      },
    },
    element: withRouteLoading(<ExecutionUnitTabRedirect activeTab="mcp" openCreate />),
  },
  {
    path: "execution-factory/skills",
    handle: {
      console: {
        descriptionKey: "executionFactory.skillListDescription",
        menuKey: "skill-management",
        titleKey: "executionFactory.skillListTitle",
      },
    },
    element: withRouteLoading(<ExecutionUnitTabRedirect activeTab="skill" />),
  },
  {
    path: "execution-factory/skills/new",
    handle: {
      console: {
        descriptionKey: "executionFactory.skillCreateDescription",
        menuKey: "skill-management",
        titleKey: "executionFactory.skillCreateTitle",
      },
    },
    element: withRouteLoading(<ExecutionUnitTabRedirect activeTab="skill" openCreate />),
  },
  {
    path: "execution-factory/skills/:skillId/edit",
    handle: {
      console: {
        descriptionKey: "executionFactory.skillEditDescription",
        menuKey: "skill-management",
        titleKey: "executionFactory.skillEditTitle",
      },
    },
    element: withRouteLoading(<SkillEditPage />),
  },
  {
    path: "execution-factory/catalog",
    handle: {
      console: {
        descriptionKey: "executionFactory.catalogDescription",
        menuKey: "all-execution-units",
        titleKey: "executionFactory.catalogTitle",
      },
    },
    element: withRouteLoading(<CatalogListPage />),
  },
];

export const executionFactoryRouteContribution: AppRouteContribution = {
  moduleId: "execution-factory",
  routes: executionFactoryRoutes,
};
