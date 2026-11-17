/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";

import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import {
  buildApiCatalogPreview,
  isApiCatalogConfigEditable,
  prepareApiCatalogConfigForEdit,
  validateApiCatalogConfig,
} from "./api-catalog-config";

describe("API Catalog configuration", () => {
  it("omits protected values for editing without losing precise numbers or aliasing dynamic structures", () => {
    const config = parsePrecisionPreservingJSON(
      '{"base_url":"https://api.example.com/","variables":{"secret":{"value":"synthetic-secret","sensitive":true},"decimal":{"value":1234567890.123456789},"tree":{"value":{"missing":null,"flag":false}}}}',
    ) as Record<string, unknown>;
    const editable = prepareApiCatalogConfigForEdit(config);
    const variables = editable.variables as Record<
      string,
      { value?: unknown; sensitive?: boolean }
    >;
    expect(variables.secret).toEqual({ sensitive: true });
    expect(BigNumber.isBigNumber(variables.decimal.value)).toBe(true);
    expect(transformPrecisionSafeJSONRequest(editable)).toContain("1234567890.123456789");
    (variables.tree.value as Record<string, unknown>).flag = true;
    expect((config.variables as Record<string, { value: unknown }>).secret.value).toBe(
      "synthetic-secret",
    );
    expect(
      (config.variables as Record<string, { value: Record<string, unknown> }>).tree.value.flag,
    ).toBe(false);
  });

  it("keeps malformed sensitivity metadata closed while editing", () => {
    const editable = prepareApiCatalogConfigForEdit({
      variables: { secret: { value: "synthetic-secret", sensitive: "invalid" } },
    });
    expect(editable.variables).toEqual({ secret: "••••••••" });
  });

  it("does not synthesize defaults, stringify variables or collapse empty strings, zero and false", () => {
    const config = {
      base_url: "https://api.example.com/",
      variables: {
        count: { value: 0, sensitive: false },
        enabled: { value: false, sensitive: false },
        object: { value: {}, sensitive: false },
        array: { value: [null], sensitive: false },
        value: { value: "", sensitive: false },
      },
    };
    expect(isApiCatalogConfigEditable(config)).toBe(true);
    expect(validateApiCatalogConfig(config)).toBeUndefined();
    expect(prepareApiCatalogConfigForEdit(config)).toEqual(config);
    expect(prepareApiCatalogConfigForEdit(config)).not.toHaveProperty("options");
  });

  it.each([{ value: null }, { value: undefined }, {}])(
    "rejects an absent ordinary variable value in a complete configuration: %j",
    (variable) => {
      const config = {
        base_url: "https://api.example.com/",
        variables: { absent: variable },
      };
      expect(isApiCatalogConfigEditable(config)).toBe(false);
      expect(validateApiCatalogConfig(config)).toBe(
        "dataConnect.apiCatalog.errors.unsupportedConfig",
      );
    },
  );

  it.each([{ value: null }, { value: undefined }, {}])(
    "allows an absent sensitive read value but requires reentry for replacement: %j",
    (variable) => {
      const config = {
        base_url: "https://api.example.com/",
        variables: { secret: { ...variable, sensitive: true } },
      };
      expect(isApiCatalogConfigEditable(config)).toBe(true);
      expect(validateApiCatalogConfig(config, { requireSecrets: false })).toBeUndefined();
      expect(validateApiCatalogConfig(config)).toBe(
        "dataConnect.apiCatalog.errors.missingSensitiveValue",
      );
    },
  );

  it.each([
    { extra: "unknown" },
    { options: { unsupported: 1 } },
    { variables: [] },
    { sensitive_variables: "secret" },
    { sensitive_variables: [1] },
    { login_request: { obsolete_session: {} } },
    { login_request: { request: { unsupported: true } } },
    { login_request: { request: { parameters: [{ name: "key", source: "legacy" }] } } },
    {
      login_request: {
        response: { "200": { content: { "application/json": { unsupported: true } } } },
      },
    },
  ])("uses a read-only fallback for unrepresentable fixed configuration %j", (extra) => {
    expect(isApiCatalogConfigEditable({ base_url: "https://api.example.com/", ...extra })).toBe(
      false,
    );
  });

  it("does not treat dynamic schema members as fixed configuration fields", () => {
    expect(
      isApiCatalogConfigEditable({
        base_url: "https://api.example.com/",
        login_request: {
          request: {
            body: { type: "object", properties: { unknown: { const: { type: "business" } } } },
          },
        },
      }),
    ).toBe(true);
  });

  it.each(["text/plain", "application/xml"])(
    "protects non-JSON response media %s from graphical replacement",
    (mediaType) => {
      const config = {
        base_url: "https://api.example.com/",
        login_request: {
          response: {
            content_type: mediaType,
            statuses: { "200": { schema: { type: "string" } } },
          },
        },
      };
      expect(isApiCatalogConfigEditable(config)).toBe(false);
      expect(validateApiCatalogConfig(config)).toBe(
        "dataConnect.apiCatalog.errors.unsupportedConfig",
      );
      expect(prepareApiCatalogConfigForEdit(config)).toEqual(config);
      config.login_request.response.content_type = "application/json";
      expect(isApiCatalogConfigEditable(config)).toBe(true);
    },
  );

  it.each([
    "",
    "ftp://api.example.com/",
    "https://user:pass@api.example.com/",
    "https://api.example.com/?",
    "https://api.example.com/#",
    " https://api.example.com/",
    "https://api.example.com/\n",
  ])("rejects unsafe or malformed service addresses without returning input %j", (base_url) => {
    expect(validateApiCatalogConfig({ base_url })).toBe("dataConnect.apiCatalog.errors.baseUrl");
  });

  it.each(["1name", "name-dash", "__paging", "variables", "base_url", "options", "login_request"])(
    "rejects invalid or reserved variable name %s",
    (name) => {
      expect(
        validateApiCatalogConfig({
          base_url: "https://api.example.com/",
          variables: { [name]: { value: "value", sensitive: false } },
        }),
      ).toBe("dataConnect.apiCatalog.errors.variables");
    },
  );

  it("requires a fresh value for every retained sensitive member on replacement", () => {
    const config = {
      base_url: "https://api.example.com/",
      variables: { secret: { sensitive: true } },
    };
    expect(validateApiCatalogConfig(config)).toBe(
      "dataConnect.apiCatalog.errors.missingSensitiveValue",
    );
    expect(validateApiCatalogConfig(config, { requireSecrets: false })).toBeUndefined();
    for (const value of [null, false, 0, "", "••••••••", "*****", "<protected-value>"])
      expect(
        validateApiCatalogConfig({
          ...config,
          variables: { secret: { value: value, sensitive: true } },
        }),
      ).toBe("dataConnect.apiCatalog.errors.missingSensitiveValue");
    expect(
      validateApiCatalogConfig({
        ...config,
        variables: { secret: { value: "  intentional spaces  ", sensitive: true } },
      }),
    ).toBeUndefined();
  });

  it.each(["true", 1, null])("rejects invalid sensitive metadata %s", (sensitive) => {
    expect(
      validateApiCatalogConfig({
        base_url: "https://api.example.com/",
        variables: { secret: { value: "value", sensitive } },
      }),
    ).toBe("dataConnect.apiCatalog.errors.unsupportedConfig");
  });

  it.each([0, -1, 1.5, "30", null, new BigNumber("0.1")])(
    "requires numeric positive integer call limits %s",
    (value) => {
      expect(
        validateApiCatalogConfig({
          base_url: "https://api.example.com/",
          options: { timeout_seconds: value },
        }),
      ).toBe("dataConnect.apiCatalog.errors.options");
    },
  );

  it("does not hard-code platform policy limits", () => {
    expect(
      validateApiCatalogConfig({
        base_url: "https://api.example.com/",
        options: { timeout_seconds: 600, max_response_mib: 100 },
      }),
    ).toBeUndefined();
  });

  it("previews symbolic templates and exact numbers while hiding declared values, raw auth and Cookie", () => {
    const preview = buildApiCatalogPreview({
      base_url: "https://api.example.com/",
      variables: {
        secret: { value: "synthetic-secret", sensitive: true },
        number: { value: new BigNumber("9007199254740993"), sensitive: false },
      },

      login_request: {
        request: {
          headers: {
            Authorization: "Bearer synthetic-secret",
            Cookie: "runtime-cookie",
            "X-Key": "{{ secret }}",
          },
          body: { type: "string", value: "synthetic-secret" },
        },
      },
    });
    expect(preview).not.toContain("synthetic-secret");
    expect(preview).not.toContain("runtime-cookie");
    expect(preview).toContain("{{ secret }}");
    expect(preview).toContain('"value": 9007199254740993');
    expect(preview).not.toContain('"value": "9007199254740993"');
  });

  it("previews valid special business keys while preserving precision and redacting credentials", () => {
    const config = JSON.parse(
      '{"base_url":"https://api.example.com/","variables":{"constructor":{"value":"sample"},"secret":{"value":"synthetic-secret","sensitive":true},"payload":{"value":{"__proto__":{"polluted":true}}}}}',
    ) as Record<string, unknown>;
    expect(validateApiCatalogConfig(config)).toBeUndefined();
    const preview = buildApiCatalogPreview(config);
    expect(preview).toContain('"constructor": {');
    expect(preview).toContain('"__proto__": {');
    expect(preview).not.toContain("synthetic-secret");
    const result = JSON.parse(preview) as { variables: { payload: { value: object } } };
    expect(Object.getPrototypeOf(result.variables.payload.value)).toBe(Object.prototype);
    expect(Object.hasOwn(result.variables.payload.value, "__proto__")).toBe(true);
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
    expect(
      buildApiCatalogPreview(config, {
        entries: [Object.fromEntries([["constructor", new BigNumber("9007199254740993")]])],
      }),
    ).toContain('"constructor": 9007199254740993');
  });

  it("always hides authentication and Cookie headers even when literals are mixed with templates", () => {
    const preview = buildApiCatalogPreview({
      base_url: "https://api.example.com/",
      variables: { tenant: { value: "demo", sensitive: false } },
      login_request: {
        request: {
          headers: {
            Authorization: "Bearer synthetic-literal-secret {{ tenant }}",
            "Proxy-Authorization": "Basic synthetic-proxy-secret {{ tenant }}",
            Cookie: "session=synthetic-cookie-secret; tenant={{ tenant }}",
            "Set-Cookie": "session=synthetic-derived-secret; tenant={{ tenant }}",
            "X-Tenant": "{{ tenant }}",
          },
        },
      },
    });
    for (const secret of [
      "synthetic-literal-secret",
      "synthetic-proxy-secret",
      "synthetic-cookie-secret",
      "synthetic-derived-secret",
    ])
      expect(preview).not.toContain(secret);
    expect(preview).toContain('"Authorization": "••••••••"');
    expect(preview).toContain('"Proxy-Authorization": "••••••••"');
    expect(preview).toContain('"Cookie": "••••••••"');
    expect(preview).toContain('"Set-Cookie": "••••••••"');
    expect(preview).toContain('"X-Tenant": "{{ tenant }}"');
  });
  it("redacts mapped test previews without converting exact response numbers", () => {
    const config = { variables: { secret: { value: "synthetic-secret", sensitive: true } } };
    const preview = buildApiCatalogPreview(config, {
      entries: [
        {
          note: "synthetic-secret",
          amount: parsePrecisionPreservingJSON("9007199254740993.000000001"),
        },
      ],
      paging: { has_more: false },
    });
    expect(preview).not.toContain("synthetic-secret");
    expect(preview).toContain('"amount": 9007199254740993.000000001');
    expect(preview).toContain('"has_more": false');
    expect(preview).not.toContain('"variables"');
  });
});
