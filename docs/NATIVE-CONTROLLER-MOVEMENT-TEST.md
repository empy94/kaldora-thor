# Native controller movement test (AYN Thor)

Date: 2026-11-16. The game was open in Chrome on the physical console. The PC companion bridge was disconnected and no Android companion action was used for the first test. The player reported that the right stick controlled the camera but the left stick did not move the character; the lower companion displayed no game data.

The game currently maps the left-stick axes to KeyW/KeyA/KeyS/KeyD in `padFrame`, then `padKey` dispatches a synthetic `KeyboardEvent` on `window` without numeric `keyCode` or `which`. The game's existing touch joystick instead dispatches the movement event on `#canvas` with numeric `keyCode` and `which` (87, 65, 83, 68 respectively).

A temporary test listener rerouted only untrusted WASD events targeted at `window` to the game canvas, with those numeric values and bubbling enabled. The player reported that both sticks then worked. This is diagnostic evidence for the movement path, not a tested complete controller fix; it does not address buttons, bindings, bottom-screen state, reload, or longer play. The test listener lives only in the current Chrome page and is lost on reload. A permanent game-side fix should follow the touch joystick's movement event semantics and verify press, release, diagonals, focus changes and no stuck movement.

After removing the ADB forwarding used to install that diagnostic listener, the player again confirmed that both sticks worked. The physical cable was not confirmed removed. This demonstrates that the listener does not need an active bridge during the current page session; it does not make the fix persistent across reloads.

For the game developer, this is a candidate replacement for the movement portion of `padKey`, preserving the existing event target for other keys. It is based on the successful temporary test and still needs game-side testing:

```js
function padKey(id, code, modifier, down) {
  if (down === padDown.has(id)) return;
  if (down) padDown.set(id, { code, m: modifier });
  else padDown.delete(id);
  const movement = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68 };
  const numeric = movement[code];
  const target = numeric ? document.getElementById('canvas') : window;
  if (!target) return;
  target.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {
    code, key: padKeyName(code), keyCode: numeric || 0, which: numeric || 0,
    shiftKey: modifier === 's', altKey: modifier === 'a',
    bubbles: true, cancelable: true
  }));
}
```

The current Firefox companion runs its relay locally and the player confirmed play without USB. The extension still uses the compatibility adapter to read game state and handle touch actions. A game-supported interface could replace that adapter and let the game own controller input.
