/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import "@/app/locales/i18n";
import "@/styles/global.css";
import { createRoot } from "react-dom/client";

import { GraphView } from "./GraphView";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root was not found.");
}
createRoot(container).render(<GraphView />);
