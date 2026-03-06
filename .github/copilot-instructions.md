## TypeScript:

### Absolute rules:

- Use loose equality for nullish checks: `x == null` / `x != null` to coalesce both `null` and `undefined` in a single comparison.
- Never produce `null` literals in code. Reserve `null` only in narrowing expressions on nullable types (`x == null`).
- Use optional parameter syntax (`param?: T`) for parameters that may be `undefined`. Never use explicit `undefined` union types.
- Use bare `return;` for `void` / `undefined` return paths. Never write `return undefined`.
- Check empty strings with strict equality: `str === ''` / `str !== ''`.
- Use guard clauses (early `return`) to reduce nesting depth in function bodies.
- In loop bodies, use early `continue` guards instead of deeply nested conditionals.
- Prefer imperative `for`/`for...of` loops over chained `.filter().map()`, `.forEach()`, or multiple `.filter()` calls.
- Use `camelCase` for all identifiers, including module-level constants (no `UPPER_SNAKE_CASE`).
- Comply with the project ESLint configuration (`eslint.config.js`).

### Rules with exceptions:

- Use function declarations for top-level functions. Use arrow functions only for closures and inline callbacks.
- Avoid type assertions (`as T`). Prefer explicit type annotations, type guards, or the `satisfies` operator. Exception: when the type system cannot infer or narrow the type correctly.
- Avoid unnecessary object spread. Prefer direct property assignment, unless spread produces more readable code.
- Prefer `interface` over `type` alias for object shapes. Exception: use `type` for unions, intersections, mapped types, or conditional types.

### Recommendations:

- Check empty arrays via `array.length === 0`.
- When constructing object literals, declare required (non-optional) properties first, then use `if`/`else` blocks for conditional properties instead of nested ternary expressions.
- Use `array.push(...other)` for in-place array concatenation instead of `array = [...array, ...other]`.
