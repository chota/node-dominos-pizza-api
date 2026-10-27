# domexplore

A keyboard-driven learning app using Ink + React, the terminal UI libraries used by torlnk. Requires Node 22 or newer. Start at **Customer/address**, then move through the established ordering path:

Customer/address → Store → Menu → Items → Local Order → Validate → Price → Payment → Place → Track

Items → Local Order → Validate → Price → Items is the basket/DSS loop.

## Setup

From the repository root:

```sh
npm ci --ignore-scripts --omit=dev
cd example/domexplore
npm ci
npm link
# From any directory:
domexplore 2801
```

The root dependencies supply the real Customer, Address and NearbyStores classes. Ink/React dependencies remain isolated in this example.

## Learning flow

- Customer/address: arrows select fields, Enter edits, Enter saves, Escape cancels. Constructs the actual package Customer/Address locally. Nothing is sent on launch. Values stay in memory; exiting discards them.
- `n` advances and `b` goes back between learning pages.
- Store: `s` searches using the entered address. Only online-capable delivery stores with the store and delivery service open can be selected. Arrows select, Enter chooses.
- Menu: `l` loads the live raw menu. The command-line store ID (default 2801) is an exploration target, not proof that it delivers to the customer. An eligible store selected from search replaces that target.
- Menu browser: arrows select; Enter/right opens; left goes back; `/` filters; `h` returns to the root; `n` advances to Items. Product and variant references are followed with `↗` rows.
- Items through Track currently explain the process; their execution is **not connected yet**. No validate, price, payment, place, or tracking requests are made by this version.
- `q` quits when not editing or filtering. Ctrl+C also exits.

## Advanced mode: the only mouse interaction

Click the **bottom-right character cell of the terminal’s content area** five times consecutively with the left mouse button. Complete each click (press and release) with no more than one second between clicks. Another location/button, keyboard input, resize, or a longer gap resets the sequence. Repeat to turn advanced mode off.

The cell’s background is gray normally and green in advanced mode. The heading also says ADVANCED. The target follows terminal resizing and is not the window border or scrollbar. There are no other mouse actions.

Advanced mode adds **API responses** below the current step. Responses start collapsed. Tab switches keyboard focus between the current step and the response tree; arrows select, Enter toggles a branch, right expands, left collapses. Disabling advanced mode hides the tree. The most recent ten store-search/menu responses are retained in session memory, including returned address data; nothing is written to disk.

Uses xterm-compatible button reporting (1000) and SGR cell coordinates (1006). The terminal must support those protocols and pass mouse reports to the app; some terminals/multiplexers have settings that intercept clicks. Reporting is disabled on normal quit, Ctrl+C, and SIGTERM, and the previous screen is restored. As with other terminal apps, SIGKILL cannot run cleanup.

## Checks

```sh
npm test
```

Offline checks cover menu links, loading failures, navigation, customer entry, response expansion, mouse decoding, five-click recognition, resizing, and reporting cleanup.
