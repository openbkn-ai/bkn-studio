import { createContext } from "react";

export type WorkspaceSlotsValue = {
  toolbarHost: HTMLDivElement | null;
};

export const WorkspaceSlotsContext = createContext<WorkspaceSlotsValue | null>(null);
