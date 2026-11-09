/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, InputNumber } from "antd";
import type { Rule } from "antd/es/form";
import { useTranslation } from "react-i18next";

import {
  isRangeReversed,
  rangeBoundFits,
  type PropertyRangeKind,
} from "@/modules/knowledge-network/utils/property-declarations";

import styles from "./RangeInputs.module.css";

const PREFIX = "knowledgeNetwork.valueTypes.rules";

/** Where a range or a length sits in the form, such as `["range"]`. */
type FieldPath = Array<number | string>;

type Bound = number | string | null | undefined;

const isEmpty = (value: Bound): value is "" | null | undefined =>
  value === undefined || value === null || value === "";

/** The minimum and maximum of a range: numbers, or ISO 8601 text for a date or time type. */
export function RangeInputs({ kind, name }: { kind: PropertyRangeKind; name: FieldPath }) {
  const { t } = useTranslation();
  const minName = [...name, "min"];
  const maxName = [...name, "max"];
  const fits: Rule = {
    validator: (_rule, value: Bound) =>
      isEmpty(value) || rangeBoundFits(kind, value)
        ? Promise.resolve()
        : Promise.reject(new Error(t(`${PREFIX}.${kind === "date" ? "date" : "datetime"}Invalid`))),
  };
  const ordered: Rule = ({ getFieldValue }) => ({
    validator: () => {
      const min = getFieldValue(minName) as Bound;
      const max = getFieldValue(maxName) as Bound;
      return !isEmpty(min) && !isEmpty(max) && isRangeReversed(kind, { max, min })
        ? Promise.reject(new Error(t(`${PREFIX}.rangeReversed`)))
        : Promise.resolve();
    },
  });
  const input = (label: string) =>
    kind === "number" ? (
      <InputNumber
        aria-label={label}
        className={styles.number}
        placeholder={t(`${PREFIX}.unbounded`)}
      />
    ) : (
      // The hint under the input gives the format.
      <Input aria-label={label} className={styles.text} placeholder={t(`${PREFIX}.unbounded`)} />
    );

  return (
    <div className={styles.row}>
      <Form.Item
        extra={kind === "number" ? undefined : t(`${PREFIX}.${kind}Hint`)}
        label={t(`${PREFIX}.rangeMin`)}
        name={minName}
        rules={[fits]}
      >
        {input(t(`${PREFIX}.rangeMin`))}
      </Form.Item>
      <Form.Item
        dependencies={[minName]}
        label={t(`${PREFIX}.rangeMax`)}
        name={maxName}
        rules={[fits, ordered]}
      >
        {input(t(`${PREFIX}.rangeMax`))}
      </Form.Item>
    </div>
  );
}

/** The shortest and longest length of a string value, in characters. */
export function LengthInputs({ name }: { name: FieldPath }) {
  const { t } = useTranslation();
  const minName = [...name, "min"];
  const input = (label: string) => (
    <InputNumber
      aria-label={label}
      className={styles.number}
      min={0}
      placeholder={t(`${PREFIX}.unbounded`)}
      precision={0}
    />
  );

  return (
    <div className={styles.row}>
      <Form.Item label={t(`${PREFIX}.lengthMin`)} name={minName}>
        {input(t(`${PREFIX}.lengthMin`))}
      </Form.Item>
      <Form.Item
        dependencies={[minName]}
        label={t(`${PREFIX}.lengthMax`)}
        name={[...name, "max"]}
        rules={[
          ({ getFieldValue }) => ({
            validator: (_rule, max: Bound) => {
              const min = getFieldValue(minName) as Bound;
              return typeof min === "number" && typeof max === "number" && min > max
                ? Promise.reject(new Error(t(`${PREFIX}.lengthReversed`)))
                : Promise.resolve();
            },
          }),
        ]}
      >
        {input(t(`${PREFIX}.lengthMax`))}
      </Form.Item>
    </div>
  );
}
