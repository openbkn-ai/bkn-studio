/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Modal } from "antd";
import { beforeAll, expect, it, vi } from "vitest";
import i18n from "i18next";
import { evalLocales } from "./locales";

import { EvalTemplatePanel } from "./EvalTemplatePanel";
import { previewEvalRuleMatches, saveEvalTemplateConfig } from "./m0-run.service";
import type { EvalTemplateConfig } from "./m0-run.service";
import type { EvalTemplateRule } from "./types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./m0-run.service", () => ({
  previewEvalRuleMatches: vi.fn(),
  saveEvalTemplateConfig: vi.fn(),
}));
beforeAll(async () => {
  await i18n.init({ lng: "zh-CN", resources: evalLocales });
});
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

const rules: EvalTemplateRule[] = [
  {
    id: "object-definition",
    origin: "builtin",
    revision: 1,
    kind: "objectType",
    group: "定义与绑定",
    title: "对象定义完整性",
    description: "检查对象定义",
    appliesWhen: "对象类已配置数据源",
    evidence: "定义快照",
    planDimensions: ["对象定义"],
    preset: "required",
    enabled: true,
  },
  {
    id: "object-instance",
    origin: "builtin",
    revision: 1,
    kind: "objectType",
    group: "实例数据",
    title: "实例可查询性",
    description: "检查对象实例",
    appliesWhen: "存在对象实例",
    evidence: "实例样本",
    planDimensions: ["实例查询"],
    preset: "standard",
    enabled: false,
  },
];
const config: EvalTemplateConfig = {
  revision: 0,
  checksum: "test-checksum",
  rules,
};

it("describes all-resource matching consistently and puts capability guidance outside fields", async () => {
  const custom: EvalTemplateRule = {
    ...rules[0],
    id: "custom-all",
    origin: "custom",
    title: "全资源检查",
    applicability: { all: [] },
    generationMode: "manual",
  };
  render(
    <EvalTemplatePanel
      networkId="kn-1"
      config={{ ...config, rules: [...rules, custom] }}
      canManage
      onChanged={vi.fn()}
    />,
  );
  const row = screen.getByText("全资源检查").closest("tr")!;
  fireEvent.click(within(row).getByRole("button", { name: /全资源检查/ }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "knowledgeNetwork.eval.templateUi.details" }),
  );
  const drawer = screen.getByRole("dialog");
  expect(within(drawer).getByText("全部同类资源")).toBeTruthy();
  expect(within(drawer).queryByText("未配置")).toBeNull();
  expect(within(drawer).queryByText("用例生成能力")).toBeNull();
  expect(within(drawer).getByRole("alert")).toHaveTextContent("规则能力说明");
});

it("shows the rule list without demo or integration-stage markers", () => {
  render(
    <EvalTemplatePanel networkId="kn-1" config={config} canManage={false} onChanged={vi.fn()} />,
  );
  expect(screen.getByRole("navigation")).toBeTruthy();
  expect(screen.getByText("对象定义完整性")).toBeTruthy();
  expect(screen.getByText("实例可查询性")).toBeTruthy();
  expect(screen.queryByText(/M0|演示|尚未接入/)).toBeNull();
  expect(screen.queryByLabelText("查看模板历史版本")).toBeNull();
  expect(screen.queryByRole("columnheader", { name: "Case 生成" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "knowledgeNetwork.eval.templateUi.addButton" }),
  ).toBeNull();
});

it("does not offer whole-rule publishing or template grants", () => {
  render(
    <EvalTemplatePanel
      networkId="kn-1"
      config={{ ...config, revision: 4 }}
      canManage={false}
      onChanged={vi.fn()}
    />,
  );
  expect(screen.queryByText("已发布")).toBeNull();
  expect(screen.queryByRole("button", { name: "发布模板" })).toBeNull();
  expect(screen.queryByRole("button", { name: "模板权限" })).toBeNull();
  expect(screen.queryByLabelText("查看模板历史版本")).toBeNull();
  expect(screen.queryByText(/版本 v11|已发布 v11/)).toBeNull();
});

