/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OntologyGraphView } from "./OntologyGraphView";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const graph = {
  nodes: [
    { color: "#2563eb", id: "customer", name: "Customer" },
    { color: "#16a34a", id: "order", name: "Order" },
  ],
  edges: [
    { id: "places", name: "Places", sourceId: "customer", targetId: "order" },
  ],
};

describe("OntologyGraphView", () => {
  it("renders grid dots and edge markers through theme-aware CSS classes", () => {
    const { container } = render(
      <OntologyGraphView
        graph={graph}
        indexedIds={new Set()}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    const gridDot = container.querySelector("pattern circle");
    const edgeArrows = container.querySelectorAll("marker path");

    expect(gridDot?.getAttribute("class")).toContain("gridDot");
    expect(gridDot?.hasAttribute("fill")).toBe(false);
    expect(edgeArrows[0]?.getAttribute("class")).toContain("edgeArrow");
    expect(edgeArrows[0]?.hasAttribute("fill")).toBe(false);
    expect(edgeArrows[1]?.getAttribute("class")).toContain("edgeArrowActive");
    expect(screen.getByText("Places").getAttribute("class")).toContain("edgeLabel");
  });

  it("keeps relation labels readable in default, hover, and active states", () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        "src/modules/knowledge-network/components/preview/OntologyGraphView.module.css",
      ),
      "utf8",
    );

    expect(css).toMatch(
      /\.gridDot\s*{[^}]*fill:\s*var\(--color-text-faint\);[^}]*opacity:\s*var\(--ontology-grid-dot-opacity\);/s,
    );
    expect(css).toMatch(
      /:global\(:root\[data-theme="dark"\]\) \.wrap\s*{[^}]*--ontology-grid-dot-opacity:\s*0\.18;/s,
    );
    expect(css).toMatch(
      /\.edgeLabel\s*{[^}]*fill:\s*var\(--color-text-primary\);/s,
    );
    expect(css).toMatch(
      /\.edge:hover \.edgeLabelBg\s*{[^}]*fill:\s*var\(--color-hover\);[^}]*stroke:\s*var\(--color-primary-border\);/s,
    );
    expect(css).toMatch(
      /\.edge:hover \.edgeLabel\s*{[^}]*fill:\s*var\(--color-text-link\);/s,
    );
    expect(css).toMatch(
      /\.edgeActive \.edgeLabelBg\s*{[^}]*fill:\s*var\(--color-primary-100\);[^}]*stroke:\s*var\(--color-primary-border\);/s,
    );
    expect(css).toMatch(
      /\.edgeActive \.edgeLabel\s*{[^}]*fill:\s*var\(--color-text-link\);/s,
    );
    expect(css).not.toMatch(/\.edgeLabel\s*{[^}]*fill:\s*#[0-9a-f]{3,8}/is);
  });
});
