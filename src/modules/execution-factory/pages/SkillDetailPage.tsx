/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { SkillDetailScene } from "@/modules/execution-factory/scenes/SkillDetailScene";

export function SkillDetailPage() {
  const { skillId } = useParams<{ skillId: string }>();

  if (!skillId) {
    return null;
  }

  return <SkillDetailScene skillId={skillId} />;
}
