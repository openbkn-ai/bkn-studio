import tseslint from "typescript-eslint";

import { createTypeScriptConfig, ignoreConfig } from "./eslint.base.mjs";

// Default for IDE and `pnpm lint`: syntax + best-practice rules only (no project type-check).
export default tseslint.config(ignoreConfig, createTypeScriptConfig({ typeChecked: false }));
