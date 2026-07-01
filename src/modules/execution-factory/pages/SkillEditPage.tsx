/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { SkillEditScene } from "@/modules/execution-factory/scenes/SkillEditScene";

export function SkillEditPage() {
  const { skillId } = useParams<{ skillId: string }>();

  return <SkillEditScene skillId={skillId} />;
}
