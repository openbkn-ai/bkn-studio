/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { getAccessProfile, type TraceAccessProfile } from "@/modules/bkn-trace/services/trace.service";

type Props = {
  allow: (profile: TraceAccessProfile) => boolean;
  children: ReactNode;
};

export function ObservabilityCapabilityBoundary({ allow, children }: Props) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<TraceAccessProfile>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getAccessProfile()
      .then((value) => { if (active) setProfile(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  if (failed) return <Alert message={t("bknTrace.errors.accessProfileFailed")} showIcon type="error" />;
  if (!profile) return <Spin />;
  if (!allow(profile)) return <Alert message={t("bknTrace.errors.accessDenied")} showIcon type="warning" />;
  return children;
}
