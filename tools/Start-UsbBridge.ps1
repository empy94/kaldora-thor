param([Parameter(Mandatory=$true)][string]$Adb,[Parameter(Mandatory=$true)][string]$Serial)
$ErrorActionPreference='Stop'
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
