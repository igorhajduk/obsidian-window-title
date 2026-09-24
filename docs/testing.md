# Window Title verification

## Environment and result

Version 0.1.0 was checked on 2026-09-11 with Obsidian 1.13.7 (installer 1.13.7), Electron 43.3.0, macOS 26.6.2 (25G83), and arm64 hardware. Runtime checks used the dedicated `.lab/Title Lab` vault, the default theme, and the hidden window frame. No other community plugins were enabled in that vault.

`npm run package` passed Obsidian ESLint rules, TypeScript checking, 20 unit tests, the production build, and bundle/package assertions. The runtime harness passed 32 checks, the editor harness passed 10 checks, and a separate vault-renderer reload retained the saved custom format and native title.

Linux and Windows are intended targets. Native Obsidian execution on those platforms has not been verified. The source/test/package CI matrix passed on Ubuntu, macOS, and Windows for the 0.1.0 release commit `0359957` ([run](https://github.com/igorhajduk/obsidian-window-title/actions/runs/34624051094)). CI does not run desktop Obsidian. Catalog acceptance requires a separate review of the published release; branch preview results are preliminary.

## Coverage

| Area | Evidence |
| --- | --- |
| Template grammar and rendering | Unit tests cover all built-ins, exact quoted property names, escaping, Unicode, repeated/adjacent elements, malformed input, empty values, `0`, `false`, structured values, and output limits. |
| Title lifecycle | Unit tests cover current native-baseline restoration, equal-value core writes, pending mutations at disable, closed-window teardown, coalescing, no idle work, and suspension under a rapid competing writer. |
| Persistence and property index | Unit tests cover serialized saves, recovery after a failed save, reference counts, replacement, and rename bookkeeping. |
| Three content windows | Native window titles and document titles matched. Each window resolved its own file and frontmatter values under the shared format. |
| Content updates | Live checks covered metadata edits, file rename, Cyrillic/emoji names, selected Graph view with no stale file path, tab movement, and enabling the plugin with pop-outs already open. |
| Disable | All three content windows restored the current standard Obsidian title. |
| Settings | A separate Settings window retained its standard title. Preview matched the content window active when settings opened. Both editing directions, literal-input focus/caret, reordering controls, malformed drafts, discard, cross-vault property-name search, insertion, and saved data were checked. |
| Editor edge cases | Synthetic DOM drag events, composition start/end, replacement of selected template text, external settings changes during an unfinished edit, and subscription cleanup passed. A new property remained searchable after its folder was renamed and disappeared after its last file was deleted. |
| Reload | The dedicated vault renderer was reloaded. A marker confirmed a new renderer context; saved settings, document title, and native title then matched. The entire multi-vault application was not restarted. |

The settings UI was also captured and inspected at its actual runtime size. Automated UI checks use DOM events and native Obsidian suggestion callbacks. They do not establish physical mouse dragging, keyboard-only navigation, or system IME acceptance.

## Remaining coverage

Native Windows/Linux title surfaces, alternate frame styles and themes, OS window switchers, physical keyboard/IME interaction, large-vault performance, deferred third-party views, sidebar-focus combinations, and full application restart remain unverified. No core Workspaces integration or persistent window identity is part of the product.

The test runtime emitted `ResizeObserver loop completed with undelivered notifications` warnings. A controlled comparison reproduced them on the stock Appearance settings page with Window Title disabled, and with its CSS disabled. Five measurements of the plugin editor had the same height. These warnings are recorded as an environment observation; the test does not establish their underlying cause or a clean application error log.

## Reproduction

```sh
npm ci
npm run package
npm run lab:prepare
```

Open this checkout's `.lab/Title Lab` vault in desktop Obsidian. Enable the Obsidian CLI, allow community plugins in this disposable vault, and enable Window Title. Then run the runtime harnesses sequentially:

```sh
node scripts/runtime-test.mjs
node scripts/editor-test.mjs
node scripts/reload-test.mjs
```

The local CLI transport checks the exact vault path before evaluation. These scripts create and remove test tabs/windows and temporary fixtures in the disposable vault, then restore its previous title format. They use host internals for setup and native readback; none of those diagnostics are bundled in the plugin. `scripts/settings-layout-check.mjs` reproduces the warning comparison. `scripts/title-spike.mjs` is an earlier feasibility experiment and must only run with Window Title disabled.

Generated local evidence is stored under the ignored `test-results` directory: `runtime.json`, `editor.json`, `reload.json`, `settings-layout.json`, and settings screenshots. The package contains only `main.js`, `manifest.json`, and `styles.css`; `dist/SHA256SUMS` records their SHA-256 values.

## Drag feedback follow-up

The visual builder now uses full-tile drag images, a faded source tile, and an accent insertion line. The dedicated `scripts/drag-feedback-test.mjs` passed 15 checks for the drag-image target, rendered source and marker styles, insertion above/below and in both directions, unchanged settings during hover, same-position handling, leaving the builder, and cancellation cleanup. The existing 10 editor checks also passed with coordinate-based drops. The screenshot was inspected in the actual macOS settings renderer. Inputs were synthetic DOM drag events; the OS drag-image appearance under a physical pointer remains unverified. The test temporarily disables background rendering throttling for the disposable Settings window and restores it afterward.
