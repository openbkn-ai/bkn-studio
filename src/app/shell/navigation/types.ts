import type { ReactNode } from "react";

export type ConsoleNavItem = {
  children?: ConsoleNavItem[];
  disabled?: boolean;
  icon?: ReactNode;
  key: string;
  labelKey: string;
  path?: string;
};

export type ConsoleNavContribution = {
  items: ConsoleNavItem[];
  parentKey?: string;
};
