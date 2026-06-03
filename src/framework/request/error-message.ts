import axios from "axios";

import i18n from "@/app/locales/i18n";

type ErrorResponseBody = {
  error?: string;
  message?: string;
};

export function extractRequestErrorMessage(error: unknown) {
  if (axios.isAxiosError<ErrorResponseBody>(error)) {
    const responseMessage = error.response?.data?.message;
    const responseError = error.response?.data?.error;

    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }

    if (typeof responseError === "string" && responseError.trim()) {
      return responseError;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return i18n.t("common.requestFailed");
}

