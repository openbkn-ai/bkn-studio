/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import {
  BACKGROUND,
  LIVE,
  accessToken,
  LIVE_SKIP_REASON,
  collectPageErrors,
  liveEnv,
  openSection,
  runStamp,
  signIn,
  useEdition,
} from "../../helpers/bkn-project-live";
import { expectNoForbiddenWords, forbiddenHits, visibleTexts } from "../../helpers/forbidden-words";

// The community edition's main path, ported from the prototype's flow test (ce and lk), run
// against a deployed Studio and its real backend. Only the capability snapshot is shaped to the
// edition under test (see useEdition); every step's data comes from bkn-project and the services
// behind it. Writes: a project e2e-<stamp> on a new network e2e_<stamp>, published as v1.0.0 and
// switched to. The project is archived at the end; the network stays (it has no delete).
//
//   E2E_LIVE=1 E2E_BASE_URL=http://localhost:8081 E2E_TOKEN_COMMAND="openbkn auth token" \
//   E2E_CATALOG=bkn-sample-supply-chain npm run test:bkn-project:live

test.skip(!LIVE, LIVE_SKIP_REASON);
test.describe.configure({ mode: "serial" });
// A click that finds nothing fails in a minute; waiting on background work is BACKGROUND.
test.use({ actionTimeout: 60_000 });

const REQUIREMENTS = path.join(__dirname, "../../fixtures/bkn-project-requirements.md");
const names = runStamp();
let projectUrl = "";

test.beforeEach(async ({ context, page, baseURL }) => {
  await signIn(context, baseURL ?? liveEnv("E2E_BASE_URL"));
  await page.addInitScript(() => localStorage.setItem("bkn-studio:locale", "zh-CN"));
});

// Requests still in flight when a test ends need no answer.
test.afterEach(async ({ context, page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await context.unrouteAll({ behavior: "ignoreErrors" });
});

test.afterAll(async ({ browser, baseURL }) => {
  if (!projectUrl) {
    return;
  }
  // Archive through the API: the run leaves no project in the default list.
  const context = await browser.newContext();
  const id = projectUrl.match(/\/bkn-project\/([^/]+)/)?.[1] ?? "";
  const response = await context.request.post(
    `${baseURL}/api/bkn-project/v1/projects/${encodeURIComponent(id)}:archive`,
    { headers: { Authorization: `Bearer ${accessToken(true)}` } },
  );
  expect(response.ok(), `archive ${names.project}`).toBe(true);
  await context.close();
});

async function closeDialog(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /取\s*消/ }).click();
  await expect(dialog).toBeHidden();
}

/** Ticks every unticked box in the open dialog: the accepts a confirmation asks for. */
async function acceptAll(page: Page) {
  const boxes = page.getByRole("dialog").getByRole("checkbox");
  for (let index = 0; index < (await boxes.count()); index += 1) {
    const box = boxes.nth(index);
    if (!(await box.isChecked())) {
      await box.check();
    }
  }
}

