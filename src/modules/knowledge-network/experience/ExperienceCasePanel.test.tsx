/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";

import { ExperienceCasePanel } from "./ExperienceCasePanel";
import { casesFor, parseSampleExperience, type SampleExperience } from "./sample-experience";

const RESPONSE = {
  knowledgeNetwork: "supply_ontology_en",
  sample: "supply-chain-en",
  version: "0.1.12",
  experienceSet: {
    kind: "ExperienceSet",
    spec: {
      businessDate: "2026-08-25",
      cases: [
        {
          id: "M-04",
          title: "Sales order count",
          explanation: "Object count.",
          question: "How many sales orders are in the current snapshot?",
          answer: "There are 800 sales orders in the current snapshot.",
          expected: { value: 800 },
          surfaces: ["agent", "query"],
          cypher: { query: "MATCH (s:salesorder) RETURN count(s) AS value" },
        },
        {
          id: "F-01",
          title: "First-level main materials",
          explanation: "One BOM hop.",
          question: "Which first-level main materials does 382-000005 use?",
          answer: "382-000005 uses 323-000101 and 323-000102.",
          expected: { material_codes: ["323-000101", "323-000102"] },
          surfaces: ["agent", "graph"],
          cypher: { graph: "MATCH (p:product)-[r:prod2bom]->(b:bom) RETURN p, r, b" },
        },
        {
          id: "S-02",
          title: "Sellable is not a promise",
          explanation: "Two business measures.",
          question: "Report current sellable capacity for U00-000151.",
          answer: "4738 sellable in total; this is capacity, not a delivery promise.",
          expected: { total_sellable_qty: 4738 },
          surfaces: ["agent"],
        },
        { id: "X-01", title: "Incomplete", surfaces: ["agent"] },
      ],
    },
  },
};

function experience(): SampleExperience {
  const parsed = parseSampleExperience(RESPONSE);
  if (!parsed) throw new Error("fixture must parse");
  return parsed;
}

