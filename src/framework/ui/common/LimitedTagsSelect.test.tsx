/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LimitedTagsSelect } from "./LimitedTagsSelect";

vi.mock("antd", () => ({
  Select: ({ onChange, value }: { onChange: (tags: string[]) => void; value: string[] }) => (
    <button onClick={() => onChange([...value, " orders"])} type="button">
      Add normalized duplicate
    </button>
  ),
  Typography: {
    Text: ({ children }: { children: ReactNode }) => <span role="alert">{children}</span>,
  },
}));

function TagsForm({ initialTags }: { initialTags: string[] }) {
  const [tags, setTags] = useState(initialTags);
  return (
    <>
      <LimitedTagsSelect
        limit={5}
        limitMessage="Too many tags"
        normalizeTag={(tag) => tag.trim()}
        onChange={setTags}
        open={false}
        validateTag={(tag) => (tag.trim() ? null : "Empty tag")}
        value={tags}
      />
      <output data-testid="tags">{JSON.stringify(tags)}</output>
    </>
  );
}

describe("LimitedTagsSelect", () => {
  it("does not add a second tag for a normalized duplicate", () => {
    render(<TagsForm initialTags={["one", "two", "three", "orders"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add normalized duplicate" }));

    expect(screen.getByTestId("tags").textContent).toBe(
      JSON.stringify(["one", "two", "three", "orders"]),
    );
  });

  it("keeps one tag when a normalized duplicate is entered at the limit", () => {
    render(<TagsForm initialTags={["one", "two", "three", "four", "orders"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add normalized duplicate" }));

    expect(screen.getByTestId("tags").textContent).toBe(
      JSON.stringify(["one", "two", "three", "four", "orders"]),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
