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

The root dependencies supply the real Customer, Address, NearbyStores and Store classes. Ink/React dependencies remain isolated in this example.

## Learning flow

1. **Who…?** First Name is focused on launch. Return advances through Family Name, Phone and Email.
2. **Use my location:** Enter attempts native location and reverse-geocoding. No address fields appear beforehand. This action disappears after the attempt and does not reappear when going back within the session. Success is silent; failures are displayed.
3. **Carryout or delivery?** Right/Space changes the highlighted choice; Enter commits it (`c`/`d` also changes the highlight). No service method or store is assumed from history.
4. **Carryout:** immediately search nearby open online carryout stores. Delivery address, apartment and handoff controls are skipped. If location failed, review/enter city, region and postal code before searching, including when cached values exist.
5. **Delivery:** refine Street, City, Region and Postal Code. A blank line separates address fields from the compact delivery controls:
   - Home: House or Apartment. Apartment requires an apartment number.
   - Mandatory handoff: Hand it to me or Leave at door. Right/Space changes the highlighted choice; Enter accepts.
   - Don't Knock, Don't Ring Doorbell, Call upon arrival: Space toggles the focused checkbox; Enter/Tab accepts and moves on. Enter never silently enables an unchecked option.
   - Extra instructions: a single-line input with a visible 120-character counter and bound. This is a local UI limit, not a verified Domino’s API limit. Longer legacy cached text is preserved until edited and must fit before continuing.
   - These controls compose the wire `Address.DeliveryInstructions` string. UI-only choices do not become extra wire fields.
6. **Store selection:** search results are filtered for the chosen service. Delivery shows stores identified as serving the refined address. Arrows highlight; Enter explicitly chooses a single store. Up can reach the search action to repeat the lookup.
7. **Your store:** only after both service method and store are chosen, construct the package’s `Store(storeID)`. This fetches its profile and menu. Display `store.info`; `i` browses every profile field. Enter continues to the already-loaded menu. No separate menu fetch is needed.
8. **Menu:** arrows select, Enter/right opens, left goes back, `/` filters, `h` returns to the root, and `n` continues to Items. `↗` rows follow product/variant references.

Items through Track currently explain the process; their execution is **not connected yet**. This version does not validate, price, pay for, place, or track an order.

Arrows navigate fields; Return/Tab accepts and advances. The first typed character replaces existing focused text. Ctrl+U clears a field. Left goes back; Backspace deletes while typing and goes back outside text entry. Escape leaves typing mode. Ctrl+C exits at any time; outside text entry, `q` also exits. Going back cancels/invalidates pending requests so a late response cannot restore an old store selection.

## Local cache

`~/.domexplore.conf` is JSON, created atomically with owner-only read/write permissions (`0600`). Contact/address edits are saved shortly after typing and flushed on normal exit. On launch, values are restored and First Name is focused. A malformed config is reported rather than overwritten.

The schema has `version`, `customer`, `address`, and `lastOrder`. Address data includes the handoff choice, three checkbox booleans, extra text, and the composed delivery-instructions string. Last-order history retains an order ID, store ID, service method, recorded time, total, and product summaries; payment credentials, passwords, and tokens are excluded. A cached last order is shown at Local Order, but never auto-submitted and never used to auto-select a store. Since placement is not connected yet, a new installation has `lastOrder: null`.

## Native location helper

On macOS, domexplore uses Apple Core Location and CLGeocoder, following Pizza Pal’s location/address flow. Coordinates are reverse-geocoded through Apple’s service; only address fields enter the config. No IP-based location estimate or API key is used.

The included Swift source and usage-description plist compile on first use with Apple’s Swift compiler (Xcode Command Line Tools). The locally signed helper and build cache live under `~/Library/Caches/domexplore/native/`, outside the Git checkout. Other operating systems currently support manual address entry only.

## Appearance

Mirrors Pizza Pal’s minimal presentation: a white background, black text, Pizza Pal red (`#CC2129`) headings and actions, compact side-by-side names, and a few food emojis in place of images. Apartment number appears only for apartments; delivery instructions remain visible on Where. The current step and a small Back/Continue row replace the long process banner.

The ordering flow is independent of Pizza Pal’s current screens and remains exactly the sequence above. Pizza Pal supplies the visual reference only.

Interaction is keyboard-only. There is no advanced mode, hidden gesture, mouse reporting, or API response panel. Exiting restores the previous terminal screen.

## Checks

```sh
npm test
```

Offline checks cover both service branches, eligibility filtering, explicit store selection, Store/profile identity, late-response handling, required handoff, compact instruction composition and bounds, config persistence, and menu navigation. Live read-only discovery and Store construction were also verified using the repository’s public example address; no user location was transmitted in that check.
