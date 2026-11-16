# Potential Kaldora API integration

Kaldora's developer has said that an API is planned. No specification, credentials, endpoints or availability have been provided, so the current USB bridge remains the implementation used by this project.

## Browser integration without USB

Keep the top display in Chrome so it can use the player's existing browser login. The bottom display runs in the Android app and needs live game data and acknowledgments for touch actions. Today the computer's bridge reads and controls the Chrome tab through the debugging connection. An ordinary Android app could open the local Chrome debugging socket on the test Thor, but Chrome reset the connection before responding. Packaging the existing bridge in the APK does not grant it access to the tab.

One supported replacement is a [Chrome Custom Tabs message channel](https://developer.chrome.com/docs/android/post-message-twa). Chrome verifies the APK's association with the website, then delivers structured messages between the app and the game page. This requires no PC bridge. The game's own code must listen for the channel, supply the state the lower screen needs, and handle explicit touch requests. The game remains responsible for gameplay, validation and native controller input. The developer can also use a documented official API if it covers the same capabilities.

For the Chrome channel, the Kaldora developer would publish a Digital Asset Links statement at `https://play.kaldora.eu/.well-known/assetlinks.json` for the agreed APK and host the game-side message handler. That URL returned HTTP 404 on 16 November 2026. Use `delegate_permission/common.use_as_origin` for the channel. Fullscreen Trusted Web Activity display, if requested, also needs `delegate_permission/common.handle_all_urls`. The APK's public signing certificate fingerprint can be supplied for the agreed test build. Send snapshots and specific actions over the channel, with versioned messages and explicit acknowledgments. Keep controller settings read-only in the companion and keep credentials out of the channel.

The [controller comparison](CONTROLLER-COMPARISON.md) records the player's bindings and the [native movement test](NATIVE-CONTROLLER-MOVEMENT-TEST.md) includes the candidate game-side correction. Fixing native movement allows the game to drive the controller. Replacing the Chrome bridge is the additional work needed for the lower display. Validate both together on the Thor after a cold launch and with the cable removed, including a touch on the lower display followed by movement and camera input.

## Integration goals

- Preserve the existing live game and controller behavior while evaluating any official API against the existing companion features.
- Prefer documented, user-authorized interfaces for reading character state and sending explicit player actions. Confirm whether each capability is available before exposing it.
- Keep API connectivity behind a replaceable adapter and preserve a clearly identified fallback only where the developer agrees it is appropriate. Never silently invent data or simulate successful actions.
- Protect credentials: store per-installation secrets privately, exclude them from source, release artifacts, screenshots and logs, and define revocation and error behavior before deployment.
- Specify event ordering, action acknowledgments, stale/offline states, reconnect behavior, permissions, rate limits and compatibility/versioning after the developer supplies a contract.
- Test the official API against the physical Thor and real game, including both displays, existing bindings and saved data, before replacing the current path.

This document is a preparation checklist, not a claimed API contract or a commitment to any particular endpoint or protocol. The current companion and USB debugging link are still required.
