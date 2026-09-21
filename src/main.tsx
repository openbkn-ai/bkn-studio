/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import "@ant-design/v5-patch-for-react-19";
import "@/app/locales/i18n";
import "@/styles/global.css";
// Extensions register here, after the translations exist and before the router is built.
import "@/app/extensions/installed";
import { startStandaloneApp } from "@/framework/runtime/bootstrap";

startStandaloneApp();
