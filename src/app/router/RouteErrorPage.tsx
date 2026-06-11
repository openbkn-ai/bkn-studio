import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { useTranslation } from "react-i18next";

function getRouteErrorStatus(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return error.status;
  }

  return 500;
}

function getRouteErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return null;
}

export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const status = getRouteErrorStatus(error);
  const detail = getRouteErrorMessage(error);
  const title =
    status === 404 ? t("common.pageNotFound") : t("common.unexpectedError");

  return (
    <div className="status-page">
      <div className="status-card">
        <span className="status-code">{status}</span>
        <h1 className="status-title">{title}</h1>
        <p className="status-description">{t("common.routeErrorDescription")}</p>
        {import.meta.env.DEV && detail ? (
          <pre
            style={{
              marginTop: 12,
              maxWidth: "100%",
              overflow: "auto",
              padding: 12,
              borderRadius: 8,
              background: "rgba(0, 0, 0, 0.04)",
              fontSize: 12,
              textAlign: "left",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {detail}
          </pre>
        ) : null}
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
