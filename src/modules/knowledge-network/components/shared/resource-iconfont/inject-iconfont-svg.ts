/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import iconfontSvg from "./iconfont.svg?raw";

const SPRITE_ID = "resource-iconfont-dip-object-sprite";

function buildSprite() {
  const source = iconfontSvg.replace(/<!DOCTYPE[\s\S]*?>/i, "");
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const symbols = Array.from(parsed.querySelectorAll("symbol"));

  if (!symbols.length) {
    return null;
  }

  const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  sprite.setAttribute("id", SPRITE_ID);
  sprite.setAttribute("aria-hidden", "true");
  sprite.style.position = "absolute";
  sprite.style.width = "0";
  sprite.style.height = "0";
  sprite.style.overflow = "hidden";

  for (const symbol of symbols) {
    sprite.appendChild(document.importNode(symbol, true));
  }

  return sprite;
}

export function ensureResourceIconfontSvg() {
  if (typeof document === "undefined" || document.getElementById(SPRITE_ID)) {
    return;
  }

  const sprite = buildSprite();
  if (!sprite) {
    return;
  }

  const mount = () => {
    if (document.getElementById(SPRITE_ID)) {
      return;
    }
    document.body.insertBefore(sprite, document.body.firstChild);
  };

  if (document.body) {
    mount();
    return;
  }

  document.addEventListener("DOMContentLoaded", mount, { once: true });
}

ensureResourceIconfontSvg();
