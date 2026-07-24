/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import "@/app/locales/i18n";
import "@/styles/global.css";
// Monaco 自托管配置要在任何编辑器挂载前跑，放最前面。
import "@/framework/monaco/setup";
import { startStandaloneApp } from "@/framework/runtime/bootstrap";

startStandaloneApp();

