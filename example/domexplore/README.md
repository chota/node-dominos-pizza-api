# domexplore

An Ink + React interface, using the same terminal UI libraries as torlnk. Requires Node 22 or newer; dependencies are isolated from the core Domino’s package.

```sh
cd example/domexplore
npm ci
npm start -- 2801
```

Fetches a fresh menu when launched. This first version browses the **raw** Domino’s response, whose field names match the service. It does not yet display the package’s parsed `Menu.menu` representation.

Use arrows to select, Enter/right to open, left to go back, `/` to filter the current level, Escape to cancel filtering or go back, `h` for home, and `q` to quit. On product objects, `↗ Variant` rows follow the actual `Variants` references. Preconfigured choices link through `ReferencedProductCode`; variants link back through `ProductCode`.

Try `Products → S_PIZZA → ↗ Variant`, or `Categorization` to inspect the browsing hierarchy. Fields and codes come from the selected store’s response; menus can change.

This explorer only requests the menu. It does not validate, price, pay for, or place orders. The larger ordering cycle will be added in deliberate stages.

Run offline checks with `npm test`.

To install the command locally from this folder, run `npm link`, then use `domexplore 2801`. No npm publication is required.
