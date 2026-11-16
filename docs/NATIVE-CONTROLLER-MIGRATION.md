# Native controller migration (experimental)

This branch is preparation for Kaldora's announced controller update. It is not a replacement for the released companion and does not switch the active input path. Release v0.21 and the existing APK remain the rollback baseline.

## Developer's proposed contract

Kaldora will own gamepad input, combos, navigation, movement and bindings. The bridge should stop wrapping `navigator.getGameads`, polling buttons, forwarding keys or motion, and should not send `nativePad`, `nav`, `combo`, `pad`, `move`, `bind` or `itemLock` actions. Controller mappings are to be read only from `archlord.settings` → `pad.bind`. Unknown, absent or malformed mappings must remain unavailable, never replaced silently with companion defaults. `native-controller-contract.cjs` and its tests implement a standalone parser for the stated mapping format; it is not yet wired into the running app.

The stable game API mentioned by the developer is planned, not supplied. Existing display data and explicitly player-triggered touch actions need separate verification against the updated game; do not infer an API contract or claim the lower screen is compatible from the controller contract alone.

## Migration blockers and regression risks

- On 2026-11-16 the public game page still included `pad.map`, the old binding model. The developer described the change as upcoming. A textual check of a page is only a clue, not a version guarantee.
- `Companion.java` currently consumes Android gamepad key and joystick events when its second-screen activity has focus. Removing bridge forwarding alone can leave Chrome without those events after the lower screen is touched. Confirm Android focus and the developer's native implementation on the physical AYN Thor, including return to gamepad after touch; do not assume the browser can see input handled by a separate activity.
- The lower-screen interface sends bridge navigation, binding and lock actions, and automatically restores old bindings. These controls need an intentional read-only or native-game replacement, not just deletion of bridge handlers. The developer requires native bindings never be written by the companion.
- The selected-item details, socket selection, map and other panel actions depend on existing page internals and the old injected state. Determine a supported native selected-item signal and preserve the existing confirmation and safety checks. Until verified, show unavailable instead of stale or guessed values.
- The old `pad.map` and even `pad` variable cannot be used for the new controller model. The contract parser deliberately does not inspect them. The game may also change other undocumented page internals during the update.
- The controller may already have saved user settings. Do not overwrite them, clear app data, or change the installed package for an untested build.

## Required validation before replacing the released version

1. Verify the updated game is deployed and inspect actual native bindings without writing them; show unsupported mapping values as unknown.
2. Preserve the installed APK, signing identity, user data, settings and an accessible rollback release. Use an isolated development build and test user where possible.
3. On the physical AYN Thor test sticks, held movement, camera, target, attack, skills, macro and buff bindings, L1 combinations, Start, A/B and D-pad navigation, nested dialogs, inventory dragging and lock. Repeat after tapping the lower screen, switching displays and reconnecting.
4. Test game-owned rebinding and persistence, including conflicts and existing saved user settings. Check that each physical input triggers at most one action.
5. Verify chat, map, item details and comparison, sockets with confirmation, potions, sets, macro rows, skill descriptions and touch actions. Do not consume resources or change equipment when testing without explicit consent.
6. Verify failure, focus loss, game reconnect and API absence; compare both displays against v0.21 and record unverified features. Publish or install as the default only after these checks pass.
