/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { draftErrorCode } from "@/modules/bkn-project/components/draft/edit";
import {
  addDraftCatalogs,
  DRAFT_POLL_MS,
  draftSourceChanges,
  generateDraft,
  getDraft,
  getSourceChanges,
} from "@/modules/bkn-project/services/draft.service";
import {
  projectErrorCode,
  understandCatalogs,
} from "@/modules/bkn-project/services/publish.service";
import {
  extractRequirementConcepts,
  getRequirements,
} from "@/modules/bkn-project/services/requirements.service";

/** The sources concepts are extracted from, in the order extracting all of them takes. */
export const CONCEPT_SOURCES = ["table", "document", "knowledgeBase"] as const;

export type ConceptSourceKey = (typeof CONCEPT_SOURCES)[number];

/** How far a source of a run got: waiting its turn, at a step, done, failed, or with nothing to do. */
export type SourceRun = {
  state: "waiting" | "running" | "done" | "failed" | "skipped";
  /** The step it is at, of those the page shows for the source. */
  step: number;
  /** Why it failed, as a code the page words. */
  error?: string;
};

export type ConceptRun = {
  keys: ConceptSourceKey[];
  sources: Partial<Record<ConceptSourceKey, SourceRun>>;
};

/** What extracting from the knowledge-base files ended as; skipped when there was nothing to do. */
export type KnowledgeBaseOutcome = "done" | "failed" | "skipped";

/** Thrown to end a source's turn without counting it as a failure. */
class Skipped extends Error {}

/** Thrown to fail a source's turn with a code the page words. */
class Failed extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Extracting concepts from the project's sources one after another: the tables (semantic
 * understanding of those not understood, in the project's content language, then the candidates),
 * the requirement documents (their concepts, each matched to the data), then the knowledge-base
 * files, where the edition has them. Each source's progress is shown on its own; extracting one
 * source alone runs only its turn. What a person decided stays: drafting again over decisions takes
 * only what changed in the tables.
 */
export function useConceptRun({
  catalogIds,
  extractKnowledgeBase,
  notUnderstood,
  onSourceDone,
  projectId,
}: {
  /** The project's data catalogs, whose tables are drafted. */
  catalogIds: string[];
  /** Starts extracting from the knowledge-base files and settles when it ends. */
  extractKnowledgeBase: () => Promise<KnowledgeBaseOutcome>;
  /** Whether some tables keep their table names, so understanding them comes first. */
  notUnderstood: boolean;
  /** A source's turn ended: the page reads what it made. */
  onSourceDone: () => Promise<unknown>;
  projectId: string;
}) {
  const [run, setRun] = useState<ConceptRun | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // The latest of what the turns read, so a run started earlier sees them as they are now.
  const latest = useRef({ catalogIds, extractKnowledgeBase, notUnderstood, onSourceDone });
  useEffect(() => {
    latest.current = { catalogIds, extractKnowledgeBase, notUnderstood, onSourceDone };
  });

  const until = useCallback(async (done: () => Promise<boolean>) => {
    while (alive.current && !(await done())) {
      await sleep(DRAFT_POLL_MS);
    }
  }, []);

  const tables = useCallback(
    async (step: (index: number) => void) => {
      step(0);
      if (latest.current.notUnderstood) {
        // Understanding is asked for; the concepts take the business names once it finishes.
        await understandCatalogs(projectId).catch(() => undefined);
      }
      step(1);
      let drafting: boolean;
      // A draft a knowledge-base extraction made has none of the tables yet: they are added to it,
      // keeping what it holds.
      const read = await getDraft(projectId);
      const fromTables = read?.items.objectTypes.some((item) => !item.document && !item.existing);
      const undrafted =
        read?.status === "ready" && !fromTables && read.items.draftedCatalogIds
          ? latest.current.catalogIds.filter((id) => !read.items.draftedCatalogIds!.includes(id))
          : [];
      if (undrafted.length) {
        await addDraftCatalogs(projectId, undrafted);
        await until(async () => {
          const draft = await getDraft(projectId).catch(() => undefined);
          return draft !== undefined && !draft?.items.adding;
        });
        return;
      }
      try {
        drafting = (await generateDraft(projectId)).status === "drafting";
      } catch (error) {
        if (draftErrorCode(error) !== "HasDecisions") {
          throw error;
        }
        // What people decided stays: only what changed in the tables is drafted.
        const changes = await getSourceChanges(projectId);
        if (changes.state === "in_step") {
          return;
        }
        drafting = (await draftSourceChanges(projectId, changes.signature)).status === "drafting";
      }
      let failed = false;
      if (drafting) {
        await until(async () => {
          const draft = await getDraft(projectId).catch(() => undefined);
          failed = draft?.status === "failed";
          return draft !== undefined && draft?.status !== "drafting";
        });
      }
      if (failed) {
        throw new Failed("draft");
      }
    },
    [projectId, until],
  );

  const documents = useCallback(
    async (step: (index: number) => void) => {
      step(0);
      try {
        await extractRequirementConcepts(projectId);
      } catch (error) {
        const code = projectErrorCode(error);
        if (code === "Requirement.NoDocuments") {
          throw new Skipped();
        }
        throw new Failed(code === "Requirement.Drafting" ? "busy" : "request");
      }
      let failed = false;
      let why = "";
      await until(async () => {
        const read = await getRequirements(projectId).catch(() => undefined);
        const status = read?.spec.conceptsRun?.status;
        failed = status === "failed";
        why = read?.spec.conceptsRun?.error ?? "";
        return read !== undefined && status !== "running";
      });
      step(1);
      if (failed) {
        // The run's own reason, after the colon, for the page to word.
        throw new Failed(`requirements:${why}`);
      }
    },
    [projectId, until],
  );

  const start = useCallback(
    async (keys: ConceptSourceKey[]): Promise<ConceptRun["sources"]> => {
      const sources: ConceptRun["sources"] = {};
      for (const key of keys) {
        sources[key] = { state: "waiting", step: 0 };
      }
      setRun({ keys, sources });
      const set = (key: ConceptSourceKey, value: SourceRun) => {
        sources[key] = value;
        if (alive.current) {
          setRun((current) =>
            current ? { ...current, sources: { ...current.sources, [key]: value } } : current,
          );
        }
      };
      for (const key of keys) {
        if (!alive.current) {
          return sources;
        }
        const step = (index: number) => set(key, { state: "running", step: index });
        try {
          if (key === "table") {
            await tables(step);
          } else if (key === "document") {
            await documents(step);
          } else {
            step(0);
            const outcome = await latest.current.extractKnowledgeBase();
            if (outcome === "skipped") {
              throw new Skipped();
            }
            if (outcome === "failed") {
              throw new Failed("knowledgeBase");
            }
          }
          set(key, { state: "done", step: 0 });
        } catch (error) {
          set(
            key,
            error instanceof Skipped
              ? { state: "skipped", step: 0 }
              : {
                  error: error instanceof Failed ? error.code : "request",
                  state: "failed",
                  step: 0,
                },
          );
        }
        await latest.current.onSourceDone();
      }
      if (alive.current) {
        setRun(null);
      }
      return sources;
    },
    [documents, tables],
  );

  return { run, start };
}
