/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { JsonTextBlock } from "./JsonTextBlock";

it("highlights raw JSON without parsing or rounding numbers, and escapes markup", () => {
  const text =
    '{"id":9007199254740993,"n":0.1234567890123456789,"ok":false,"value":null,"text":"<img src=x>"}';
  const { container } = render(<JsonTextBlock text={text} />);
  expect(container.querySelector("pre")?.textContent).toBe(text);
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelectorAll("span").length).toBeGreaterThan(5);
});
