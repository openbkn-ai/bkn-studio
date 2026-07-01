/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren } from "react";

export function PageContainer({ children }: PropsWithChildren) {
  return <section className="page-container">{children}</section>;
}

