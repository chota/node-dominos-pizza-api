# domexplore

A keyboard-driven ordering app using Ink + React, the terminal UI libraries used by torlnk. Requires Node 22 or newer. Start at **Customer/address**, then move through the established ordering path:

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

## Ordering flow

1. **Who…?** First Name is focused on launch. Return advances through Family Name, Phone and Email.
2. **Carryout or delivery?** Two vertical rows appear before any location or address screen. Up selects Carryout; Down selects Delivery; Enter commits the highlighted choice (`c`/`d` also changes the highlight). Left goes Back and Right does not change the choice. No service method or store is assumed from history.
3. **Use my location:** Enter attempts native location and reverse-geocoding after the service choice. No address fields appear beforehand. This action disappears after the attempt and does not reappear when going back within the session. Success is silent; failures are displayed. The selected service determines whether discovery starts or the delivery-address form opens.
4. **Carryout:** immediately search nearby open online carryout stores. Delivery address, apartment and handoff controls are skipped. If location failed, review/enter city, region and postal code before searching, including when cached values exist.
5. **Delivery:** refine Street, City, Region and Postal Code. A blank line separates address fields from the compact delivery controls:
   - Home: House or Apartment. Apartment requires an apartment number.
   - Mandatory handoff: Hand it to me or Leave at door. Right/Space changes the highlighted choice; Enter accepts.
   - Don't Knock, Don't Ring Doorbell, Call upon arrival: Space toggles the focused checkbox; Enter/Tab accepts and moves on. Enter never silently enables an unchecked option.
   - Extra instructions: a single-line input with a visible 120-character counter and bound. This is a local UI limit, not a verified Domino’s API limit. Longer legacy cached text is preserved until edited and must fit before continuing.
   - These controls compose the wire `Address.DeliveryInstructions` string. UI-only choices do not become extra wire fields.
6. **Store selection:** search results are filtered for the chosen service. Delivery shows stores identified as serving the refined address. Arrows highlight; Enter explicitly chooses a single store. Up can reach the search action to repeat the lookup.
7. **Your store:** after explicitly choosing a store and service, load the package's Store profile and menu. Review its address, phone and hours, then press Enter to open Add Item directly.

## Item and local order builders

Add Item uses the original package’s **`menu.menu`**, indexed once per selected store. Its presentation follows Pizza Pal’s Add Item overlay:

- Collapsed food categories, with Pizza expanded initially for an empty order.
- BYO Pizza and Personal Domino families; specialty pizzas grouped under one family selector.
- Size and crust selectors appear only when there is more than one real choice. Choosing another size/crust always resolves to an existing variant code; unavailable options are adjusted or removed with a notice.
- Defaults come from `defaultToppings`; allowed amounts come from the chosen variant’s `availableToppings`, per-code restrictions and menu tags. Seasonings marked `ignoreQty` have no Light/Extra choices. Side cups are binary choices. The menu supplies topping limits; BYO Extra consumes two slots and Personal Domino’s included provolone consumes a slot.
- Default toppings are visible. `+ Topping / side` opens additional choices. Enter opens a vertical picker; Left/Escape cancels. Quantity has a local UI bound of 1–99. Whole-item options (`1/1`) are supported; imported half-item configurations are not silently flattened.
- Select Add item or press `+` to create the package’s actual `Item` and append it to the actual `Order`. Each Add Item session adds one item, then closes to order review.

Order review keeps the same `Order` instance and retains returned identity fields during local edits. Enter edits the selected item, `a` adds another, and `d` removes it. Every mutation invalidates the builder’s validation/pricing revision markers. Menu prices are labeled as menu prices; no payable total is fabricated.

Checkout validates and prices the same Order using the original package. Back returns to the item loop; edits discard the previous payment and require validation and pricing again. Quotes expire locally after five minutes.

Payment choices follow the store's accepted methods. Card number and security code are masked, held only in memory, and never saved. The final screen shows the current total, store and service; **type PLACE and press Enter** to submit. No submission happens while adding items or reviewing a quote.

Before submission, a credential-free pending marker must save successfully. An interrupted or unclear result blocks another attempt, including after restart. Accepted orders save a receipt and offer in-app tracking. An unresolved pending order requires checking with the store; the app deliberately provides no automatic retry or reset that could duplicate it.

Both top-level and nested API statuses must indicate success. Domino's can require CAPTCHA/verification that this package cannot complete; the app reports that limitation instead of claiming the order was placed. This integration has offline checkout coverage, **not live end-to-end ordering certification**.


Arrows navigate fields; Return/Tab accepts and advances. The first typed character replaces existing focused text. Ctrl+U clears a field. Left goes back; Backspace deletes while typing and goes back outside text entry. Escape leaves typing mode. Ctrl+C exits at any time; outside text entry, `q` also exits. Going back cancels/invalidates pending requests so a late response cannot restore an old store selection.

## Local cache

`~/.domexplore.conf` is JSON, created atomically with owner-only read/write permissions (`0600`). Contact/address edits are saved shortly after typing and flushed on normal exit. On launch, values are restored and First Name is focused. A malformed config is reported rather than overwritten.

The schema has `version`, `customer`, `address`, `draftOrder`, `pendingOrder`, and `lastOrder`. Local draft items are cached separately from placed-order history and restored only after explicitly choosing their matching store and service method; saved options are checked against the current menu. Address data includes the handoff choice, three checkbox booleans, extra text, and the composed delivery-instructions string. Last-order history retains an order ID, store ID, service method, recorded time, total, and product summaries; payment credentials, passwords, and tokens are excluded. Order history never automatically submits an order or selects a store. A pending marker contains only submission identity, store, service and time; it persists until a definitive result is saved.

## Native location helper

On macOS, domexplore uses Apple Core Location and CLGeocoder, following Pizza Pal’s location/address flow. Coordinates are reverse-geocoded through Apple’s service; only address fields enter the config. No IP-based location estimate or API key is used.

The included Swift source and usage-description plist compile on first use with Apple’s Swift compiler (Xcode Command Line Tools). The locally signed helper and build cache live under `~/Library/Caches/domexplore/native/`, outside the Git checkout. Other operating systems currently support manual address entry only.

## Appearance

Mirrors Pizza Pal’s minimal presentation: a white background, black text, Pizza Pal red (`#CC2129`) headings and actions, compact side-by-side names, and a few food emojis in place of images. Apartment number appears only for apartments; delivery instructions remain visible on Where. A small Back/Continue row keeps navigation compact.

The ordering flow is independent of Pizza Pal’s current screens and remains exactly the sequence above. Pizza Pal supplies the visual reference only.

Interaction is keyboard-only. There is no advanced mode, hidden gesture, mouse reporting, or API response panel. Exiting restores the previous terminal screen.

## Checks

```sh
npm test
```

Offline checks use simulated checkout responses, including verification failures, interrupted submissions, duplicate protection, card validation and safe tracking links. They also cover both service branches, store identity, handoff controls, menu grouping, per-code option amounts and limits, size/crust reconciliation, actual Item/Order serialization, identity preservation, draft caching/restoration, and keyboard add/edit/remove flows. Live read-only discovery and Store construction were also verified using the repository’s public example address; no user location was transmitted in that check.

The live 2801 menu was also indexed for the item builder: 70 product families and 228 variants, all with locally valid default configurations. Only profile/menu GET requests were made; local checks do not certify server order validation.
