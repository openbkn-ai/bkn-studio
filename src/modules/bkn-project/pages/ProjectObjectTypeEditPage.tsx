/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Navigate, useParams } from "react-router-dom";

import { projectObjectTypePath } from "@/modules/bkn-project/types/workspace";

/** An object type's former editing page: it opens in the modeling page's panel now. */
export function ProjectObjectTypeEditPage() {
  const { itemId = "", projectId = "" } = useParams<{ itemId: string; projectId: string }>();
  return <Navigate replace to={projectObjectTypePath(projectId, itemId)} />;
}
