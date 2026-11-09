/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { Form, type FormInstance, Input } from "antd";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));

// Keys, with the parameters a message takes after them.
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkActionType: mocks.read,
  getKnowledgeNetworkObjectType: mocks.read,
  getKnowledgeNetworkRelationType: mocks.read,
}));

import type { DefinitionDeclarations } from "@/modules/knowledge-network/types/knowledge-network";
import {
  type DefinitionDeclarationFormValues,
  toDefinitionDeclarationForm,
} from "@/modules/knowledge-network/utils/definition-declarations";

import { DefinitionDeclarationFields, type ReplacementOption } from "./DefinitionDeclarationFields";
import { DeprecatedBanner } from "./DeprecatedBanner";
import { DeprecatedName } from "./DeprecatedName";

const PREFIX = "knowledgeNetwork.definitionDeclarations";
const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

afterEach(() => {
  cleanup();
  mocks.read.mockReset();
});

const deprecated: DefinitionDeclarations = {
  lifecycle: { reason: "旧工号停用", status: "deprecated" },
};
const objectTypes: ReplacementOption[] = [
  { id: "doctor", name: "医生" },
  { declarations: deprecated, id: "legacy_doctor", name: "医生（旧工号）" },
  { id: "patient", name: "患者" },
];

function renderFields(stored?: DefinitionDeclarations) {
  const search = vi.fn((keyword: string) =>
    Promise.resolve(objectTypes.filter((item) => item.name.includes(keyword))),
  );
  const resolve = vi.fn((id: string) =>
    Promise.resolve(objectTypes.find((item) => item.id === id)),
  );
  let form: FormInstance<DefinitionDeclarationFormValues & { name: string }> | undefined;
  function Harness() {
    const [instance] = Form.useForm<DefinitionDeclarationFormValues & { name: string }>();
    form = instance;
    return (
      <Form
        form={instance}
        initialValues={{ name: "患者", ...toDefinitionDeclarationForm(stored) }}
      >
        <Form.Item name="name" noStyle>
          <Input aria-label="name" />
        </Form.Item>
        <DefinitionDeclarationFields
          definitionId="patient"
          ownNameFields={["name"]}
          resolveReplacement={resolve}
          searchReplacements={search}
        />
      </Form>
    );
  }
  renderWithoutAntdStyles(<Harness />);
  return { form: () => form!, resolve, search };
}

describe("DefinitionDeclarationFields", () => {
  it("asks for a reason only once the definition is deprecated", async () => {
    const { form } = renderFields();
    expect(screen.queryByText(`${PREFIX}.reason`)).toBeNull();

    fireEvent.click(screen.getByLabelText(`${PREFIX}.lifecycleOption.deprecated`));
    expect(await screen.findByText(`${PREFIX}.reason`)).toBeTruthy();

    await act(async () => {
      await form()
        .validateFields()
        .catch(() => undefined);
    });
    expect(await screen.findByText(`${PREFIX}.reasonRequired`)).toBeTruthy();
  });

  it("offers as replacement only the definitions in use other than itself", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderFields(deprecated);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      fireEvent.mouseDown(screen.getByRole("combobox", { name: `${PREFIX}.replacedBy` }));
      // The options' accessible list holds their values.
      await waitFor(() =>
        expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
          "doctor",
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the stored replacement by name", async () => {
    const { resolve } = renderFields({
      lifecycle: { ...deprecated.lifecycle!, replacedBy: "doctor" },
    });
    await waitFor(() => expect(resolve).toHaveBeenCalledWith("doctor"));
    expect(await screen.findByTitle("医生")).toBeTruthy();
  });

  it("refuses an alias that repeats the name", async () => {
    const { form } = renderFields({ aliases: ["患者"] });
    await act(async () => {
      await form()
        .validateFields()
        .catch(() => undefined);
    });
    expect(await screen.findByText(`${PREFIX}.aliasProblem.ownName {"alias":"患者"}`)).toBeTruthy();
  });

  it("refuses an alias as soon as the name is changed to it", async () => {
    renderFields({ aliases: ["病人"] });
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "病人" } });
    expect(await screen.findByText(`${PREFIX}.aliasProblem.ownName {"alias":"病人"}`)).toBeTruthy();
  });
});

describe("DeprecatedBanner and DeprecatedName", () => {
  it("links the banner to the replacement, by name", async () => {
    mocks.read.mockResolvedValue({ id: "order_by_doctor", name: "开单医生" });
    renderWithoutAntdStyles(
      <MemoryRouter>
        <DeprecatedBanner
          declarations={{
            lifecycle: { reason: "旧编码", replacedBy: "order_by_doctor", status: "deprecated" },
          }}
          kind="relation_type"
          networkId="clinic"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(`${PREFIX}.banner.relation_type {"reason":"旧编码"}`)).toBeTruthy();
    const link = await screen.findByRole("link", { name: "开单医生" });
    expect(link.getAttribute("href")).toBe(
      "/knowledge-network/workspace/clinic/relation-types/order_by_doctor/detail",
    );
    // A replacement gone or hidden reads as unnamed, without an error toast of its own.
    expect(mocks.read).toHaveBeenCalledWith("clinic", "order_by_doctor", { skipErrorToast: true });
  });

  it("shows nothing for a definition in use", () => {
    const { container } = renderWithoutAntdStyles(
      <MemoryRouter>
        <DeprecatedBanner declarations={{ aliases: ["医师"] }} kind="object_type" networkId="n" />
        <DeprecatedName declarations={{ aliases: ["医师"] }}>
          <span>医生</span>
        </DeprecatedName>
      </MemoryRouter>,
    );
    expect(container.innerHTML).toBe("<span>医生</span>");
  });

  it("tags a deprecated definition in a list", () => {
    renderWithoutAntdStyles(
      <DeprecatedName declarations={deprecated}>
        <span>医生（旧工号）</span>
      </DeprecatedName>,
    );
    expect(screen.getByText(`${PREFIX}.deprecatedTag`).getAttribute("title")).toBe("旧工号停用");
  });
});
