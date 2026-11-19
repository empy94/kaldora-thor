# Kaldora Thor

An Android launcher for Kaldora, with a dual-screen companion on the AYN Thor. On the Thor, Firefox runs the game on the top screen and the companion shows skills, macros, map, chat, controls, and equipment on the bottom screen. The player confirmed that both screens continued to work after disconnecting USB.

![Gameplay on the AYN Thor](docs/images/thor-demo.gif)

*The video shows an earlier build of the two-screen interface.*

## Setup

### Android phones, tablets, and Android TV / Google TV

Install the APK from the [latest release](https://github.com/empy94/kaldora-thor/releases/latest) and pair your controller in Android settings. Open **Kaldora Thor** to launch the official game in your existing browser. Press a controller button while the game is visible, then use **Settings → Controller** in Kaldora to check or change the layout.

Kaldora reads the controller through the browser's Gamepad API. Xbox, DualShock 4, and generic controllers can use this mode when Android and the browser recognize them correctly. On Android TV, use an installed browser that supports the game and exposes the controller. This mode uses no extension and has no companion screen.

### AYN Thor

Download the APK and Mozilla-signed Firefox extension from the [latest release](https://github.com/empy94/kaldora-thor/releases/latest). Install both once: the extension remains installed when Firefox or the console restarts. **Firefox for Android 142 or later** is required. The [installation guide in English and French](docs/INSTALL.md) explains each step.

Open **Kaldora Thor** to start both displays. If Firefox is missing, the launcher offers a direct link to install it. Firefox and the extension require separate confirmation. Sign in to Kaldora in Firefox if prompted. The first eligible interaction enters fullscreen. Launch from the APK again if the game page is reloaded. Use one Kaldora tab for the companion.

The APK keeps its own saved controller bindings, last panel, skill category, selected macro row, and selected effects setting. The game saves its settings and actual macro contents according to its own rules in Firefox. Updating the application over the same Android package preserves its data.

On the Thor, **Macros** shows eight rows across two pages. Each row has twenty skill slots, a **Repeat**, **Once**, or **Buffs** mode, and its own controller binding. The game owns the slots and modes. **Once** can run while **Repeat** is active.

The Chat tab counts new player messages across game channels while another panel is open. Opening Chat clears the badge. System messages and outgoing whispers do not add to it.

## Build

Requires Node.js 22, Android SDK 35, build-tools 34.0.0, and JDK 19 or newer.

    node tools/build-firefox-extension.cjs
    .\build.ps1 -Sdk 'ANDROID_SDK_PATH' -Jdk 'JDK_PATH' -PublicRelease

The extension files are in `build/firefox-extension`. The APK is `build/Kaldora-Thor-Release.apk`. The Android package is `eu.kaldorathor.firefoxexp`.

The launcher checks this repository's latest stable release. For each APK update, increment both APK versions, keep the release asset name `Kaldora-Thor-Release.apk`, sign it with the existing release key, and publish a matching tag such as `v0.2.6-firefox-0.5.17`. The APK version in the tag must match the manifest. Always include the compatible signed XPI for AYN Thor users.

## Game developer

- [Controller comparison](docs/CONTROLLER-COMPARISON.md) describes the player's layout and requested binding workflow.
- [Native movement test](docs/NATIVE-CONTROLLER-MOVEMENT-TEST.md) includes the confirmed diagnosis and a candidate game-side fix.
- [Native integration](docs/API-INTEGRATION.md) describes what the game can expose so the APK can work without the Firefox extension.

The app source is under the [MIT License](LICENSE). Kaldora artwork and other third-party assets belong to their respective owners.
