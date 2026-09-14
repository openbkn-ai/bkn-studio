/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export function Bad() {
  const url = "https://example.com/中文文档";
  const mediaType = "application/*+json";
  const blockMarkerLabel = "块注释符号之后的硬编码";
  const count = 2;
  const loading = false;
  /* scanner terminator */

  message.success(`Saved ${count} records`);
  notification.error({ message: "Save failed", description: "Try again later" });
  Modal.confirm({ title: "Delete record", content: "This action cannot be undone" });
  window.confirm("Delete this record");

  return (
    <>
      <button aria-label="back">Copy failed</button>
      <button>{"Save changes"}</button>
      <p>{loading ? "Loading records" : "Records ready"}</p>
      <Form.Item label="Display name" help="Enter a display name" />
      <Form.Item label="API Key" />
      <Form.Item label="Request ID" />
      <Form.Item label="Trace ID" />
      <p>Attempt</p>
      <Modal okText="Save changes" cancelText="Discard changes" />
      <p>复制失败</p>
      <p>{url}</p>
      <p>{mediaType}{blockMarkerLabel}</p>
    </>
  );
}
