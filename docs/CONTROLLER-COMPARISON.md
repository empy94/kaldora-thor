# Controller comparison and proposal for Kaldora

This is a player example and a proposal, not a requirement to replace everyone's preferred controls. It describes the AYN Thor companion's custom profile and the game state observed on 16 November 2026. Values can change as the player rebinds actions.

## Player's actual example

| Input | Saved companion action | Reason |
| --- | --- | --- |
| Left stick | Move | Continuous movement without a mouse. |
| Right stick | Camera | Keep camera control independent from movement. |
| L1 | Next target | Quickly cycle to a monster. |
| L2 | Basic attack | Start a normal attack on the selected target. |
| R1 | Macro row 2 | Trigger the player's buff row. |
| R2 | Macro row 1 | Toggle the player's attack macro. |
| X | A saved skill | The previous save used a temporary skill instance ID; that ID changed after reconnecting, so its identity cannot safely be recovered and the player must rebind it. |

The game currently marks row 1 as the attack row and row 2 as the buff row. These are the player's observed rows, not universal defaults. Its new native chain links two adjacent eligible rows, not twenty slots inside a single row. In this profile, row 1 cannot link to row 2 while row 2 is reserved for buffs; a player must choose a different arrangement explicitly. A buff or item row must not be silently repurposed.

## Suggested AYN Thor default preset

For new AYN Thor controller profiles, offer the above layout as a Thor preset: L1 = next target, L2 = basic attack, R1 = row 2, R2 = row 1, left stick = move, right stick = camera, and keep X available for a player-selected skill. Start opens the menu; directional buttons navigate a focused game window, A confirms or holds to drag, and B goes back. The player should be able to change every binding and restore the preset. Do not replace existing players’ saved profiles when introducing it.

## Binding experience requested by the player

1. In Skills or Macros, select the skill or row and start recording.
2. Press a controller button, or hold L1 plus one other supported button, then release.
3. Display the detected input and its current assignment. If it is already used, explain the conflict and offer cancel or an explicit replace action. Never silently overwrite another action.
4. Confirm and persist the assignment. Show it next to the skill, macro or action on reopening.
5. Make actions, skills and macro rows part of one conflict check, so one input cannot unexpectedly trigger two systems. Provide individual reset and reset-all operations.
6. Use the stable skill template ID (`tid`) for new skill bindings, rather than the runtime skill instance ID (`id`). The latter was observed to change after reconnecting; an old instance-only binding with an unknown identity should be shown as needing a rebind, not mapped to a guessed skill.

## Native game and companion differences observed

The game's saved native profile observed during this test had A = act, B = macro, X = buffs, Y = Tab, L1 = Digit3, R1 = Digit4, L2 = Digit5, R2 = Digit6, L3 = Tab and R3 = Space. These are the settings observed in the player's game, not a claim about universal defaults. The companion's saved profile above is different. A migration must preserve both profiles and must not silently overwrite the game's settings.

In the native-controller preview, the browser received the physical left stick and had focus, but the player could not move. During a three-second test the game's native controller emitted `KeyW` events at `window` with `keyCode` and `which` both zero; the original companion's working movement path emits keyboard events on the game canvas with numeric codes. The player reported that a narrowly scoped temporary compatibility translation restored movement. Please investigate and fix this at the game source so the companion can remove its workaround. Do not assume this is the sole cause of every movement issue.

A separate experimental Android window-focus approach produced an ANR for `eu.kaldorathor/.Companion`, reason: input dispatch timed out because the application had no focused window. That approach was removed from the custom build. Both screens need physical-device testing, including moving the left stick immediately after touching the lower screen and typing in chat.

The user prefers the companion's input ownership and binding workflow while the native system matures. The custom compatibility build intentionally retains the original companion bindings and intercepts their assigned buttons while allowing unassigned buttons to reach the updated native system. That is a temporary compatibility approach, not the requested eventual native-only architecture. Once the game provides equivalent controls and a stable interface, the bridge should relinquish input ownership, avoid duplicate actions, and display the game's own bindings. No official panel API has been delivered yet.

## Validation checklist

- Test held movement, camera, and release/stop on the physical Thor before and after lower-screen touch; no stuck movement or ANR.
- Test A/B, Start, D-pad, nested dialogs, item double-press, hold-A drag and drop, item lock, and focus restoration.
- Test a saved single-button skill, a macro, an L1 combination, collision replacement and persistence after reconnect and reinstall.
- Test an attack row with and without a linked eligible row, plus the one-shot action. Confirm that buff and item rows are protected and no real resource is consumed during automated checks.
- Compare existing game and companion profiles before migrating; do not change either without clear player confirmation. Preserve the stable 0.21 APK, its data-preserving recovery build, and the matching bridge for rollback, while noting that the newly updated game may behave differently with the old bridge.
- Validate the eventual official API contract and supported selected-item, chat, map, inventory, skill and macro actions before replacing currently working features.
