# Hexagonal layer placeholders

This directory is intentionally empty in Phase 0.

- `domain/` — pure TypeScript: entities, value objects, domain errors, services and **ports** (interfaces).
- `application/` — use cases; may import only from `domain/`.
- `infrastructure/` — adapters (HTTP, persistence, auth, payment) that implement the ports.

The dependency rule: `domain` imports nothing, `application` imports `domain`,
`infrastructure` implements `domain` ports. `container.ts` wires them together.
