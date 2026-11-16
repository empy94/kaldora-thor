'use strict';

// Parse only the developer's documented native-controller contract. Never write
// game settings and never invent defaults when the contract is unavailable.
function readNativeControllerSettings(serialized) {
  if (typeof serialized !== 'string' || serialized.length > 1024 * 1024)
    return { available: false, bindings: {} };
  let settings;
  try { settings = JSON.parse(serialized); } catch { return { available: false, bindings: {} }; }
  const bind = settings?.pad?.bind;
  if (!bind || typeof bind !== 'object' || Array.isArray(bind))
    return { available: false, bindings: {} };
  const bindings = {};
  const unsupported = [];
  const allowedKey = /^(?:[0-9]|1[0-6]|C4_[0-3]|C4_[5-7])$/;
  const allowedValue = /^(?:|k:[A-Za-z][A-Za-z0-9]{0,31}(?::[sa])?|m:[0-3]|s:[0-9]{1,10}|act|macro|buffs|interact|menu|lock)$/;
  for (const [key, value] of Object.entries(bind)) {
    if (allowedKey.test(key) && typeof value === 'string' && allowedValue.test(value)) bindings[key] = value;
    else unsupported.push(key);
  }
  return { available: true, bindings, unsupported };
}
module.exports = { readNativeControllerSettings };
