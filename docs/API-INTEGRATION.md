# Native integration with Kaldora Thor

The current Firefox preview keeps the PC out of the game session. The extension reads game state and handles explicit commands in the browser. A local relay inside the APK passes these messages to and from the lower touchscreen. The player confirmed two-screen play with USB unplugged. A native integration would replace the browser extension with game-supported state and actions.

Keep the game's native controller responsible for physical input, and make the native bindings readable by the companion. Preserve the player's existing custom profile until they explicitly switch. The [controller comparison](CONTROLLER-COMPARISON.md) records the profile and desired assignment workflow. The [movement test](NATIVE-CONTROLLER-MOVEMENT-TEST.md) records the joystick issue to address before retiring the compatibility layer.

A documented API can expose player and UI state, skills and cooldowns, macro rows, map, chat, inventory, equipment and potion slots. Touch actions need explicit acknowledgments, including invalid or stale selections. Keep game-side validation authoritative. Version the interface and expire the session on disconnect or logout. Only transmit the state needed by the panel.

If the game runs in Chrome, [Custom Tabs messaging](https://developer.chrome.com/docs/android/post-message-twa) is one possible transport. The site supplies the verified association for the APK and a handler for the agreed messages. A supported API with equivalent capabilities is also suitable.

Validate both displays and the player's bindings on the Thor with USB unplugged. Test cold launch and reconnect, then try movement and camera immediately after a lower-screen touch. Verify that saved bindings remain after reopening and that a single press fires only one action.
