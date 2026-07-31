/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AccountScene, type AccountSection } from "@/modules/account/scenes/AccountScene";

export function AccountPage({ section }: { section: AccountSection }) {
  return <AccountScene section={section} />;
}
