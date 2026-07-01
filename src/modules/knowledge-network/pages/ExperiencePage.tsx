/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { AntdProviders } from "@/framework/ui/AntdProviders";
import { ExperienceScene } from "@/modules/knowledge-network/scenes/ExperienceScene";

export function ExperiencePage() {
  const runtimeConfig = useRuntimeConfig();

  return (
    <AntdProviders runtimeConfig={runtimeConfig}>
      <ExperienceScene />
    </AntdProviders>
  );
}