test("community image: from tables and requirements to a published, switched release", async ({
  page,
}) => {
  test.setTimeout(60 * 60_000);
  const errors = collectPageErrors(page);
  await useEdition(page, "community");
  const catalog = liveEnv("E2E_CATALOG");

  await test.step("1. projects: no knowledge-base entry, no professional wording", async () => {
    await page.goto("/studio/bkn-project");
    await expect(page.getByRole("button", { name: /新建项目/ })).toBeVisible();
    await expectNoForbiddenWords(page, "project list");
  });

  await test.step("2. create the project on a new network, drafting from a catalog", async () => {
    await page.getByRole("button", { name: /新建项目/ }).click();
    const dialog = page.getByRole("dialog");
    await expectNoForbiddenWords(page, "new project dialog");
    await dialog.getByLabel("项目名称").fill(names.project);
    await dialog.getByText("新建知识网络", { exact: true }).click();
    await dialog.getByLabel("知识网络名称").fill(names.network);
    // The select filters by typing once it is open: a long catalog list scrolls virtually.
    await dialog.getByLabel("数据来源").click();
    await page.keyboard.type(catalog);
    await page.locator(`.ant-select-item-option[title="${catalog}"]`).click();
    await page.keyboard.press("Escape");
    await expect(dialog.locator(".ant-select-selection-item", { hasText: catalog })).toBeVisible();
    await dialog.getByRole("button", { name: /创\s*建/ }).click();
    await expect(page).toHaveURL(/\/bkn-project\/[^/]+\/overview$/);
    projectUrl = page.url().replace(/\/overview$/, "");
    await expect(page.getByText(`目标网络 ${names.network}`)).toBeVisible();
    await expect(page.getByText("尚未发布", { exact: true }).first()).toBeVisible();
  });

  await test.step("3. the workspace has only the core sections", async () => {
    const nav = page.getByRole("navigation", { name: "项目导航" });
    await expect(nav.getByRole("button")).toHaveText([
      "项目概览",
      "需求与资源",
      "本体建模",
      "业务场景",
      "确认与发布",
    ]);
    await expectNoForbiddenWords(page, "overview");
  });

  await test.step("4. upload a Markdown requirements document", async () => {
    // The documents are on the requirements and resources page.
    await openSection(page, "需求与资源");
    await page.getByRole("button", { name: "上传文档" }).click();
    const dialog = page.getByRole("dialog");
    // Markdown and plain text only: PDF / DOCX belong to the extension and are not offered.
    await expect(dialog).toContainText("支持 Markdown 和纯文本");
    await expectNoForbiddenWords(page, "upload dialog");
    await dialog.locator('input[type="file"]').setInputFiles(REQUIREMENTS);
    await dialog.getByRole("button", { name: "上传所选" }).click();
    await expect(dialog.getByText("已上传")).toBeVisible();
    await dialog.getByRole("button", { name: /完\s*成/ }).click();
    await expect(page.getByText("bkn-project-requirements.md").first()).toBeVisible();
    // The document type decides which side wins a conflict.
    // Click the select itself, as a person does: its shown value covers the inner combobox.
    await page
      .locator('.ant-select[aria-label="「bkn-project-requirements.md」的文档类型"]')
      .click();
    await page.locator('.ant-select-item-option[title="产品需求"]').click();
    await expect(
      page.locator(".ant-select-selection-item", { hasText: "产品需求" }).first(),
    ).toBeVisible();
  });

  let decided = "";
  await test.step("8. draft the ontology from the catalog's tables", async () => {
    await openSection(page, "本体建模");
    await page.getByRole("button", { name: "按表结构起草" }).click();
    await expect(page.getByText(/^已按项目数据目录的表结构起草/)).toBeVisible(BACKGROUND);
    await page.getByText(/^关系类 \d+$/).click();
    // Relations are recommended by counting the whole tables, never by sampling values.
    await expect(page.getByText(/全表 \d+ 行/).first()).toBeVisible();
    await page.getByText(/^对象类 \d+$/).click();
    await expectNoForbiddenWords(page, "ontology draft");
  });

  await test.step("10. choose an identity for an object type that waits for one", async () => {
    const choose = page.getByRole("button", { name: /^为.+选择唯一标识$/ });
    if ((await choose.count()) === 0) {
      test.info().annotations.push({ type: "data", description: "every object type has a key" });
      return;
    }
    // Take the identity drafting counted as unique over the whole table. A guessed key with
    // duplicates fails the data check and blocks publishing, so without a suggestion the object
    // type stays undecided and is left out at confirmation.
    const dialog = page.getByRole("dialog");
    for (const label of await choose.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label") ?? ""),
    )) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(dialog).toBeVisible();
      if (await dialog.getByText(/已为你选上/).isVisible()) {
        decided = label.replace(/^为/, "").replace(/选择唯一标识$/, "");
        await dialog.getByRole("button", { name: /保\s*存/ }).click();
        await expect(dialog).toBeHidden();
        break;
      }
      await dialog.getByRole("button", { name: /取\s*消/ }).click();
      await expect(dialog).toBeHidden();
    }
    if (!decided) {
      test.info().annotations.push({ type: "data", description: "no suggested identity" });
      return;
    }
    const adopt = page.getByRole("switch", { name: `采纳${decided}` });
    await expect(adopt).toBeEnabled();
    if (!(await adopt.isChecked())) {
      await adopt.click();
    }
    await expect(adopt).toBeChecked();
  });

  await test.step("9. edit an object type's description and see the changes", async () => {
    const edit = decided
      ? page.getByRole("button", { name: `编辑${decided}`, exact: true })
      : page.getByRole("button", { name: /^编辑/ }).first();
    if (!decided) {
      decided = ((await edit.getAttribute("aria-label")) ?? "").replace(/^编辑/, "");
    }
    await edit.click();
    const dialog = page.getByRole("dialog");
    const description = dialog.locator("#draft-item-description");
    await description.fill(`${(await description.inputValue()).trim()}（E2E 核对）`);
    await dialog.getByRole("button", { name: /保\s*存/ }).click();
    await expect(dialog).toBeHidden();
    await page.getByText(/^本次变更 \d+/).click();
    await expect(page.getByTestId("draft-change").first()).toContainText(
      `修改了对象类「${decided}」的描述`,
    );
  });

  // Requirements are drafted after the ontology: drafting maps their concepts to the drafted
  // object types, which the questions' needs and the test-question checks rely on.
  await test.step("5. draft the requirements from the document", async () => {
    await openSection(page, "业务场景");
    await page.getByRole("button", { name: "生成业务场景" }).click();
    await expect(page.getByText("需求规格第 1 版 · 已起草")).toBeVisible(BACKGROUND);
    const questions = page.getByText(/^场景问题 (\d+)$/);
    await expect(questions).not.toHaveText("场景问题 0");
    await questions.click();
    // Every drafted item quotes the document it came from.
    await expect(page.getByText("出自「bkn-project-requirements.md」").first()).toBeVisible();
    await expectNoForbiddenWords(page, "requirements");
  });

  await test.step("7. settle open requirement conflicts", async () => {
    const banner = page.getByText(/个需求冲突/);
    if (!(await banner.isVisible())) {
      test.info().annotations.push({ type: "data", description: "no requirement conflict" });
      return;
    }
    await page.getByRole("button", { name: "去处理" }).click();
    const open = page.getByRole("button", { name: /^裁\s*决$/ });
    while ((await open.count()) > 0) {
      await open.first().click();
      const dialog = page.getByRole("dialog");
      // The side the document types suggest is preselected; a reason is required.
      await dialog.getByLabel("理由（必填）").fill("E2E：按文档类型的建议");
      await dialog.getByRole("button", { name: "保存裁决" }).click();
      await expect(dialog).toBeHidden();
    }
    await expect(page.getByText(/个需求冲突/)).toBeHidden();
  });

  // Test questions are checked against the object types the questions need.
  await test.step("6. generate test questions for a question, edit one, delete one", async () => {
    await openSection(page, "业务场景");
    await page.getByText(/^场景问题 \d+$/).click();
    await page.getByText("测试问法与开发指导").first().click();
    await page.getByRole("button", { name: "生成测试问法与开发指导" }).click();
    const counts = page.getByText(/^\d+ 条，其中 \d+ 条通过数据核对，发布后回归会问$/);
    await expect(counts).toBeVisible(BACKGROUND);
    const total = Number((await counts.innerText()).split(" ")[0]);
    expect(total, "test questions generated").toBeGreaterThan(1);

    await page.getByRole("button", { name: "编辑", exact: true }).first().click();
    const text = page.getByLabel("问法", { exact: true });
    const edited = `${(await text.inputValue()).trim()}（E2E）`;
    await text.fill(edited);
    await page.getByRole("button", { name: /保\s*存/ }).click();
    await expect(page.getByText(edited)).toBeVisible();
    await expect(page.getByText("你改过").first()).toBeVisible();

    await page.getByRole("button", { name: "删除", exact: true }).last().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /删\s*除/ })
      .click();
    await expect(page.getByText("你删除了 1 条")).toBeVisible();
    await expectNoForbiddenWords(page, "test questions");
  });

  await test.step("11. confirm the draft, accepting what is left undecided", async () => {
    await openSection(page, "本体建模");
    await page.getByRole("button", { name: "确认草稿" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText(/^将把已采纳的 \d+ 个对象类和 \d+ 个关系类写入项目。$/),
    ).toBeVisible();
    // The undecided items load after the dialog opens: wait for their accept, or for nothing
    // left to accept (the button is enabled at once).
    const ok = dialog.getByRole("button", { name: /^确\s*认$/ });
    await expect(
      dialog
        .getByRole("checkbox")
        .first()
        .or(ok.and(page.locator(":enabled"))),
    ).toBeVisible();
    await acceptAll(page);
    await ok.click();
    await expect(page).toHaveURL(/\/release$/);
    await expect(page.getByText(/^已于 .+ 确认$/)).toBeVisible();
  });

  await test.step("12. the data check and the local indexes run on their own", async () => {
    const check = page.getByRole("region", { name: "数据校验" });
    await expect(check.getByText(/^已核对 \d+ \/ \d+ 项$/)).toBeVisible(BACKGROUND);
    const indexes = page.getByRole("region", { name: "本地索引" });
    await expect(indexes.getByText(/^\d+ \/ \d+ 张表的索引可用$/)).toBeVisible();
    await expectNoForbiddenWords(page, "release page");
  });

  await test.step("13–15. review the release (7 checks) and publish v1.0.0", async () => {
    await page.getByRole("button", { name: "发布审核 v1.0.0" }).click(BACKGROUND);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("将创建第一个版本", { exact: false })).toBeVisible(BACKGROUND);
    for (const check of [
      "草稿确认",
      "数据表对应",
      "名称重复",
      "项目之外的线上改动",
      "数据校验",
      "本地索引",
      "线上基础版本",
    ]) {
      await expect(dialog.getByText(check, { exact: true })).toBeVisible();
    }
    // A new network has no live version and no edits outside the project: nothing to bring in.
    await expect(dialog.getByRole("button", { name: "同步线上版本" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "提交线上的修改" })).toHaveCount(0);
    await expectNoForbiddenWords(page, "release review");
    await acceptAll(page);
    await dialog.getByRole("button", { name: "发布 v1.0.0" }).click();
    await expect(dialog).toBeHidden(BACKGROUND);
    await expect(page.getByText("已发布 v1.0.0")).toBeVisible();
    await expect(page.getByRole("row", { name: /v1\.0\.0.*本项目/ })).toBeVisible();
  });

  await test.step("16. the regression of the scenario questions records a result", async () => {
    await page.getByRole("button", { name: "查看回归结果" }).click();
    const drawer = page.getByRole("dialog", { name: "v1.0.0 的场景问题回归" });
    await expect(drawer).toBeVisible();
    // The drawer reads the regression again while it runs; re-running is allowed once it ends.
    await expect(drawer.getByRole("button", { name: "重新运行" })).toBeEnabled(BACKGROUND);
    await expect(drawer.getByText(/^\d+ \/ \d+ 次提问通过$/)).toBeVisible();
    await expect(drawer).not.toContainText(/BknAgent|NotFound|null|undefined/);
    await expectNoForbiddenWords(page, "regression");
    await drawer.getByRole("button", { name: /关\s*闭|Close/ }).click();
  });

  await test.step("17. switch the consumers to v1.0.0", async () => {
    await expect(page.getByText("v1.0.0 已发布，但使用方还在用之前的版本。")).toBeVisible();
    await page.getByRole("button", { name: "切换使用方" }).click();
    const dialog = page.getByRole("dialog", { name: "把使用方切换到 v1.0.0" });
    await expectNoForbiddenWords(page, "switch consumers");
    await dialog.getByRole("button", { name: /^切\s*换$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("使用方正在用 v1.0.0")).toBeVisible();
    await expect(page.getByText("线上 v1.0.0")).toBeVisible();
  });

  errors.expectNone();
});

