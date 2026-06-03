import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { useTranslation } from "react-i18next";

function getRouteErrorStatus(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return error.status;
  }

  return 500;
}

export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const status = getRouteErrorStatus(error);
  const title =
    status === 404 ? t("common.pageNotFound") : t("common.unexpectedError");

  return (
    <div className="status-page">
      <div className="status-card">
        <span className="status-code">{status}</span>
        <h1 className="status-title">{title}</h1>
        <p className="status-description">{t("common.routeErrorDescription")}</p>
        <div className="status-actions">
          <button
            className="status-button status-button-primary"
            onClick={() => {
              window.location.reload();
            }}
            type="button"
          >
            {t("common.reload")}
          </button>
          <button
            className="status-button"
            onClick={() => {
              void navigate("/starter");
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

