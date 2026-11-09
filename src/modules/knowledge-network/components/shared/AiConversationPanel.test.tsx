/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { AiConversationPanel } from "./AiConversationPanel";

it("provides the shared AI conversation structure and example interaction", () => {
  const onExample = vi.fn();
  const { rerender } = render(
    <AiConversationPanel
      ariaLabel="AI 助手"
      composer={<div>输入区</div>}
      description="描述目标"
      examples={["生成示例"]}
      examplesLabel="你可以这样说"
      generating={false}
      generatingText="正在生成"
      messages={[]}
      onExample={onExample}
      subtitle="当前资源"
      title="AI 创建"
    />,
  );

  expect(screen.getByRole("region", { name: "AI 助手" })).toBeInTheDocument();
  expect(screen.getByText("描述目标")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "生成示例" }));
  expect(onExample).toHaveBeenCalledWith("生成示例");

  rerender(
    <AiConversationPanel
      ariaLabel="AI 助手"
      as="aside"
      composer={<div>输入区</div>}
      examples={["生成示例"]}
      generating
      generatingText="正在生成"
      messages={[{ id: "1", role: "user", content: "创建库存指标" }]}
      title="AI 创建"
    />,
  );

  expect(screen.getByText("创建库存指标")).toBeInTheDocument();
  expect(screen.getByText("正在生成")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "生成示例" })).toBeNull();
});