test("community licence: knowledge-base entries are badged and masked, the core is untouched", async ({
  page,
}) => {
  test.skip(!projectUrl, "needs the project the community flow published");
  const errors = collectPageErrors(page);
  await useEdition(page, "licensed");

  await page.goto(`${projectUrl}/overview`);
  const nav = page.getByRole("navigation", { name: "项目导航" });
  const kb = nav.getByRole("button", { name: /知识库构建/ });
  // The entry is shown with its professional badge, and the scan sees both words.
  await expect(kb).toContainText("专业版");
  expect(forbiddenHits(await visibleTexts(page))).toEqual(
    expect.arrayContaining([expect.stringMatching(/知识库构建/)]),
  );
  // Same as Studio: a badge, never a lock icon.
  await expect(page.locator(".anticon-lock")).toHaveCount(0);

  await kb.click();
  await expect(page.locator(".console-upgrade-mask")).toBeVisible();
  // Masked, not operable: the section's own content is not mounted behind the mask.
  await expect(page.getByText("这一页还在建设中")).toHaveCount(0);

  // The core sections carry no mask and keep working.
  for (const section of ["项目概览", "需求与资源", "本体建模", "业务场景", "确认与发布"]) {
    await openSection(page, section);
    await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
    await expect(page.locator(".console-upgrade-mask")).toHaveCount(0);
  }
  await expect(page.getByText("使用方正在用 v1.0.0")).toBeVisible();
  await expect(page.getByRole("button", { name: "查看回归结果" })).toBeEnabled();

  errors.expectNone();
});

// Steps of the prototype this E2E does not run. They stay listed, not faked.
test.fixme("ask AI about a page, a decision or an object type (ask-send / dq-ask / obj-ask)", () => {
  // Asking AI about an object type is built (AskAiPanel) and stays outside this E2E; asking
  // about a page or a decision is not built.
});
test.fixme("revise a draft item, rewrite or export the change note, fix quality (cand-fb / cand-apply / cand-drop / note-fb / note-export / qual-fix)", () => {
  // bkn-project has no draft revision, change-note or quality-fix endpoint in M1.
});
test.fixme("sync from the source tables, roll back a release (sync-run / rollback-plan / rollback-run)", () => {
  // Both are built (sync: changes to the bound tables written into the draft; rollback: plan
  // and rollback) and stay outside this E2E.
});
test.fixme("export the requirements to Workshop and bkn-eval (rq-workshop / rq-eval)", () => {
  // The exports (decision D1) are built and stay outside this E2E.
});
