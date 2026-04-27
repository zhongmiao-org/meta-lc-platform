# Orders Demo

`examples/orders-demo` owns the orders workbench sample wiring that should not live in core packages.

## Contents

- `meta-registry.ts`: seeds the orders view definition, datasource definition, permission policy, and BFF meta registry provider.
- `datasource-adapters.ts`: contains the orders-specific mutation adapter used only by this example.
- `infra/sql/001_orders_demo.sql`: creates and seeds the demo business data.
- `server.ts`: starts a BFF gateway module with the orders demo runtime runner and meta registry injected.
- `tests/`: validates example-owned adapter behavior.

## Run

```bash
pnpm install
pnpm infra:up
pnpm infra:migrate
pnpm infra:seed
pnpm query-gate
```

`pnpm query-gate` builds the BFF dependencies, starts this example server, seeds the demo SQL, and validates `POST /view/orders-workbench`.

## Test

```bash
pnpm test:examples:orders-demo
```

## Boundary

Examples may depend on core packages. Core packages must never import from `examples/*`.

Deleting `examples/` must not affect `packages/*` build or test.
