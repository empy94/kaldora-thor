# Kaldora Thor

An independent Android companion for playing Kaldora on the AYN Thor. The game runs in Chrome on the upper display. The lower display shows game data and sends player-triggered actions through the local USB test bridge.

![Kaldora gameplay and the Map panel captured on an AYN Thor](docs/images/thor-live.png)

*Both displays were captured on a physical AYN Thor running Kaldora Thor 0.7. The console frame comes from the supplied reference.*

## Controller

The companion's saved skill and macro bindings take priority over the game's controller assignments. Start opens or closes the game menu. The D-pad, A and B navigate supported windows and dialogs. By default, L3 selects the next target and R3 performs the basic attack; both can instead be assigned to a skill or macro. The Controls guide shows the companion’s current bindings, not the game’s native assignments. The lower panel can record bindings and L1 combinations.

The **Sets** panel shows the four sets stored by Kaldora. Tap a saved set to equip it, or open the game's editor to create and update sets. When an inventory item is highlighted with the D-pad, the lower screen shows its native item details, occupied and empty sockets, and, where available, the equipped-item comparison. Sets can include equipment and the skill bar. The lower-screen joystick bridge forwards movement and right-stick camera input when the companion has focus.

A buff row uses the game's native buffs action when available, including the game's hero-buff selection. The Map panel displays the map supplied by Kaldora. The game may require installation as a standalone web app before it allows entry.

The Controls panel also exposes the game’s Effects setting (Off, Minimal or Full). On touch devices, the bridge restores the saved Effects and buff-effects choices after the game applies its mobile defaults. While a game window is open, use the D-pad to navigate, left/right to adjust a selection or slider, A to activate, and B to close.

The APK uses English labels. The PC and USB debugging are required for live game data and actions, including restoration of graphics settings after a game reload.

## Build and run

Requirements: Windows, Node.js 22 or newer, Android SDK platform 35, build-tools 34.0.0, JDK 19 and ADB. Create a different local key on each private installation. Keep it out of Git and distribute locally built APKs only to the holder of that key.

    node -e "require('fs').writeFileSync('assets/usb-key.txt',require('crypto').randomBytes(32).toString('hex'),{flag:'wx'})"
    .\build.ps1 -Sdk 'ANDROID_SDK_PATH' -Jdk 'JDK_PATH'

Install the signed APK from build/Kaldora-Thor.apk, open it on the Thor and log in to Kaldora in Chrome. Run this command from the PC for the live lower display.

    .\tools\Start-UsbBridge.ps1 -Adb 'PATH_TO_ADB.EXE' -Serial 'THOR_SERIAL'

Kaldora game art and icons belong to their respective owners. This repository contains the companion source and presentation images.
