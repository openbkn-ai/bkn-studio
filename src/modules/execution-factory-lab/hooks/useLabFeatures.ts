/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import {
  loadLabMeta,
  resolveLabFeatureFlags,
} from "@/modules/execution-factory-lab/utils/lab-features";
import type { LabFeatureFlags, LabMeta } from "@/modules/execution-factory-lab/types/lab-meta";

type LabFeaturesState = {
  features: LabFeatureFlags;
  loading: boolean;
  meta: LabMeta | null;
};

export function useLabFeatures(): LabFeaturesState {
  const [state, setState] = useState<LabFeaturesState>(() => ({
    features: resolveLabFeatureFlags(),
    loading: true,
    meta: null,
  }));

  useEffect(() => {
    let active = true;

    void loadLabMeta()
      .then((meta) => {
        if (!active) {
          return;
        }

        setState({
          features: resolveLabFeatureFlags(meta),
          loading: false,
          meta,
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setState({
          features: resolveLabFeatureFlags(),
          loading: false,
          meta: null,
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
