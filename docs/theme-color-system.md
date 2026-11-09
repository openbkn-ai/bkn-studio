# Studio semantic color system

Studio uses semantic color roles so that a component describes why it needs a color instead of
selecting a numbered brand swatch. The implementation follows the
[Studio light and dark color-system specification](https://github.com/openbkn-ai/bkn-docs/blob/db7d5d87730e5301ee15fe1c9c096a1f186a66e6/docs/studio/design-system/color-system.md).

## Sources and runtime flow

- `src/app/theme/semantic-colors.ts` owns the default light and dark semantic values, custom-brand
  derivation, and contrast checks.
- `src/app/theme/theme.ts` maps the semantic roles to Ant Design global and component tokens.
- `src/framework/ui/AntdProviders.tsx` publishes the resolved runtime brand roles as CSS custom
  properties on the document root.
- `src/styles/global.css` contains matching defaults for the first paint before React mounts. A
  regression test keeps these values aligned with the TypeScript source.

The runtime `primaryColor` is an input brand color, not a component token. Studio derives two
independent groups from it:

- `action-primary` is the solid-action background. Its default, hover, and active states share a
  foreground that meets a 4.5:1 contrast ratio.
- `accent-primary` is used to derive links, focus rings, and selection indicators. Link states meet
  a 4.5:1 contrast ratio against the current page surface.

## Role selection

| Intent            | CSS variable                                                           | Typical use                                              |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Primary action    | `--color-action-primary` and state variants                            | Create, save, confirm, publish                           |
| Action foreground | `--color-action-primary-text`                                          | Text or icon inside a solid primary action               |
| Link              | `--color-link` and `--color-link-hover`                                | Navigation and inline links                              |
| Keyboard focus    | `--color-focus-ring`                                                   | `:focus-visible`, input and select focus borders         |
| Selection         | `--color-selection-accent`                                             | Active tabs, navigation, pagination, selected indicators |
| Supporting text   | `--color-text-tertiary`                                                | Readable low-emphasis labels and metadata                |
| Placeholder       | `--color-text-placeholder`                                             | Empty editable-field hints only                          |
| Disabled          | `--color-text-disabled`                                                | Disabled labels and controls only                        |
| Row state         | `--color-bg-hover`, `--color-bg-selected`, `--color-bg-selected-hover` | Table and list interaction states                        |

Status colors must continue to use the success, warning, error, and information roles. Knowledge
network nodes, metric categories, relationship lines, and charts may use their visualization
palettes; those colors must not replace status or interaction semantics.

Raw `--color-primary-*` values remain available for legacy decorative surfaces during migration.
New component code must not use a numbered primary swatch for buttons, links, focus, selection, or
readable text.

## Component mapping

- Ant Design `Button` uses the action roles.
- `Input` and `Select` use the focus role.
- `Tabs`, active pagination, and selected navigation use the selection role.
- Ant Design links and CSS links use the link roles.
- `BusinessPageTemplate` preserves its square business-page shape while inheriting the shared
  semantic roles. Knowledge-network components keep their existing rounded and visualization
  treatment.

## Verification

Run the focused theme suite after changing semantic colors or mappings:

```bash
pnpm exec vitest --run --maxWorkers=50% \
  src/app/theme/semantic-colors.test.ts \
  src/app/theme/theme.test.ts \
  src/framework/ui/AntdProviders.test.tsx
```

The suite checks default action and link contrast, light/high-saturation/mid-tone custom brands,
Ant Design mappings, and CSS/TypeScript default consistency.
