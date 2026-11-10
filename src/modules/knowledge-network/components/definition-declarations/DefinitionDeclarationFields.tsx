/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, Radio, Select } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DefinitionDeclarations } from "@/modules/knowledge-network/types/knowledge-network";
import {
  ALIAS_SEPARATORS,
  MAX_ALIAS_LENGTH,
  MAX_PROPERTY_ALIASES,
} from "@/modules/knowledge-network/utils/property-declarations";
import {
  definitionAliasProblem,
  type LifecycleStatus,
  replacementCandidates,
} from "@/modules/knowledge-network/utils/definition-declarations";

const PREFIX = "knowledgeNetwork.definitionDeclarations";
const SEARCH_DELAY_MS = 300;

/** A definition the replacement select offers. */
export type ReplacementOption = {
  declarations?: DefinitionDeclarations;
  id: string;
  name: string;
};

type DefinitionDeclarationFieldsProps = {
  /** The definition edited; absent while creating. It cannot replace itself. */
  definitionId?: string;
  /**
   * The fields of the enclosing form that hold its own names, which an alias may not repeat. They
   * are read when the aliases are checked, so a name just typed counts.
   */
  ownNameFields: readonly string[];
  /** Its own names held outside the form, such as a relation's reverse name. */
  otherOwnNames?: readonly string[];
  /** Reads one definition of the same kind, for the name of the stored replacement. */
  resolveReplacement: (id: string) => Promise<ReplacementOption | undefined>;
  /** Searches definitions of the same kind by name. */
  searchReplacements: (keyword: string) => Promise<ReplacementOption[]>;
};

/**
 * The aliases and lifecycle in the basic info of a definition form, as
 * `aliases`, `lifecycleStatus`, `lifecycleReason` and `replacedBy` of the enclosing form.
 * The reason and replacement appear when the status is deprecated.
 */
export function DefinitionDeclarationFields({
  definitionId,
  otherOwnNames = [],
  ownNameFields,
  resolveReplacement,
  searchReplacements,
}: DefinitionDeclarationFieldsProps) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const status = Form.useWatch<LifecycleStatus | undefined>("lifecycleStatus", form);
  const deprecated = status === "deprecated";

  return (
    <>
      <Form.Item
        dependencies={[...ownNameFields]}
        label={t(`${PREFIX}.aliases`)}
        name="aliases"
        tooltip={t(`${PREFIX}.aliasesHint`, {
          length: MAX_ALIAS_LENGTH,
          max: MAX_PROPERTY_ALIASES,
        })}
        rules={[
          {
            validator: (_, value: string[] | undefined) => {
              const ownNames = [
                ...ownNameFields.map((field) => String(form.getFieldValue(field) ?? "")),
                ...otherOwnNames,
              ];
              const problem = definitionAliasProblem(value, ownNames);
              return problem
                ? Promise.reject(
                    new Error(t(`${PREFIX}.aliasProblem.${problem.key}`, problem.params)),
                  )
                : Promise.resolve();
            },
          },
        ]}
      >
        <Select
          aria-label={t(`${PREFIX}.aliases`)}
          mode="tags"
          notFoundContent={null}
          open={false}
          placeholder={t(`${PREFIX}.aliasesPlaceholder`)}
          suffixIcon={null}
          tokenSeparators={[...ALIAS_SEPARATORS]}
        />
      </Form.Item>
      <Form.Item
        label={t(`${PREFIX}.lifecycle`)}
        name="lifecycleStatus"
        tooltip={t(`${PREFIX}.lifecycleHint`)}
      >
        <Radio.Group
          options={(["active", "deprecated"] as const).map((value) => ({
            label: t(`${PREFIX}.lifecycleOption.${value}`),
            value,
          }))}
        />
      </Form.Item>
      {deprecated ? (
        <>
          <Form.Item
            label={t(`${PREFIX}.reason`)}
            name="lifecycleReason"
            rules={[{ message: t(`${PREFIX}.reasonRequired`), required: true, whitespace: true }]}
          >
            <Input.TextArea
              autoSize={{ maxRows: 4, minRows: 2 }}
              placeholder={t(`${PREFIX}.reasonPlaceholder`)}
            />
          </Form.Item>
          <Form.Item
            label={t(`${PREFIX}.replacedBy`)}
            name="replacedBy"
            tooltip={t(`${PREFIX}.replacedByHint`)}
          >
            <ReplacementSelect
              definitionId={definitionId}
              resolveReplacement={resolveReplacement}
              searchReplacements={searchReplacements}
            />
          </Form.Item>
        </>
      ) : null}
    </>
  );
}

type ReplacementSelectProps = Omit<
  DefinitionDeclarationFieldsProps,
  "otherOwnNames" | "ownNameFields"
> & {
  onChange?: (value: string | undefined) => void;
  value?: string;
};

/** Searches the definitions in use of the same kind; keeps the stored one shown by name. */
function ReplacementSelect({
  definitionId,
  onChange,
  resolveReplacement,
  searchReplacements,
  value,
}: ReplacementSelectProps) {
  const { t } = useTranslation();
  const [found, setFound] = useState<ReplacementOption[]>([]);
  const [selected, setSelected] = useState<ReplacementOption | undefined>();
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(0);

  const search = (keyword: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const request = ++latest.current;
      setSearching(true);
      searchReplacements(keyword.trim())
        .then((items) => {
          if (request === latest.current) {
            setFound(replacementCandidates(items, definitionId));
          }
        })
        .catch(() => {
          if (request === latest.current) {
            setFound([]);
          }
        })
        .finally(() => {
          if (request === latest.current) {
            setSearching(false);
          }
        });
    }, SEARCH_DELAY_MS);
  };

  useEffect(() => {
    search("");
    return () => clearTimeout(timer.current);
    // The first page of candidates, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value || found.some((item) => item.id === value) || selected?.id === value) {
      return;
    }
    let cancelled = false;
    void resolveReplacement(value)
      .catch(() => undefined)
      .then((item) => {
        if (!cancelled) {
          setSelected(item ?? { id: value, name: t(`${PREFIX}.replacedByMissing`, { id: value }) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [found, resolveReplacement, selected?.id, t, value]);

  const options = useMemo(() => {
    const items =
      selected && selected.id === value && !found.some((item) => item.id === selected.id)
        ? [selected, ...found]
        : found;
    return items.map((item) => ({ label: item.name, value: item.id }));
  }, [found, selected, value]);

  return (
    <Select
      allowClear
      aria-label={t(`${PREFIX}.replacedBy`)}
      filterOption={false}
      loading={searching}
      onChange={(next: string | undefined) => {
        setSelected(found.find((item) => item.id === next));
        onChange?.(next);
      }}
      onSearch={search}
      options={options}
      placeholder={t(`${PREFIX}.replacedByPlaceholder`)}
      showSearch
      value={value}
    />
  );
}
