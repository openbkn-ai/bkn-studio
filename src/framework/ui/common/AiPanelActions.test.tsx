/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { useOpenedOnce } from "@/framework/hooks/use-opened-once";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { AiPanelActions } from "./AiPanelActions";

function WithHistory({ onNewChat }: { onNewChat: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <AiPanelActions
      collapse={{ label: "收起 AI 助手", onClick: vi.fn() }}
      history={{ content: <p>上一段对话</p>, onOpenChange: setOpen, open }}
      newChat={{ onClick: onNewChat }}
    >
      <button type="button">刷新</button>
    </AiPanelActions>
  );
}

describe("AiPanelActions", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("puts the panel's own buttons first, then new, earlier and hide", () => {
    const onNewChat = vi.fn();
    renderWithoutAntdStyles(<WithHistory onNewChat={onNewChat} />);

    expect(
      screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label") ?? button.textContent),
    ).toEqual(["刷新", "新对话", "历史对话", "收起 AI 助手"]);
    fireEvent.click(screen.getByRole("button", { name: "新对话" }));
    expect(onNewChat).toHaveBeenCalledOnce();
  });

  it("opens the earlier conversations under the history button", async () => {
    renderWithoutAntdStyles(<WithHistory onNewChat={vi.fn()} />);

    const history = screen.getByRole("button", { name: "历史对话" });
    expect(history).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(history);
    expect(await screen.findByText("上一段对话")).toBeInTheDocument();
    expect(history).toHaveAttribute("aria-expanded", "true");
  });

  it("leaves out history and hide where a panel has neither", () => {
    renderWithoutAntdStyles(<AiPanelActions newChat={{ disabled: true, onClick: vi.fn() }} />);

    expect(screen.getByRole("button", { name: "新对话" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "历史对话" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("useOpenedOnce", () => {
  function Panel({ open }: { open: boolean }) {
    const kept = useOpenedOnce(open);
    return kept ? <aside hidden={!open}>AI</aside> : null;
  }

  it("mounts nothing until opened, then keeps it while hidden", () => {
    const { container, rerender } = renderWithoutAntdStyles(<Panel open={false} />);
    expect(container.querySelector("aside")).toBeNull();

    rerender(<Panel open />);
    const panel = container.querySelector("aside");
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveAttribute("hidden");

    rerender(<Panel open={false} />);
    expect(container.querySelector("aside")).toBe(panel);
    expect(panel).toHaveAttribute("hidden");
  });
});
