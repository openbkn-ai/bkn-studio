/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { enUS } from "@/app/locales/resources/en-US";
import { zhCN } from "@/app/locales/resources/zh-CN";

void i18n.use(initReactI18next).init({
  lng: "zh-CN",
  fallbackLng: "en-US",
  resources: {
    "zh-CN": {
      translation: zhCN,
    },
    "en-US": {
      translation: enUS,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