it("filters rules and opens their details", () => {
  render(
    <EvalTemplatePanel networkId="kn-1" config={config} canManage={false} onChanged={vi.fn()} />,
  );
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "实例可查询性" },
  });
  expect(screen.queryByText("对象定义完整性")).toBeNull();
  const row = screen.getByText("实例可查询性").closest("tr") as HTMLElement;
  fireEvent.click(
    within(row).getByRole("button", {
      name: "实例可查询性 knowledgeNetwork.eval.templateUi.columns.actions",
    }),
  );
  fireEvent.click(
    screen.getByRole("menuitem", { name: "knowledgeNetwork.eval.templateUi.details" }),
  );
  expect(screen.getByText("实例样本")).toBeTruthy();
});

it("creates a rule directly from the drawer", async () => {
  vi.mocked(saveEvalTemplateConfig).mockImplementation((_networkId, _config, nextRules) =>
    Promise.resolve({
      ...config,
      revision: 1,
      rules: nextRules,
    }),
  );
  const onChanged = vi.fn();
  render(<EvalTemplatePanel networkId="kn-1" config={config} canManage onChanged={onChanged} />);
  fireEvent.click(await screen.findByRole("button", { name: /新\s*建/ }));
  const drawer = screen.getByRole("dialog", { name: "新建自定义规则" });
  const footer = drawer.querySelector(".ant-drawer-footer") as HTMLElement;
  const body = drawer.querySelector(".ant-drawer-body") as HTMLElement;
  expect(within(footer).getByRole("button", { name: /确\s*定/ })).toBeTruthy();
  const enabledSwitch = within(body).getByRole("switch", { name: "启用规则" });
  expect(enabledSwitch.getAttribute("aria-checked")).toBe("true");
  expect(within(footer).queryByRole("switch")).toBeNull();
  fireEvent.click(enabledSwitch);
  expect(
    within(drawer.querySelector(".ant-drawer-header") as HTMLElement).queryByRole("button", {
      name: /确\s*定/,
    }),
  ).toBeNull();
  expect(within(drawer).getByRole("alert")).toHaveTextContent("检查方式决定如何执行");
  expect(within(drawer).queryByText("Case 生成方式")).toBeNull();
  expect(within(drawer).getByText(/此处不会自动采集或校验/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "保存修改" })).toBeNull();
  fireEvent.change(within(drawer).getByLabelText("规则名称"), {
    target: { value: "自定义对象检查" },
  });
  fireEvent.change(within(drawer).getByLabelText("标签"), {
    target: { value: "对象检查" },
  });
  fireEvent.change(within(drawer).getByLabelText("检查内容"), {
    target: { value: "核对对象声明" },
  });
  fireEvent.change(within(drawer).getByLabelText("适用范围"), {
    target: { value: "对象类声明存在" },
  });
  fireEvent.change(within(drawer).getByLabelText("所需证据"), {
    target: { value: "对象声明快照" },
  });
  expect(within(drawer).getByLabelText("所需证据")).toHaveProperty("value", "对象声明快照");
  const field = within(drawer).getByRole("combobox", { name: "条件 1 字段" });
  fireEvent.mouseDown(field.closest(".ant-select")!.querySelector(".ant-select-selector")!);
  fireEvent.click(await screen.findByText("资源 ID"));
  expect(within(drawer).getByText("资源 ID")).toBeTruthy();
  for (const name of ["规则名称", "标签", "检查内容", "适用范围", "所需证据"]) {
    expect(within(drawer).getByLabelText(name), name).not.toHaveProperty("value", "");
  }
  fireEvent.click(within(drawer).getByRole("button", { name: /确\s*定/ }));
  expect(
    screen.queryAllByText(/请填写规则名称|请配置 1 至 5 条/).map((item) => item.textContent),
  ).toEqual([]);
  await waitFor(() => expect(saveEvalTemplateConfig).toHaveBeenCalledOnce());
  expect(vi.mocked(saveEvalTemplateConfig).mock.calls[0][2].at(-1)?.title).toBe("自定义对象检查");
  expect(vi.mocked(saveEvalTemplateConfig).mock.calls[0][2].at(-1)?.enabled).toBe(false);
  expect(onChanged).toHaveBeenCalledOnce();
}, 30000);

