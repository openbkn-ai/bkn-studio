/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal, Space } from "antd";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useBeforeUnload, useBlocker } from "react-router-dom";

import { AppButton } from "@/framework/ui/common/AppButton";

import { Unsaved, type Save } from "./unsaved";

const PREFIX = "bknProject.leaveUnsaved";

/**
 * Keeps changes not saved in the project's editors from being lost by leaving: moving to another
 * page of the project or out of it, or going back, asks to save, discard or stay; reloading or
 * closing the tab gets the browser's own warning. Moving within a page, such as between its tabs
 * or closing an editor, is the editor's to ask about.
 */
export function UnsavedLeaveGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const editors = useRef(new Set<{ current: Save }>());
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const add = useCallback((save: { current: Save }) => {
    editors.current.add(save);
    setCount(editors.current.size);
    return () => {
      editors.current.delete(save);
      setCount(editors.current.size);
    };
  }, []);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      count > 0 && currentLocation.pathname !== nextLocation.pathname,
  );
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (count > 0) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      [count],
    ),
  );

  const saveAndLeave = async () => {
    setSaving(true);
    try {
      for (const save of [...editors.current]) {
        // A save refused stays where the editor shows why.
        if (!(await save.current())) {
          blocker.reset?.();
          return;
        }
      }
      blocker.proceed?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Unsaved.Provider value={{ add }}>
      {children}
      <Modal
        closable={!saving}
        footer={
          <Space>
            <AppButton disabled={saving} onClick={() => blocker.reset?.()}>
              {t(`${PREFIX}.stay`)}
            </AppButton>
            <AppButton danger disabled={saving} onClick={() => blocker.proceed?.()}>
              {t(`${PREFIX}.discard`)}
            </AppButton>
            <AppButton loading={saving} onClick={() => void saveAndLeave()} type="primary">
              {t(`${PREFIX}.save`)}
            </AppButton>
          </Space>
        }
        maskClosable={false}
        onCancel={() => blocker.reset?.()}
        open={blocker.state === "blocked"}
        title={t(`${PREFIX}.title`)}
      >
        {t(`${PREFIX}.content`)}
      </Modal>
    </Unsaved.Provider>
  );
}
