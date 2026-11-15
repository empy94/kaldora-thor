# Kaldora Thor

An independent Android companion for playing Kaldora on the AYN Thor. The game runs in Chrome on the upper display. The lower display shows game data and sends player-triggered actions through the local USB test bridge.

![Kaldora gameplay and the Map panel captured on an AYN Thor](docs/images/thor-live.png)

*Both displays were captured on a physical AYN Thor running Kaldora Thor 0.7. The console frame comes from the supplied reference.*

## Controller

When Kaldora exposes its native controller settings, gameplay buttons use the assignments configured in **Settings → Controller**. The companion displays those assignments and keeps its own previous profiles locally for older game versions. Its menu navigation remains available while a game window is open. Skills and macro rows on the second screen remain touch-accessible.

A buff row uses the game's native buffs action when available, including the game's hero-buff selection. The Map panel displays the map supplied by Kaldora. The game may require installation as a standalone web app before it allows entry. Compatibility of that standalone app with the USB bridge must be verified on the device.

The APK uses English labels. The PC and USB debugging are required for live game data and actions.

## Build and run

Requirements: Windows, Node.js 22 or newer, Android SDK platform 35, build-tools 34.0.0, JDK 19 and ADB. Create a different local key on each private installation. Keep it out of Git and distribute locally built APKs only to the holder of that key.

    node -e "require('fs').writeFileSync('assets/usb-key.txt',require('crypto').randomBytes(32).toString('hex'),{flag:'wx'})"
    .\build.ps1 -Sdk 'ANDROID_SDK_PATH' -Jdk 'JDK_PATH'

Install the signed APK from build/Kaldora-Thor.apk, open it on the Thor and log in to Kaldora in Chrome. Run this command from the PC for the live lower display.

    .\tools\Start-UsbBridge.ps1 -Adb 'PATH_TO_ADB.EXE' -Serial 'THOR_SERIAL'

Kaldora game art and icons belong to their respective owners. This repository contains the companion source and presentation images.
