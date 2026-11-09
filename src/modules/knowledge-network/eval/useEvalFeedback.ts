/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { App, Modal, message as staticMessage } from "antd";

/**
 * Uses Ant Design's contextual feedback APIs in the application, while also
 * keeping isolated renders (component previews and unit tests) functional.
 */
export function useEvalFeedback() {
  const context = App.useApp();

  return {
    message: typeof context.message?.error === "function" ? context.message : staticMessage,
    modal: typeof context.modal?.confirm === "function" ? context.modal : Modal,
  };
}
