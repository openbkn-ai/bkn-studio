/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Collapse, Descriptions, Form, Input, Typography } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ToolIoSpec } from "@/modules/execution-factory/types/tool";
import {
  parametersForLocation,
  parseJsonObject,
} from "@/modules/execution-factory/utils/http-debug-request";

import { JsonEditor } from "./JsonEditor";
import styles from "./HttpDebugRequestFields.module.css";

type HttpDebugRequestFieldsProps = {
  ioSpec?: ToolIoSpec;
  method?: string;
  path?: string;
  serverUrl?: string;
};

function joinUrl(serverUrl?: string, path?: string) {
  if (!serverUrl) {
    return path;
  }
  if (!path) {
    return serverUrl;
  }
  return `${serverUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function replacePathParameters(path: string | undefined, rawValues?: string) {
  if (!path) {
    return undefined;
  }

  try {
    const values = parseJsonObject(rawValues, "Path") ?? {};
    return Object.entries(values).reduce(
      (current, [name, value]) =>
        current
          .replaceAll(`{${name}}`, encodeURIComponent(String(value)))
          .replaceAll(`:${name}`, encodeURIComponent(String(value))),
      path,
    );
  } catch {
    return path;
  }
}

function parameterHint(names: string[], requiredNames: string[]) {
  if (names.length === 0) {
    return undefined;
  }
  const required = requiredNames.length > 0 ? ` · required: ${requiredNames.join(", ")}` : "";
  return `${names.join(", ")}${required}`;
}

export function HttpDebugRequestFields({
  ioSpec,
  method,
  path,
  serverUrl,
}: HttpDebugRequestFieldsProps) {
  const { t } = useTranslation();
  const rawPathValues = Form.useWatch("requestPath") as string | undefined;
  const pathParameters = parametersForLocation(ioSpec, "path");
  const queryParameters = parametersForLocation(ioSpec, "query");
  const headerParameters = parametersForLocation(ioSpec, "header");
  const resolvedPath = replacePathParameters(path, rawPathValues);
  const resolvedUrl = joinUrl(serverUrl, resolvedPath);

  const endpointItems = useMemo(
    () =>
      [
        method
          ? {
              key: "method",
              label: t("executionFactory.debugMethod"),
              children: method,
            }
          : undefined,
        path
          ? {
              key: "path",
              label: t("executionFactory.debugPathTemplate"),
              children: path,
            }
          : undefined,
        resolvedUrl
          ? {
              key: "url",
              label: t("executionFactory.debugResolvedUrl"),
              children: resolvedUrl,
            }
          : undefined,
      ].filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [method, path, resolvedUrl, t],
  );

  const renderJsonField = (
    name: keyof import("@/modules/execution-factory/utils/http-debug-request").HttpDebugFormValues,
    label: string,
    parameters: typeof pathParameters,
    rows = 4,
  ) => {
    const names = parameters.map((parameter) => parameter.name);
    const requiredNames = parameters
      .filter((parameter) => parameter.required)
      .map((parameter) => parameter.name);
    const hint = parameterHint(names, requiredNames);

    return (
      <Form.Item
        extra={hint ? <Typography.Text type="secondary">{hint}</Typography.Text> : undefined}
        label={label}
        name={name}
      >
        <Input.TextArea placeholder="{}" rows={rows} />
      </Form.Item>
    );
  };

  return (
    <div className={styles.fields}>
      {endpointItems.length > 0 ? (
        <Descriptions bordered column={1} items={endpointItems} size="small" />
      ) : null}
      {pathParameters.length > 0
        ? renderJsonField(
            "requestPath",
            t("executionFactory.debugPathParameters"),
            pathParameters,
          )
        : null}
      {queryParameters.length > 0
        ? renderJsonField(
            "requestQuery",
            t("executionFactory.debugQueryParameters"),
            queryParameters,
          )
        : null}
      {headerParameters.length > 0 ? (
        <Collapse
          items={[
            {
              key: "headers",
              label: t("executionFactory.debugRequestHeaders"),
              children: renderJsonField(
                "requestHeaders",
                t("executionFactory.debugRequestHeaders"),
                headerParameters,
              ),
            },
          ]}
          size="small"
        />
      ) : null}
      <Form.Item label={t("executionFactory.debugRequestBody")} name="requestBody">
        <JsonEditor height={180} />
      </Form.Item>
    </div>
  );
}
