/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApiOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileUnknownOutlined,
  ForkOutlined,
  LineChartOutlined,
  ReadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import { SkillsSparkIcon } from "./SkillsSparkIcon";

/** Resource categories share their glyphs across workspace navigation and Eval. */
export function KnowledgeResourceIcon({ kind }: { kind?: string }) {
  switch (kind) {
    case "conceptGroup":
      return <ApartmentOutlined aria-hidden />;
    case "objectType":
    case "objectProperty":
      return <DatabaseOutlined aria-hidden />;
    case "relationType":
      return <ApiOutlined aria-hidden />;
    case "action":
      return <ThunderboltOutlined aria-hidden />;
    case "metric":
      return <LineChartOutlined aria-hidden />;
    case "function":
      return <CodeOutlined aria-hidden />;
    case "api":
      return <CloudServerOutlined aria-hidden />;
    case "mcp":
      return <ForkOutlined aria-hidden />;
    case "skill":
      return <SkillsSparkIcon />;
    case "knowledgeBase":
      return <ReadOutlined aria-hidden />;
    case "scenario":
      return <DeploymentUnitOutlined aria-hidden />;
    case "all":
      return <AppstoreOutlined aria-hidden />;
    default:
      return <FileUnknownOutlined aria-hidden />;
  }
}
