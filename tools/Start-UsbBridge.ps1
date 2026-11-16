param([string]$Adb,[string]$Serial)
$ErrorActionPreference='Stop'
if (!$Adb) {
  $found = Get-Command adb -ErrorAction SilentlyContinue
  $running = Get-Process adb -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path
  if ($found) { $Adb = $found.Source }
  elseif ($running -and (Test-Path -LiteralPath $running)) { $Adb = $running }
  elseif ($env:ANDROID_HOME -and (Test-Path (Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'))) { $Adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe' }
  elseif (Test-Path (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')) { $Adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe' }
  else { throw 'ADB not found. Install Android platform-tools or specify -Adb.' }
}
if (!$Serial) {
  $devices = & $Adb devices -l
  $matching = @($devices | Where-Object { $_ -match '^\S+\s+device\s+.*model:AYN_Thor' })
  if ($matching.Count -ne 1) { throw 'Connect one authorized AYN Thor or specify -Serial.' }
  $Serial = ($matching[0] -split '\s+')[0]
}
$keyPath = Join-Path $PSScriptRoot '..\assets\usb-key.txt'
# The token is read only through the authorized ADB shell; never print it.
$reply = & $Adb -s $Serial shell content call --uri content://eu.kaldorathor.connection --method key 2>$null
if ($LASTEXITCODE -ne 0 -or "$reply" -notmatch 'key=([0-9a-fA-F]{64})') {
  throw 'Cannot connect to Kaldora Thor. Install version 0.15 or newer and authorize USB debugging on the console.'
}
[IO.File]::WriteAllText($keyPath, $Matches[1].ToLowerInvariant())
& $Adb -s $Serial forward tcp:49225 localabstract:chrome_devtools_remote
if($LASTEXITCODE){throw 'Connexion Chrome indisponible'}
try {
  & $Adb -s $Serial reverse tcp:49226 tcp:49226
  if($LASTEXITCODE){throw 'Liaison USB indisponible'}
  try { node "$PSScriptRoot\usb-bridge.cjs" }
  finally { & $Adb -s $Serial reverse --remove tcp:49226 }
} finally {
  & $Adb -s $Serial forward --remove tcp:49225
}
