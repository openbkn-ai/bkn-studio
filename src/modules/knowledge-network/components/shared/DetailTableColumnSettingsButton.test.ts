/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  readDetailTableColumnConfig,
  writeDetailTableColumnConfig,
} from "./DetailTableColumnSettingsButton";

const storageKey = "bkn-detail-table-columns:detail-table:object-property";

afterEach(() => {
  localStorage.clear();
});

describe("readDetailTableColumnConfig", () => {
  it("returns saved config when the stored payload has the expected shape", () => {
    writeDetailTableColumnConfig("detail-table:object-property", {
      order: ["name", "type"],
      visibility: {
        name: true,
        type: false,
      },
    });

    expect(readDetailTableColumnConfig("detail-table:object-property")).toEqual({
      order: ["name", "type"],
      visibility: {
        name: true,
        type: false,
      },
    });
  });

  it.each([
    "{}",
    '{"visibility":{}}',
    '{"order":["name"]}',
    '{"order":"name","visibility":{}}',
    '{"order":["name"],"visibility":[]}',
    '{"order":["name"],"visibility":{"name":"true"}}',
  ])("ignores malformed but parseable payload %s", (payload) => {
    localStorage.setItem(storageKey, payload);

    expect(readDetailTableColumnConfig("detail-table:object-property")).toBeNull();
  });
});
