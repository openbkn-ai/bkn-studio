/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 让 Monaco 走本地 bundle，而不是运行时从 jsdelivr CDN 下载。
 *
 * `@monaco-editor/react` 默认用 AMD loader 去 CDN 拉 monaco 核心，内网 / 弱网环境
 * 拉不到或很慢，编辑器就一直卡在 Loading（函数工作台的处理逻辑、测试入参、以及
 * 各处 JSON/代码编辑器全受影响）。这里把打进构建的本地 `monaco-editor` 直接喂给
 * loader，并用 Vite 的 `?worker` 把语言 worker 也一起打包，彻底断开对 CDN 的依赖。
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    // JSON 有专门的校验 / 补全 worker；其余语言（含本项目用的 python）走通用
    // editor worker 即可，语法高亮是 Monarch 规则、不依赖 worker。
    if (label === "json") {
      return new jsonWorker();
    }

    return new editorWorker();
  },
};

loader.config({ monaco });
