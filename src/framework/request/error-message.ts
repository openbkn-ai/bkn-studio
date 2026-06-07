import axios from "axios";

import i18n from "@/app/locales/i18n";

type ErrorResponseBody = {
  error?: string;
  message?: string;
  description?: string;
};

export function extractRequestErrorMessage(error: unknown) {
  if (axios.isAxiosError<ErrorResponseBody>(error)) {
    const data = error.response?.data;
    const responseDescription = data?.description;
    const responseMessage = data?.message;
    const responseError = data?.error;

    if (typeof responseDescription === "string" && responseDescription.trim()) {
      return responseDescription;
    }

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

