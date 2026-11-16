# Potential Kaldora API integration

Kaldora's developer has said that an API is planned. No specification, credentials, endpoints or availability have been provided, so the current USB bridge remains the implementation used by this project.

## Integration goals

- Preserve the existing live game and controller behavior while evaluating any official API against the existing companion features.
- Prefer documented, user-authorized interfaces for reading character state and sending explicit player actions. Confirm whether each capability is available before exposing it.
- Keep API connectivity behind a replaceable adapter and preserve a clearly identified fallback only where the developer agrees it is appropriate. Never silently invent data or simulate successful actions.
- Protect credentials: store per-installation secrets privately, exclude them from source, release artifacts, screenshots and logs, and define revocation and error behavior before deployment.
- Specify event ordering, action acknowledgments, stale/offline states, reconnect behavior, permissions, rate limits and compatibility/versioning after the developer supplies a contract.
- Test the official API against the physical Thor and real game, including both displays, existing bindings and saved data, before replacing the current path.

This document is a preparation checklist, not a claimed API contract or a commitment to any particular endpoint or protocol. The current companion and USB debugging link are still required.
