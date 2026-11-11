/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Modal, Select, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";

/** Function toolboxes are listed in one page; a workspace with more is searched by name. */
const TOOLBOX_PAGE = 100;

/**
 * Picks the function toolbox a statement from the data query page becomes a Cypher function
 * in. The function itself is named, described and saved in that toolbox's workbench.
 */
export function CypherPublishFunctionModal({
  open,
  onCancel,
  onPick,
}: {
  open: boolean;
  onCancel: () => void;
  onPick: (boxId: string) => void;
}) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [toolboxes, setToolboxes] = useState<ToolboxRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [boxId, setBoxId] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    const timer = window.setTimeout(() => {
      listToolboxes({
        page: 1,
        pageSize: TOOLBOX_PAGE,
        metadataType: "function",
        keyword: keyword.trim() || undefined,
      })
        .then((result) => {
          if (!cancelled) setToolboxes(result.items);
        })
        .catch((caught: unknown) => {
          if (cancelled) return;
          setToolboxes([]);
          setError(caught instanceof Error ? caught.message : String(caught));
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [keyword, open]);

  return (
    <Modal
      destroyOnHidden
      okButtonProps={{ disabled: !boxId }}
      okText={t("knowledgeNetwork.cypherQuery.publish.ok")}
      onCancel={onCancel}
      onOk={() => {
        if (boxId) onPick(boxId);
      }}
      open={open}
      title={t("knowledgeNetwork.cypherQuery.publish.title")}
    >
      <p>{t("knowledgeNetwork.cypherQuery.publish.description")}</p>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      <Select
        aria-label={t("knowledgeNetwork.cypherQuery.publish.toolbox")}
        filterOption={false}
        notFoundContent={
          toolboxes === null ? (
            <Spin size="small" />
          ) : (
            t("knowledgeNetwork.cypherQuery.publish.noToolbox")
          )
        }
        onChange={setBoxId}
        onSearch={setKeyword}
        options={(toolboxes ?? []).map((item) => ({ label: item.name, value: item.boxId }))}
        placeholder={t("knowledgeNetwork.cypherQuery.publish.toolbox")}
        showSearch
        style={{ width: "100%" }}
        value={boxId}
      />
    </Modal>
  );
}
