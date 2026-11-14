/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { BuildSchedule } from "./build-schedule";

const now = Date.now();
const minutesAgo = (minutes: number) => now - minutes * 60_000;
const daysAgo = (days: number) => now - days * 86_400_000;

/** Persistent mock schedule configuration; no timer creates background tasks. */
export const mockBuildSchedules: BuildSchedule[] = [
  {
    id: "bs-customers-full",
    name: "Nightly customer rebuild",
    resourceId: "res-customers",
    resourceName: "customers",
    catalogId: "cat-001",
    catalogName: "customer_master",
    cronExpr: "0 2 * * *",
    executeType: "full",
    enabled: false,
    startTime: 0,
    endTime: 0,
    lastRun: 0,
    nextRun: now + 3_600_000,
    lastStatus: "never",
    lastMessage: "",
    createTime: daysAgo(3),
    updateTime: minutesAgo(5),
    creator: { id: "mock-admin", name: "Platform Admin", type: "user" },
  },
  {
    id: "bs-orders-incremental",
    name: "Hourly order refresh",
    resourceId: "res-orders",
    resourceName: "orders",
    catalogId: "cat-001",
    catalogName: "customer_master",
    cronExpr: "0 * * * *",
    executeType: "incremental",
    enabled: true,
    startTime: 0,
    endTime: 0,
    lastRun: minutesAgo(60),
    nextRun: now + 3_600_000,
    lastStatus: "success",
    lastMessage: "",
    createTime: daysAgo(5),
    updateTime: minutesAgo(10),
    creator: { id: "mock-admin", name: "Platform Admin", type: "user" },
  },
  {
    id: "bs-customers-incremental",
    name: "Customer incremental refresh",
    resourceId: "res-customers",
    resourceName: "customers",
    catalogId: "cat-001",
    catalogName: "customer_master",
    cronExpr: "30 * * * *",
    executeType: "incremental",
    enabled: true,
    startTime: 0,
    endTime: 0,
    lastRun: minutesAgo(30),
    nextRun: now + 3_600_000,
    lastStatus: "failed",
    lastMessage: "Incremental build requires an available index and a valid baseline.",
    createTime: daysAgo(2),
    updateTime: minutesAgo(2),
    creator: { id: "mock-admin", name: "Platform Admin", type: "user" },
  },
];
