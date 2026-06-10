import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const LOG_PATH = resolve("/workspace/../../debug-f2a625.log");
const BASE = "http://host.docker.internal:5173/execution-factory/units";

function writeLog(payload) {
  appendFileSync(LOG_PATH, `${JSON.stringify(payload)}\n`, "utf8");
}

const scenarios = [
  {
    tabKey: "operator",
    url: `${BASE}?activeTab=operator`,
    buttonPattern: /新建算子|New Operator/i,
    overlay: ".ant-modal",
  },
  {
    tabKey: "toolbox",
    url: `${BASE}?activeTab=toolbox`,
    buttonPattern: /新建工具箱|New Toolbox/i,
    overlay: ".ant-modal",
  },
  {
    tabKey: "mcp",
    url: `${BASE}?activeTab=mcp`,
    buttonPattern: /新建 MCP|New MCP/i,
    overlay: ".ant-drawer",
  },
  {
    tabKey: "skill",
    url: `${BASE}?activeTab=skill`,
    buttonPattern: /导入 Skill|Import Skill/i,
    overlay: ".ant-modal",
  },
];

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];

page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(message.text());
  }
});

const tabChecks = [];

for (const scenario of scenarios) {
  await page.goto(scenario.url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(1500);

  const activeTab = await page.locator(".ant-tabs-tab-active").innerText().catch(() => "");
  const primaryButtons = await page.locator("button.ant-btn-primary").allInnerTexts();
  const createButton = page
    .locator("button.ant-btn-primary")
    .filter({ hasText: scenario.buttonPattern })
    .first();
  const hasExpectedButton = (await createButton.count()) > 0;
  let modalOrDrawerVisible = false;

  if (hasExpectedButton) {
    await createButton.click();
    await page.waitForTimeout(700);
    modalOrDrawerVisible = (await page.locator(scenario.overlay).count()) > 0;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  tabChecks.push({
    tabKey: scenario.tabKey,
    activeTab: activeTab.trim(),
    primaryButtons,
    hasExpectedButton,
    modalOrDrawerVisible,
    hasOldGenericCreate: primaryButtons.some((text) => /^(创建|Create)$/.test(text.trim())),
  });
}

writeLog({
  sessionId: "f2a625",
  runId: "create-menu-smoke",
  hypothesisId: "F",
  location: "create-menu-smoke.mjs",
  message: "CreateMenu UI smoke test on /units",
  data: { tabChecks, errors: errors.slice(0, 8) },
  timestamp: Date.now(),
});

console.log(JSON.stringify({ tabChecks, errors: errors.slice(0, 8) }, null, 2));

await browser.close();
