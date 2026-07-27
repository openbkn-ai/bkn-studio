/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * agent-operator-integration rejects names outside this set with
 * `AgentOperatorIntegration.BadRequest.CommonNameInvalid`. Mirror the rule in
 * the form so hyphens/spaces/dots fail before the request goes out.
 */
export const CAPABILITY_NAME_PATTERN = /^[一-龥A-Za-z0-9_]+$/;
