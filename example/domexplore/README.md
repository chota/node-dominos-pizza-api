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
domexplore
```

The root dependencies supply the real Customer, Address and NearbyStores classes. Ink/React dependencies remain isolated in this example.

## Learning flow

- **Who…?** opens with First Name focused. Type immediately; Return accepts and focuses Family Name, Phone, then Email. Accepting Email opens **Where…?**, a separate screen within Customer/address.
- **Where…?** focuses Street, then City, State/region, and Postal Code. After accepting Postal Code, Return continues to Store. Arrows move between fields; Tab also advances, Shift+Tab goes back. Existing cached text is replaced by the first character typed after focusing it; Ctrl+U clears the field. Escape leaves typing mode for navigation. In navigation mode, `d` reveals optional unit/instruction fields, `b` goes back, and `n` continues.
- **Location:** the first visit to Where automatically requests a native location suggestion if no complete cached address exists. Allow **domexplore Location** in the macOS prompt. Ctrl+L refreshes the suggestion. Review the address before continuing; a late result never overwrites a field edited while the request was running. Leaving the address screen cancels the request. Manual entry remains available if access is denied or the request fails.
- **Store:** `s` searches with the address. Only online-capable delivery stores with both store and delivery service open can be selected. Arrows select, Enter chooses. No store is assumed from history.
- **Menu:** `l` loads the selected store’s live menu. Arrows select, Enter/right opens, left goes back, `/` filters, `h` returns to the root, and `n` continues to Items. `↗` rows follow product/variant references.
- Items through Track currently explain the process; their execution is **not connected yet**. This version does not validate, price, pay for, place, or track an order.
- Ctrl+C exits at any time. In navigation mode, `q` also quits. While typing, letters such as `q`, `b`, and `n` remain ordinary text.

## Local cache

`~/.domexplore.conf` is JSON, created atomically with owner-only read/write permissions (`0600`). Contact/address edits are saved shortly after typing and flushed on normal exit. On launch, values are restored and First Name is focused. A malformed config is reported rather than overwritten.

The schema has `version`, `customer`, `address`, and `lastOrder`. Last-order history retains an order ID, store ID, service method, recorded time, total, and product summaries; payment credentials, passwords, and tokens are excluded. A cached last order is shown at Local Order, but never auto-submitted and never used to auto-select a store. Since placement is not connected yet, a new installation has `lastOrder: null`.

## Native location helper

On macOS, domexplore uses Apple Core Location and CLGeocoder, following Pizza Pal’s location/address flow. Coordinates are reverse-geocoded through Apple’s service; only address fields enter the config. No IP-based location estimate or API key is used.

The included Swift source and usage-description plist compile on first use with Apple’s Swift compiler (Xcode Command Line Tools). The locally signed helper and build cache live under `~/Library/Caches/domexplore/native/`, outside the Git checkout. Other operating systems currently support manual address entry only.

## Appearance

Mirrors Pizza Pal’s minimal presentation: a white background, black text, Pizza Pal red (`#CC2129`) headings and actions, compact side-by-side names, and a few food emojis in place of images. Optional unit/instruction fields are collapsed by default; `d` reveals them. The current step and a small Back/Continue row replace the long process banner.

The ordering flow is independent of Pizza Pal’s current screens and remains exactly the sequence above. Pizza Pal supplies the visual reference only.

Interaction is keyboard-only. There is no advanced mode, hidden gesture, mouse reporting, or API response panel. Exiting restores the previous terminal screen.

## Checks

```sh
npm test
```

Offline checks cover menu links and loading failures; autofocus and Return progression; location/typing races; config round-trips, permissions and credential exclusion; restored data; and navigation through Store and Menu into Items.
