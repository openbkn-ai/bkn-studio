/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * The nav icon for SKILLs. Ant Design has no sparkle, and the closest stand-ins (a star, a bulb)
 * read as "favourite" or "idea" rather than "skill", so the design's two-star sparkle is drawn
 * here. Stroke and sizing follow the outlined Ant icons it sits next to.
 */
export function SkillsSparkIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="1em"
      role="img"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.4"
      viewBox="0 0 24 24"
      width="1em"
    >
      <path d="M14.2 2.8 15.9 7.4 20.5 9.1 15.9 10.8 14.2 15.4 12.5 10.8 7.9 9.1 12.5 7.4 14.2 2.8Z" />
      <path d="M6.4 14.4 7.2 16.6 9.4 17.4 7.2 18.2 6.4 20.4 5.6 18.2 3.4 17.4 5.6 16.6 6.4 14.4Z" />
    </svg>
  );
}
