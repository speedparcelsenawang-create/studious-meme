---
name: Partial-update PUT routes and hasOwnProperty
description: A gotcha where building a payload object with `{key: cond ? val : undefined}` still defines the key, breaking "only touch fields the client actually sent" validation.
---

When a settings-update function distinguishes "field omitted" from "field explicitly cleared" via `Object.prototype.hasOwnProperty.call(payload, key)`, the caller must only include keys that were genuinely present in the incoming request.

A common bug: building the object passed into that function like `{ foo: hasFoo ? body.foo : undefined, bar: hasBar ? body.bar : undefined, ... }`. In JS, an object literal key set to `undefined` is still an *own property* — `hasOwnProperty` returns `true` for it. So every field ends up "present" from the callee's point of view, and any field not actually sent by the client gets treated as an explicit empty/undefined update, tripping "X is required" validation even though the caller only meant to update a different field.

**Why:** Found this while extending a WhatsApp bot's built-in-command settings API (many independently editable text+buttons fields sharing one PUT endpoint) — editing just one field always failed with a "must be a string"/"is required" error on an unrelated field.

**How to apply:** When forwarding a partial update, build the object by conditionally assigning keys (e.g. loop over allowed keys and only set `updatePayload[key] = payload[key]` when `hasOwnProperty` is true on the *source* body), never via a ternary-to-`undefined` inside an object literal for every possible key.
