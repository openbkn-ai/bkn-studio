/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, type FormInstance } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  createKnowledgeNetworkValueType,
  updateKnowledgeNetworkValueType,
  ValueTypeReferencedError,
} from "@/modules/knowledge-network/services/value-type.service";
import type { ValueType } from "@/modules/knowledge-network/types/knowledge-network";

import {
  isBaseType,
  toFormValues,
  toInput,
  type ValueTypeFormValues,
} from "./value-type-form-values";
import {
  ValueTypeReferencedDialog,
  type ValueTypeReferencedRefusal,
} from "./ValueTypeReferencedDialog";

const PREFIX = "knowledgeNetwork.valueTypes";

type ValueTypeEditorOptions = {
  /** The form is shown; it is filled again each time this turns true. */
  active: boolean;
  /** The base type a new value type starts with, such as the type of the property it is made for. */
  defaultBaseType?: string;
  networkId: string;
  /** Called with the value type's ID once it is saved. */
  onSaved: (valueTypeId: string) => void;
  /** The value type to edit; absent, a new one is made. */
  valueType?: ValueType;
};

/**
 * The state of one value type form: filling it, saving it and the refusal to change a value type
 * that is in use. The page and the data property drawer show the form in their own frame.
 */
export function useValueTypeEditor({
  active,
  defaultBaseType,
  networkId,
  onSaved,
  valueType,
}: ValueTypeEditorOptions): {
  form: FormInstance<ValueTypeFormValues>;
  /** The dialog that lists what still uses a value type a save was refused for. */
  refusalDialog: ReactNode;
  submit: () => Promise<void>;
  submitting: boolean;
} {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<ValueTypeFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<ValueTypeReferencedRefusal | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }
    setSubmitting(false);
    form.resetFields();
    form.setFieldsValue(
      toFormValues(valueType, isBaseType(defaultBaseType) ? defaultBaseType : "string"),
    );
  }, [active, defaultBaseType, form, valueType]);

  const submit = async () => {
    let values: ValueTypeFormValues;
    try {
      await form.validateFields();
      values = form.getFieldsValue(true) as ValueTypeFormValues;
    } catch {
      return;
    }

    const input = toInput(values, valueType);
    setSubmitting(true);
    try {
      let savedId = valueType?.id ?? "";
      if (valueType) {
        await updateKnowledgeNetworkValueType(networkId, valueType.id, input);
        void message.success(t(`${PREFIX}.form.saved`));
      } else {
        savedId = await createKnowledgeNetworkValueType(networkId, input);
        void message.success(t(`${PREFIX}.form.created`));
      }
      onSaved(savedId);
    } catch (error) {
      if (error instanceof ValueTypeReferencedError) {
        setRefusal({ action: "update", name: input.name, references: error.references });
      } else {
        void message.error(extractRequestErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return {
    form,
    refusalDialog: refusal ? (
      <ValueTypeReferencedDialog
        networkId={networkId}
        onClose={() => setRefusal(null)}
        refusal={refusal}
      />
    ) : null,
    submit,
    submitting,
  };
}

/** The title of the value type form: viewing, editing or creating. */
export function valueTypeFormTitle(
  t: (key: string) => string,
  readOnly: boolean,
  valueType?: ValueType,
) {
  return readOnly
    ? t(`${PREFIX}.form.viewTitle`)
    : valueType
      ? t(`${PREFIX}.form.editTitle`)
      : t(`${PREFIX}.form.createTitle`);
}

/** The fields of one value type. */
