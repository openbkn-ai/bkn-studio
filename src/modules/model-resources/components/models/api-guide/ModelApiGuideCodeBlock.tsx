/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ModelApiGuideCopyButton } from "./ModelApiGuideCopyButton";
import styles from "./ModelApiGuideDrawer.module.css";
import { ModelApiGuideMonacoEditor } from "./ModelApiGuideMonacoEditor";

type ModelApiGuideCodeBlockProps = {
  height: number | string;
  language: string;
  value: string;
};

export function ModelApiGuideCodeBlock({ height, language, value }: ModelApiGuideCodeBlockProps) {
  return (
    <div className={styles.codeBlock}>
      <ModelApiGuideCopyButton className={styles.copyButton} text={value} />
      <ModelApiGuideMonacoEditor height={height} language={language} value={value} />
    </div>
  );
}
