# Window Title architecture

The persisted source of truth is a versioned template string in the vault's plugin data. The parser derives ordered text, built-in, and frontmatter segments. The visual builder serializes the same segments, and the text editor parses only valid drafts. Rendering is pure; replacement values never become executable expressions or template input.

Each content container has a title controller. Public workspace events discover containers and request coalesced refreshes. `getMostRecentLeaf(container)` resolves the selected content separately for each window. File data comes from public file-view, vault, and metadata-cache APIs. A non-file view supplies its tab text and no unrelated file fields. Settings captures the active view's container for preview through `getActiveViewOfType(View)`.

A controller writes `Document.title` and observes only that document's title element. Synchronous records caused by its own write are drained immediately. External writes update the saved native baseline, including writes whose text happens to equal the custom format. On teardown, queued work is cancelled and observation stops; the current native baseline is restored only if the controller still owns the last visible value. A burst of competing writes suspends the controller instead of creating an endless loop.

Frontmatter search indexes top-level key names across Markdown metadata caches. Discovery starts when needed, yields between batches, and maintains per-file reference counts as metadata changes. It does not read or parse note text, save the index, or send data anywhere.

Settings writes run in a serial queue. Save failures remain visible and do not block later retries. External settings updates are validated, and the editor preserves an unfinished local draft until it is completed or discarded. Components dispose subscriptions and open suggestion dialogs when the settings page closes or the plugin unloads.

The production bundle imports only `obsidian`. It uses standard DOM APIs for title changes and observation. It does not call private title formatters, Electron, IPC, window-management methods, or network APIs. The development harness is separate and uses host internals to arrange disposable test cases and compare native window titles.
