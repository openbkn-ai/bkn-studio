/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useId, useRef } from "react";
import { renameMember, replaceMember, type DefinitionObject } from "./model";

/** Keep local input drafts with the edited item, never with its array position. */
export function useArrayEditorItems<T>(value: T[]) {
  const prefix = useId();
  const serial = useRef(0);
  const snapshot = useRef<{ value: T[]; keys: string[] } | null>(null);
  const makeKey = () => `${prefix}-${serial.current++}`;
  if (snapshot.current === null || snapshot.current.value !== value) {
    snapshot.current = { value, keys: value.map(makeKey) };
  }
  const keys = snapshot.current.keys;
  const commit = (next: T[], nextKeys = keys) => {
    snapshot.current = { value: next, keys: nextKeys };
    return next;
  };
  return {
    keys,
    replace: (index: number, next: T) =>
      commit(value.map((entry, i) => (i === index ? next : entry))),
    remove: (index: number) =>
      commit(
        value.filter((_, i) => i !== index),
        keys.filter((_, i) => i !== index),
      ),
    append: (entry: T) => commit([...value, entry], [...keys, makeKey()]),
    moveUp: (index: number) => {
      const next = [...value],
        nextKeys = [...keys];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      [nextKeys[index - 1], nextKeys[index]] = [nextKeys[index], nextKeys[index - 1]];
      return commit(next, nextKeys);
    },
  };
}

/** A property rename changes a contract key without replacing its input subtree. */
export function useObjectEditorItems(value: DefinitionObject) {
  const prefix = useId();
  const serial = useRef(0);
  const snapshot = useRef<{ value: DefinitionObject; keys: Map<string, string> } | null>(null);
  const makeKey = () => `${prefix}-${serial.current++}`;
  if (snapshot.current === null || snapshot.current.value !== value) {
    snapshot.current = {
      value,
      keys: new Map(Object.keys(value).map((name) => [name, makeKey()])),
    };
  }
  const keys = snapshot.current.keys;
  const commit = (next: DefinitionObject, nextKeys = keys) => {
    snapshot.current = { value: next, keys: nextKeys };
    return next;
  };
  return {
    keys,
    replace: (name: string, next: unknown) => {
      const nextKeys = new Map(keys);
      if (next === undefined) nextKeys.delete(name);
      else if (!nextKeys.has(name)) nextKeys.set(name, makeKey());
      return commit(replaceMember(value, name, next), nextKeys);
    },
    rename: (name: string, nextName: string) => {
      const nextKeys = new Map(keys);
      const key = nextKeys.get(name) ?? makeKey();
      nextKeys.delete(name);
      nextKeys.set(nextName, key);
      return commit(renameMember(value, name, nextName), nextKeys);
    },
  };
}