beforeAll(async () => {
  await i18n.changeLanguage("en-US");
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

describe("parseSampleExperience", () => {
  it("keeps complete cases and the business date", () => {
    const parsed = experience();
    expect(parsed.sample).toBe("supply-chain-en");
    expect(parsed.businessDate).toBe("2026-08-25");
    expect(parsed.cases.map((item) => item.id)).toEqual(["M-04", "F-01", "S-02"]);
  });

  it("offers each page only its own cases", () => {
    expect(casesFor(experience(), "agent").map((item) => item.id)).toEqual([
      "M-04",
      "F-01",
      "S-02",
    ]);
    expect(casesFor(experience(), "query").map((item) => item.id)).toEqual(["M-04"]);
    expect(casesFor(experience(), "graph").map((item) => item.id)).toEqual(["F-01"]);
  });

  it("reads a response without cases as no experience", () => {
    expect(parseSampleExperience({ sample: "s", experienceSet: { spec: { cases: [] } } })).toBe(
      null,
    );
    expect(parseSampleExperience({ code: "experience_set_unavailable" })).toBe(null);
  });
});

describe("ExperienceCasePanel", () => {
  it("hands only the question to the page and shows the answer once the page has finished", () => {
    const onTry = vi.fn();
    const { rerender } = render(
      <ExperienceCasePanel
        experience={experience()}
        onTry={onTry}
        running={false}
        surface="agent"
      />,
    );
    expect(screen.queryByTestId("experience-answer")).toBeNull();

    fireEvent.click(screen.getByTestId("experience-try"));
    expect(onTry).toHaveBeenCalledWith("How many sales orders are in the current snapshot?");

    rerender(
      <ExperienceCasePanel experience={experience()} onTry={onTry} running surface="agent" />,
    );
    expect(screen.queryByTestId("experience-answer")).toBeNull();

    rerender(
      <ExperienceCasePanel
        experience={experience()}
        onTry={onTry}
        running={false}
        surface="agent"
      />,
    );
    expect(screen.getByTestId("experience-answer").textContent).toContain(
      "There are 800 sales orders",
    );
  });

  it("moves to the next case after a verdict and remembers it", () => {
    render(
      <ExperienceCasePanel
        experience={experience()}
        onTry={vi.fn()}
        running={false}
        surface="agent"
      />,
    );
    fireEvent.click(screen.getByTestId("experience-try"));
    fireEvent.click(screen.getByText("Show reference answer"));
    fireEvent.click(screen.getByText("Same"));

    expect(screen.getByTestId("experience-question").textContent).toContain("382-000005");
    expect(screen.getByText("1/3 done")).toBeTruthy();
    const stored = JSON.parse(
      localStorage.getItem(
        "bkn-studio.sample-experience.supply_ontology_en.supply-chain-en.0.1.12.agent",
      ) ?? "{}",
    ) as { verdicts: Record<string, string> };
    expect(stored.verdicts).toEqual({ "M-04": "match" });
  });

  it("summarises the page once every case is judged", () => {
    render(
      <ExperienceCasePanel
        experience={experience()}
        onTry={vi.fn()}
        running={false}
        surface="agent"
      />,
    );
    for (const verdict of ["Same", "Different", "Same"]) {
      fireEvent.click(screen.getByTestId("experience-try"));
      fireEvent.click(screen.getByText("Show reference answer"));
      fireEvent.click(screen.getByText(verdict));
    }
    expect(screen.getByTestId("experience-summary").textContent).toContain("2 same, 1 different");
  });

  it("starts over from a hidden answer even when the last case was showing one", () => {
    render(
      <ExperienceCasePanel
        experience={experience()}
        onTry={vi.fn()}
        running={false}
        surface="agent"
      />,
    );
    for (const verdict of ["Same", "Same", "Same"]) {
      fireEvent.click(screen.getByTestId("experience-try"));
      fireEvent.click(screen.getByText("Show reference answer"));
      fireEvent.click(screen.getByText(verdict));
    }
    fireEvent.click(screen.getByTestId("experience-try"));
    fireEvent.click(screen.getByText("Show reference answer"));
    fireEvent.click(screen.getByText("Start over"));
    expect(screen.queryByTestId("experience-answer")).toBeNull();
    expect(screen.getByText("0/3 done")).toBeTruthy();
  });

  it("offers the reference query on the data query page", () => {
    const onRunReference = vi.fn();
    render(
      <ExperienceCasePanel
        experience={experience()}
        onRunReference={onRunReference}
        onTry={vi.fn()}
        running={false}
        surface="query"
      />,
    );
    expect(screen.getByText("Question 1 of 1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("experience-try"));
    fireEvent.click(screen.getByText("Show reference answer"));
    fireEvent.click(screen.getByText("Run reference query"));
    expect(onRunReference).toHaveBeenCalledWith("MATCH (s:salesorder) RETURN count(s) AS value");
  });

  it("offers to draw the reference graph on the graph exploration page", () => {
    const onRunReference = vi.fn();
    render(
      <ExperienceCasePanel
        experience={experience()}
        onRunReference={onRunReference}
        onTry={vi.fn()}
        running={false}
        surface="graph"
      />,
    );
    fireEvent.click(screen.getByTestId("experience-try"));
    fireEvent.click(screen.getByText("Show reference answer"));
    fireEvent.click(screen.getByText("Draw reference on canvas"));
    expect(onRunReference).toHaveBeenCalledWith(
      "MATCH (p:product)-[r:prod2bom]->(b:bom) RETURN p, r, b",
    );
  });

  it("renders nothing for a page without cases", () => {
    const only = {
      ...experience(),
      cases: experience().cases.filter((item) => item.id !== "F-01"),
    };
    const { container } = render(
      <ExperienceCasePanel experience={only} onTry={vi.fn()} running={false} surface="graph" />,
    );
    expect(container.innerHTML).toBe("");
  });
});
