/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext, useContext, useEffect, useRef } from "react";

/** Saves what is being edited; true once it is saved, false when it was not and the editor says why. */
export type Save = () => Promise<boolean>;

export const Unsaved = createContext<{
  add: (save: { current: Save }) => () => void;
}>({ add: () => () => undefined });

/**
 * Says the editor has changes not saved, while `dirty`: leaving the project's pages then asks
 * first, and saving from there uses `save`.
 */
export function useUnsavedChanges(dirty: boolean, save: Save) {
  const { add } = useContext(Unsaved);
  // The latest save, as the editor's values change.
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  });
  useEffect(() => (dirty ? add(latest) : undefined), [add, dirty]);
}