it("previews matches for all resources without a placeholder condition", async () => {
  vi.mocked(previewEvalRuleMatches).mockResolvedValue({
    total_resources: 3,
    scanned_resources: 3,
    total_targets: 3,
    matched_targets: 3,
    unreadable: 0,
    examples: ["采购单", "供应商"],
  });
  render(<EvalTemplatePanel networkId="kn-1" config={config} canManage onChanged={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: /新\s*建/ }));
  const drawer = screen.getByRole("dialog", { name: "新建自定义规则" });
  fireEvent.click(within(drawer).getByRole("checkbox", { name: "适用全部同类资源" }));
  expect(within(drawer).getByLabelText("适用范围")).toHaveProperty("value", "全部同类资源");
  expect(within(drawer).queryByRole("combobox", { name: "条件 1 字段" })).toBeNull();
  fireEvent.click(within(drawer).getByRole("button", { name: "预览命中资源" }));
  await waitFor(() => expect(previewEvalRuleMatches).toHaveBeenCalledOnce());
  expect(vi.mocked(previewEvalRuleMatches).mock.calls[0][2]).toEqual({ all: [] });
  expect(await within(drawer).findByText(/命中 3 \/ 3 个资源/)).toBeTruthy();
});

it("opens a copied rule as a new rule", async () => {
  const copiedConfig: EvalTemplateConfig = {
    ...config,
    execution_support: {
      "object-definition": {
        status: "supported",
        reason: "可检查",
        check: { type: "non_empty", binding: "primary_keys" },
      },
    },
    check_capabilities: [
      {
        type: "non_empty",
        name: "非空检查",
        kinds: ["objectType"],
        bindings: ["primary_keys", "display_key"],
        help: "检查实际数据",
      },
    ],
  };
  render(
    <EvalTemplatePanel networkId="kn-1" config={copiedConfig} canManage onChanged={vi.fn()} />,
  );
  await screen.findByRole("button", { name: /新\s*建/ });
  const row = screen.getByText("对象定义完整性").closest("tr") as HTMLElement;
  fireEvent.click(
    within(row).getByRole("button", {
      name: "对象定义完整性 knowledgeNetwork.eval.templateUi.columns.actions",
    }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "复制" }));
  const drawer = screen.getByRole("dialog", { name: "复制规则" });
  expect(within(drawer).getByText("非空检查")).toBeTruthy();
  expect(within(drawer).getByText("对象主键（完整组合）")).toBeTruthy();
  expect(within(drawer).getByRole("button", { name: /确\s*定/ })).toBeTruthy();
  expect(within(drawer).getByRole("alert")).toHaveTextContent("检查方式决定如何执行");
});

it("saves rule settings without a default case quota", async () => {
  vi.mocked(saveEvalTemplateConfig).mockResolvedValue({ ...config, revision: 1 });
  render(<EvalTemplatePanel networkId="kn-1" config={config} canManage onChanged={vi.fn()} />);
  await screen.findByRole("button", { name: /新\s*建/ });
  const row = screen.getByText("对象定义完整性").closest("tr") as HTMLElement;
  fireEvent.click(
    within(row).getByRole("button", {
      name: "对象定义完整性 knowledgeNetwork.eval.templateUi.columns.actions",
    }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "编辑" }));
  const editor = screen.getByRole("dialog", { name: "调整内置规则" });
  expect(screen.queryByText("默认用例数")).toBeNull();
  expect(within(editor).queryByRole("spinbutton")).toBeNull();
  fireEvent.click(within(editor).getByRole("switch", { name: "启用规则" }));
  fireEvent.click(within(editor).getByRole("button", { name: /确\s*定/ }));
  await waitFor(() => expect(saveEvalTemplateConfig).toHaveBeenCalled());
  const savedRules = vi.mocked(saveEvalTemplateConfig).mock.calls.at(-1)?.[2];
  expect(savedRules?.[0].enabled).toBe(false);
  expect(savedRules?.every((rule) => !("defaultCount" in rule))).toBe(true);
});

