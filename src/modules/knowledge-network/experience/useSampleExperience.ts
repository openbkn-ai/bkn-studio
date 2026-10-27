/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import {
  loadSampleExperience,
  type SampleExperience,
} from "@/modules/knowledge-network/experience/sample-experience";

/** The installed sample's experience set for this network, or null while loading and when none. */
export function useSampleExperience(knId: string): SampleExperience | null {
  const [experience, setExperience] = useState<SampleExperience | null>(null);
  useEffect(() => {
    let cancelled = false;
    setExperience(null);
    if (!knId) return;
    void loadSampleExperience(knId).then((loaded) => {
      if (!cancelled) setExperience(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [knId]);
  return experience;
}
