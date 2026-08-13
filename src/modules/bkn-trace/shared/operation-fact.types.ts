/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type PayloadMode = "inline" | "omitted" | "referenced";

export type PayloadEnvelope = {
  byteLength: number;
  inline?: unknown;
  mediaType: string;
  mode: PayloadMode;
  omittedReason?: string;
  ref?: string;
};

export type OperationCallFact = {
  attempt: number;
  conversationId: string;
  error?: PayloadEnvelope;
  finishedAt?: string;
  input: PayloadEnvelope;
  interactionId: string;
  operationId: string;
  output?: PayloadEnvelope;
  parentOperationId?: string;
  protocol: string;
  receiptId?: string;
  requestId?: string;
  retryable: boolean;
  sourceModule: string;
  spanId?: string;
  startedAt: string;
  status: string;
  toolName: string;
  traceId?: string;
};

export type OperationReceipt = {
  partialReasons: string[];
  receiptId: string;
  receiptStatus: string;
};