it("enables and disables a rule from the list actions", async () => {
  vi.mocked(saveEvalTemplateConfig).mockClear();
  vi.mocked(saveEvalTemplateConfig).mockImplementation((_networkId, _config, nextRules) =>
    Promise.resolve({
      ...config,
      revision: 1,
      rules: nextRules,
    }),
  );
  const onChanged = vi.fn();
  render(<EvalTemplatePanel networkId="kn-1" config={config} canManage onChanged={onChanged} />);
  await screen.findByRole("button", { name: /新\s*建/ });
  const row = screen.getByText("对象定义完整性").closest("tr") as HTMLElement;
  const openActions = () =>
    fireEvent.click(
      within(row).getByRole("button", {
        name: "对象定义完整性 knowledgeNetwork.eval.templateUi.columns.actions",
      }),
    );

  openActions();
  fireEvent.click(screen.getByRole("menuitem", { name: "停用" }));
  await waitFor(() => expect(saveEvalTemplateConfig).toHaveBeenCalledOnce());
  expect(vi.mocked(saveEvalTemplateConfig).mock.calls[0][2][0].enabled).toBe(false);
  await waitFor(() =>
    expect(within(row).getByText("knowledgeNetwork.eval.templateUi.disabled")).toBeTruthy(),
  );

  openActions();
  fireEvent.click(screen.getByRole("menuitem", { name: "启用" }));
  await waitFor(() => expect(saveEvalTemplateConfig).toHaveBeenCalledTimes(2));
  expect(vi.mocked(saveEvalTemplateConfig).mock.calls[1][2][0].enabled).toBe(true);
  expect(onChanged).toHaveBeenCalledTimes(2);
});

it("deletes a custom rule without a second save step", async () => {
  vi.mocked(saveEvalTemplateConfig).mockClear();
  const customRule: EvalTemplateRule = {
    ...rules[0],
    id: "custom-1",
    origin: "custom",
    title: "自定义对象检查",
    applicability: { all: [{ field: "id", operator: "exists" }] },
  };
  const current = { ...config, revision: 1, rules: [...rules, customRule] };
  vi.mocked(saveEvalTemplateConfig).mockImplementation((_networkId, _config, nextRules) =>
    Promise.resolve({
      ...current,
      revision: 2,
      rules: nextRules,
    }),
  );
  const confirmSpy = vi
    .spyOn(Modal, "confirm")
    .mockReturnValue({} as ReturnType<typeof Modal.confirm>);
  render(<EvalTemplatePanel networkId="kn-1" config={current} canManage onChanged={vi.fn()} />);
  await screen.findByRole("button", { name: /新\s*建/ });
  const row = screen.getByText("自定义对象检查").closest("tr") as HTMLElement;
  fireEvent.click(
    within(row).getByRole("button", {
      name: "自定义对象检查 knowledgeNetwork.eval.templateUi.columns.actions",
    }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "删除" }));
  expect(confirmSpy).toHaveBeenCalledOnce();
  await confirmSpy.mock.calls[0][0].onOk?.();
  await waitFor(() => expect(saveEvalTemplateConfig).toHaveBeenCalledOnce());
  expect(vi.mocked(saveEvalTemplateConfig).mock.calls[0][2]).toEqual(rules);
  confirmSpy.mockRestore();
});

