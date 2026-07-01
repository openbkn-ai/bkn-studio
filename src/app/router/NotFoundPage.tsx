/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="status-page">
      <div className="status-card">
        <span className="status-code">404</span>
        <h1 className="status-title">{t("common.pageNotFound")}</h1>
        <p className="status-description">{t("common.notFoundDescription")}</p>
        <div className="status-actions">
          <button
            className="status-button status-button-primary"
            onClick={() => {
              void navigate("/knowledge-network");
            }}
            type="button"
          >
            {t("common.backHome")}
          </button>
        </div>
      </div>
    </div>
  );
}
