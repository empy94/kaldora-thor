# Live drops on the Thor companion

## Goal

Show the current monster's available drops on the lower screen. Selecting an
item should show its game icon, description and stats, its unmodified chance,
and the chance applicable to the current character. A compact HP/MP potion
bar can make room for the entry point without removing potion assignment.

## Data still needed

The current web client inspected on 2026-11-17 did not expose an identifiable
drop table, selected-monster identity, or drop-chance formula through the
existing Thor bridge. The client assets include an `itemdropinfo.txt` file,
but its contents alone do not establish monster associations or current
server probabilities. Other Archlord servers are not an authoritative source
for Kaldora. Do not infer percentages from asset names or apply an assumed
buff multiplier.

## Suggested game-side read-only contract

The exact transport can be decided with the game developer. An authenticated,
documented game API or page event should provide, for the currently selected
monster:

- A stable monster ID, localized name, and an explicit indication when no
  eligible monster is selected. A zone ID is useful if drops vary by location.
- The matching item IDs, localized names, icons, descriptions and actual
  item stats, with version or timestamp and any relevant eligibility rules.
- Separately identified base and effective probabilities, their units, and
  whether each is a per-kill or per-roll chance. Effective probabilities
  should be calculated by the server, including applicable equipment, buffs,
  level and other conditions; provide an explanation or bonus breakdown when
  available.
- Explicit unknown, unavailable or undisclosed values, distinct from zero.
  Signal target changes and stale data so that the companion never displays a
  previous monster's drops as if they belonged to the new target.

Only expose data the game developer intends players to see. The companion
should not request credentials, modify drops, or write the game's controller
settings to obtain this information. If rates are intentionally hidden, show
the item information that is actually available without inventing a percentage.

## Acceptance checks

Verify target changes, deselection, reconnect, different monsters and zones,
item details, buff/equipment changes, unknown rates and stale data. Compare
the displayed values with game-side authoritative results. Confirm existing
bindings, merchant navigation, potion assignment and both screens still work
on the physical Thor before releasing.
