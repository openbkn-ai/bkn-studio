/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import Icon, { PythonOutlined } from "@ant-design/icons";
import type { ComponentProps, ReactNode } from "react";

import styles from "./ScriptTypeBadge.module.css";

/** Three nodes and the relationships between them: a graph, which a Cypher statement queries. */
function CypherGlyph() {
  return (
    <svg fill="currentColor" height="1em" viewBox="0 0 24 24" width="1em">
      <path
        d="M6 6.5 17.5 8.5M6 6.5l3.8 11M17.5 8.5l-7.7 9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx="6" cy="6.5" r="3.6" />
      <circle cx="17.5" cy="8.5" r="3.6" />
      <circle cx="9.8" cy="17.5" r="3.6" />
    </svg>
  );
}

export function CypherIcon(props: Omit<ComponentProps<typeof Icon>, "component">) {
  return <Icon component={CypherGlyph} {...props} />;
}

const KNOWN: Record<string, { icon: ReactNode; label: string }> = {
  python: { icon: <PythonOutlined />, label: "Python" },
  cypher: { icon: <CypherIcon />, label: "Cypher" },
};

/**
 * The language a function is written in, by its own color and icon so a list of mixed
 * functions reads at a glance. An unknown type shows as plain text.
 */
export function ScriptTypeBadge({ scriptType }: { scriptType: string }) {
  const known = KNOWN[scriptType];
  return (
    <span className={styles.badge} data-script-type={known ? scriptType : "other"}>
      {known?.icon}
      {known?.label ?? scriptType.charAt(0).toUpperCase() + scriptType.slice(1)}
    </span>
  );
}
