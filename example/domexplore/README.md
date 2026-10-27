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

## Appearance

Mirrors Pizza Pal’s minimal presentation: a white background, black text, Pizza Pal red (`#CC2129`) headings and actions, compact side-by-side names, and a few food emojis in place of images. Optional unit/instruction fields are collapsed by default; `d` reveals them. The current step and a small Back/Continue row replace the long process banner.

The ordering flow is independent of Pizza Pal’s current screens and remains exactly the sequence above. Pizza Pal supplies the visual reference only.

Interaction is keyboard-only. There is no advanced mode, hidden gesture, mouse reporting, or API response panel. Exiting restores the previous terminal screen.

## Checks

```sh
npm test
```

Offline checks cover menu links, loading failures, customer entry, optional-field disclosure, retained edits, and navigation through Store and Menu into the Items learning step.
