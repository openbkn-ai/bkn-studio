/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Input } from "antd";
import { useState } from "react";

import { AppButton } from "@/framework/ui/common/AppButton";
import { setDevTokens } from "@/framework/auth/dev-auth";

import styles from "./DevTokenSetupForm.module.css";

type DevTokenSetupFormProps = {
  onSaved: () => void;
};

export function DevTokenSetupForm({ onSaved }: DevTokenSetupFormProps) {
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmedAccess = accessToken.trim();

    if (!trimmedAccess) {
      setError("请填写 Access Token");
      return;
    }

    setDevTokens(trimmedAccess, refreshToken.trim() || undefined);
    setError(null);
    onSaved();
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>开发环境 Token 配置</h1>
        <p className={styles.description}>
          当前为远程联调模式（Mock 已关闭）。请粘贴从测试环境获取的 Bearer Token，保存后即可访问
          API。
        </p>
        <p className={styles.hint}>
          也可在 <code>.env.local</code> 中设置 <code>VITE_DEV_ACCESS_TOKEN</code>，重启 dev server
          后自动生效。
        </p>

        <label className={styles.field}>
          <span className={styles.label}>Access Token</span>
          <Input.TextArea
            autoSize={{ minRows: 4, maxRows: 8 }}
            placeholder="粘贴 access_token（不含 Bearer 前缀）"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Refresh Token（可选）</span>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder="可选，用于 token 过期后刷新"
            value={refreshToken}
            onChange={(event) => setRefreshToken(event.target.value)}
          />
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}

        <AppButton type="primary" onClick={handleSubmit}>
          保存并进入
        </AppButton>
      </div>
    </div>
  );
}