it("does not show a target case quota for current object instance rules", () => {
  const objectRule = {
    ...rules[0],
    id: "object-key-completeness",
    title: "实例主键非空",
    builtinVersion: 4,
  };
  const currentConfig: EvalTemplateConfig = {
    ...config,
    revision: 1,
    rules: [objectRule],
  };
  render(
    <EvalTemplatePanel networkId="kn-1" config={currentConfig} canManage onChanged={vi.fn()} />,
  );
  const row = screen.getByText("实例主键非空").closest("tr") as HTMLElement;
  expect(within(row).queryByText("—")).toBeNull();
  expect(screen.queryByText("默认用例数")).toBeNull();
  expect(screen.queryByRole("button", { name: "更新内置规则" })).toBeNull();
  expect(screen.getByRole("button", { name: /新\s*建/ })).toBeTruthy();
});

it("does not show a target case quota for legacy declaration rules", () => {
  const relation: EvalTemplateRule = {
    ...rules[0],
    id: "relation-endpoint",
    kind: "relationType",
    builtinVersion: 3,
    title: "端点与映射声明",
  };
  render(
    <EvalTemplatePanel
      networkId="kn-1"
      config={{ ...config, rules: [relation] }}
      canManage={false}
      onChanged={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /knowledgeNetwork.eval.templateUi.kinds.relationType/ }),
  );
  const row = screen.getByText("端点与映射声明").closest("tr") as HTMLElement;
  expect(screen.queryByText("默认用例数")).toBeNull();
  expect(within(row).getByText("端点与映射声明")).toBeTruthy();
});

it("keeps v4 action runtime checks distinct from legacy declaration checks", () => {
  const action: EvalTemplateRule = {
    ...rules[0],
    id: "action-precondition",
    kind: "action",
    builtinVersion: 4,
    title: "前置条件筛选正确",
    evidence: "正反实例及实际目标集合",
  };
  render(
    <EvalTemplatePanel
      networkId="kn-1"
      config={{ ...config, rules: [action] }}
      canManage={false}
      onChanged={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /knowledgeNetwork.eval.templateUi.kinds.action/ }),
  );
  const row = screen.getByText("前置条件筛选正确").closest("tr") as HTMLElement;
  expect(screen.queryByText("默认用例数")).toBeNull();
  fireEvent.click(
    within(row).getByRole("button", {
      name: "前置条件筛选正确 knowledgeNetwork.eval.templateUi.columns.actions",
    }),
  );
  fireEvent.click(
    screen.getByRole("menuitem", { name: "knowledgeNetwork.eval.templateUi.details" }),
  );
  expect(screen.queryByText("不生成用例")).toBeNull();
  expect(screen.getByText(/具体材料见“所需证据”/)).toBeTruthy();
});

const filterKey = (field: string) => `knowledgeNetwork.eval.templateUi.filters.${field}`;
async function chooseRuleFilter(field: string, option: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: filterKey(field) }));
  fireEvent.click(await screen.findByText(option, { selector: ".ant-select-item-option-content" }));
}

it("combines rule filters and resets through individual controls without a clear-all button", async () => {
  const mixed: EvalTemplateRule[] = [
    ...rules,
    {
      ...rules[0],
      id: "optional-disabled",
      title: "对象映射检查",
      preset: "standard",
      enabled: false,
    },
    { ...rules[0], id: "required-disabled", title: "对象停用必测检查", enabled: false },
  ];
  render(
    <EvalTemplatePanel
      networkId="kn-1"
      config={{ ...config, rules: mixed }}
      canManage={false}
      onChanged={vi.fn()}
    />,
  );
  await chooseRuleFilter("tag", "定义与绑定");
  expect(screen.queryByText("实例可查询性")).toBeNull();
  await chooseRuleFilter("preset", "knowledgeNetwork.eval.templateUi.presets.required");
  expect(screen.queryByText("对象映射检查")).toBeNull();
  await chooseRuleFilter("state", "knowledgeNetwork.eval.templateUi.disabled");
  expect(screen.queryByText("对象定义完整性")).toBeNull();
  expect(screen.getByText("对象停用必测检查")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "实例" } });
  expect(screen.queryByText("对象停用必测检查")).toBeNull();
  expect(screen.getByText("knowledgeNetwork.eval.templateUi.noRules")).toBeTruthy();
  expect(screen.queryByRole("button", { name: filterKey("clear") })).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  await chooseRuleFilter("tag", filterKey("allTags"));
  await chooseRuleFilter("preset", filterKey("allPresets"));
  await chooseRuleFilter("state", filterKey("allStates"));
  for (const rule of mixed) expect(screen.getByText(rule.title)).toBeTruthy();
  expect(screen.queryByRole("button", { name: filterKey("clear") })).toBeNull();
}, 30000);

