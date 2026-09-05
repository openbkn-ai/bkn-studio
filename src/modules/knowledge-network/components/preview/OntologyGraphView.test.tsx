/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

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

});
