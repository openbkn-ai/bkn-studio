import tseslint from "typescript-eslint";

import { createTypeScriptConfig, ignoreConfig } from "./eslint.base.mjs";

// For CI / pre-merge: full TypeScript-aware lint (slower, overlaps with `tsc -b`).
export default tseslint.config(ignoreConfig, createTypeScriptConfig({ typeChecked: true }));
