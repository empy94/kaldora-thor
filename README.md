# Kaldora Thor

An independent Android companion for playing Kaldora on the AYN Thor. The game runs in Chrome on the upper display. The lower display shows game data and sends player-triggered actions through the local USB test bridge.

![Animated preview of Kaldora gameplay and the lower-screen companion](docs/images/thor-demo.gif)

*Real recordings from both AYN Thor displays, shown in the supplied console frame. Controller highlights and stick movement are visualizations of recorded input. Chat messages are pixelated.*

[Watch the full one-minute demonstration](https://github.com/empy94/kaldora-thor/releases/download/v0.15/Kaldora-Thor-demonstration.mp4) · [View a still screenshot](docs/images/thor-live.png)

## Controller

The companion's saved skill and macro bindings take priority over the game's controller assignments. Start opens or closes the game menu. The D-pad, A and B navigate supported windows and dialogs. By default, L3 selects the next target and R3 performs the basic attack; both can instead be assigned to an action, skill or macro. Controls can be configured per button and restored individually or together. A single L1 action runs on release; an assigned L1 combination takes priority. Gameplay bindings do not override A, B and the D-pad while a game dialog is open. Reset all assigns R1 and R2 to macro rows 1 and 2. The Controls guide shows the companion’s current bindings, not the game’s native assignments. The lower panel can record bindings and L1 combinations.

The **Sets** panel shows the four sets stored by Kaldora. Tap a saved set to equip it, or open the game's editor to create and update sets. When an inventory item is highlighted with the D-pad, the lower screen shows its native item details, occupied and empty sockets, and, where available, the equipped-item comparison. Sets can include equipment and the skill bar. The lower-screen joystick bridge forwards movement and right-stick camera input when the companion has focus.

The Macros tab shows the live attack-macro status on every panel: ON with its active row, OFF, or — when the game link is unavailable. Attack rows toggle on and off; buff rows use the game’s native one-shot buffs action, including the hero-buff selection. The Map panel displays the map supplied by Kaldora. The launcher uses the game’s supported browser mode, so a separate installed web-app icon is not required. On the login screen, use Play fullscreen if the browser bars are visible.

When an inventory item is highlighted, the lower-screen item details offer Lock / Unlock using Kaldora’s native item lock. The same action can be assigned in Controls to a non-navigation button or supported L1 combination. The companion prevents moving a locked source or swapping onto a locked destination through its own controller and bag-move paths. The game’s lock also protects items from selling and destruction; native touchscreen movement is controlled by the game.

In Character, double-press A on equipped gear to use the game’s unequip action; holding A and moving still drags. In item details, tap an empty socket to choose an inventory stone whose explicit game-provided compatibility matches the equipment. The companion shows the game’s success chance and failure risk where available and asks for confirmation; the game may also ask for confirmation. Stones without explicit compatibility information are not listed.

The two potion slots remain visible above every panel. Tap a slot to choose a compatible potion currently in the character’s inventory; counts and item art come from the game. The selection uses the game’s own potion-slot handler and leaves the automatic HP/MP thresholds unchanged.

The Controls panel also exposes the game’s Effects setting (Off, Minimal or Full). On touch devices, the bridge restores the saved Effects and buff-effects choices after the game applies its mobile defaults. While a game window is open, use the D-pad to navigate, left/right to adjust a selection or slider, A to activate, and B to close.

The Controls panel places the controller and binding editor first; the complete button guide can be expanded below. Skills and macro slots use larger touch targets.

The APK uses English labels. The PC and USB debugging are required for live game data and actions, including restoration of graphics settings after a game reload.

## Build and run

The current release still requires a PC, USB debugging, Node.js 22 or newer and Android platform-tools. The connection key is generated on the Thor and exchanged automatically over authorized ADB; there is no connection setting to enter in the app. The key stays local and must never be shared.

Install the release APK on the Thor, connect it to the PC, authorize USB debugging, open Kaldora Thor, then run the bridge from the repository on the PC:

    .\tools\Start-UsbBridge.ps1

The script can also accept `-Adb PATH_TO_ADB.EXE -Serial THOR_SERIAL` if automatic detection cannot find the console. Keep the script running while playing. This is a temporary architecture; the developer's proposed API is not yet available.

To build, also install Android SDK platform 35, build-tools 34.0.0 and JDK 19. A shareable build contains no personal connection key:

    .\build.ps1 -Sdk 'ANDROID_SDK_PATH' -Jdk 'JDK_PATH' -PublicRelease

The shareable output is `build/Kaldora-Thor-Release.apk`. The signing key must remain private.

The companion source is licensed under the [MIT License](LICENSE). Kaldora game art, icons and other third-party assets belong to their respective owners and are not relicensed by this project. The potential official API is discussed in [API integration notes](docs/API-INTEGRATION.md).
