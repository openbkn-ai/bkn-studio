/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { writeTextToClipboard } from "./clipboard";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand");

function setClipboard(value: { writeText: (text: string) => Promise<void> } | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value,
  });
}

function setExecCommand(value: (command: string) => boolean) {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  if (clipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }

  if (execCommandDescriptor) {
    Object.defineProperty(document, "execCommand", execCommandDescriptor);
  } else {
    Reflect.deleteProperty(document, "execCommand");
  }

  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("writeTextToClipboard", () => {
  it("uses the Clipboard API when it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const execCommand = vi.fn(() => true);
    setClipboard({ writeText });
    setExecCommand(execCommand);

    await writeTextToClipboard("MCP config");

    expect(writeText).toHaveBeenCalledWith("MCP config");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("falls back to a selected textarea when the Clipboard API is unavailable on HTTP", async () => {
    const execCommand = vi.fn(() => {
      expect(document.querySelector("textarea")?.value).toBe("HTTP MCP config");
      return true;
    });
    setClipboard(undefined);
    setExecCommand(execCommand);

    await writeTextToClipboard("HTTP MCP config");

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("uses the fallback when the Clipboard API rejects", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")) });
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    await writeTextToClipboard("fallback");

    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("rejects when neither clipboard strategy can copy the text", async () => {
    setClipboard(undefined);
    setExecCommand(() => false);

    await expect(writeTextToClipboard("manual copy required")).rejects.toThrow(
      "Copy command was rejected",
    );

    expect(document.querySelector("textarea")).toBeNull();
  });
});