it("uses tags from the selected resource kind and preserves level and status across kinds", async () => {
  const skill: EvalTemplateRule = {
    ...rules[0],
    id: "skill-doc",
    kind: "skill",
    group: "Skill 可用性",
    title: "Skill 文档可读取",
  };
  render(
    <EvalTemplatePanel
      networkId="kn-1"
      config={{ ...config, rules: [...rules, skill] }}
      canManage={false}
      onChanged={vi.fn()}
    />,
  );
  await chooseRuleFilter("tag", "定义与绑定");
  await chooseRuleFilter("preset", "knowledgeNetwork.eval.templateUi.presets.required");
  await chooseRuleFilter("state", "knowledgeNetwork.eval.templateUi.enabled");
  fireEvent.click(
    screen.getByRole("button", { name: /knowledgeNetwork.eval.templateUi.kinds.skill/ }),
  );
  expect(screen.getByText(skill.title)).toBeTruthy();
  const toolbar = screen.getByRole("group", { name: filterKey("toolbar") });
  expect(within(toolbar).getByText(filterKey("allTags"))).toBeTruthy();
  expect(
    within(toolbar).getByText("knowledgeNetwork.eval.templateUi.presets.required"),
  ).toBeTruthy();
  expect(within(toolbar).getByText("knowledgeNetwork.eval.templateUi.enabled")).toBeTruthy();
  await chooseRuleFilter("tag", skill.group);
  expect(screen.getByText(skill.title)).toBeTruthy();
}, 30000);

it("returns to page one when a rule filter changes even if multiple pages still match", async () => {
  const many = Array.from({ length: 22 }, (_, index) => ({
    ...rules[0],
    id: `rule-${index + 1}`,
    title: `筛选规则 ${index + 1}`,
    group: index < 20 ? "组 A" : "组 B",
  }));
  render(
    <EvalTemplatePanel
      networkId="kn-1"
      config={{ ...config, rules: many }}
      canManage={false}
      onChanged={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByTitle(/Next Page|下一页/));
  expect(screen.getByText("筛选规则 11")).toBeTruthy();
  await chooseRuleFilter("tag", "组 A");
  expect(screen.getByText("筛选规则 1")).toBeTruthy();
  expect(screen.queryByText("筛选规则 11")).toBeNull();
});

it("clears a tag removed by a configuration update instead of leaving an empty invisible filter", async () => {
  const { rerender } = render(
    <EvalTemplatePanel networkId="kn-1" config={config} canManage={false} onChanged={vi.fn()} />,
  );
  await chooseRuleFilter("tag", "定义与绑定");
  expect(screen.queryByText("实例可查询性")).toBeNull();
  rerender(
    <EvalTemplatePanel
      networkId="kn-1"
      config={{ ...config, revision: 1, rules: [rules[1]] }}
      canManage={false}
      onChanged={vi.fn()}
    />,
  );
  expect(await screen.findByText("实例可查询性")).toBeTruthy();
  expect(
    within(screen.getByRole("group", { name: filterKey("toolbar") })).getByText(
      filterKey("allTags"),
    ),
  ).toBeTruthy();
});
