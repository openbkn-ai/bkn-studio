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
  /* scanner terminator */

  return (
    <>
      <button aria-label="back">Copy failed</button>
      <p>复制失败</p>
      <p>{url}</p>
      <p>{mediaType}{blockMarkerLabel}</p>
    </>
  );
}
