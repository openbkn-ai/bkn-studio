/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Validate without converting the submitted value or losing fractional seconds. */
export function temporalFilterValue(
  type: string,
  value: string,
): { absolute: boolean; nanoseconds: bigint } | null {
  if (type.trim().toLowerCase() === "datetime" && /^[+-]?\d+$/.test(value)) {
    const milliseconds = BigInt(value);
    return milliseconds >= -(2n ** 63n) && milliseconds < 2n ** 63n
      ? { absolute: true, nanoseconds: milliseconds * 1000000n }
      : null;
  }
  const pattern =
    type.trim().toLowerCase() === "date"
      ? /^(\d{4})-(\d{2})-(\d{2})$/
      : /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?|T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))$/;
  const match = pattern.exec(value);
  if (!match) return null;
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  const hour = Number(match[4] ?? match[8] ?? 0),
    minute = Number(match[5] ?? match[9] ?? 0),
    second = Number(match[6] ?? match[10] ?? 0);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  const carrier = new Date(0);
  carrier.setUTCFullYear(year, month - 1, day);
  carrier.setUTCHours(hour, minute, second, 0);
  const zone = match[12];
  const offset =
    !zone || zone === "Z"
      ? 0
      : (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4))) * (zone[0] === "+" ? 1 : -1);
  return {
    absolute: Boolean(zone),
    nanoseconds:
      BigInt(carrier.getTime() - offset * 60000) * 1000000n +
      BigInt((match[7] ?? match[11] ?? "").padEnd(9, "0")),
  };
}
