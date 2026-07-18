/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FieldTypeIcon } from "./FieldTypeIcon";

afterEach(() => {
  cleanup();
});

describe("FieldTypeIcon", () => {
  it.each(["float", "double", "decimal", "number", "numeric", "real"])(
    "renders %s as floating numeric type",
    (type) => {
      render(<FieldTypeIcon type={type} />);

      expect(screen.getByText("float")).toBeTruthy();
      expect(screen.queryByText("[Str]")).toBeNull();
    },
  );

  it.each(["integer", "unsigned integer", "bigint", "smallint"])(
    "renders %s as integer type",
    (type) => {
      render(<FieldTypeIcon type={type} />);

      expect(screen.getByText("int")).toBeTruthy();
      expect(screen.queryByText("[Str]")).toBeNull();
    },
  );
});
