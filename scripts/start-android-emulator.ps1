param(
    [string]$SdkRoot = $env:ANDROID_HOME,
    [string]$JavaRoot = $env:JAVA_HOME,
    [string]$AvdRoot = $env:ANDROID_AVD_HOME,
    [string]$DeviceName = 'Traina_API_36',
    [int]$Port = 8083
)
$ErrorActionPreference = 'Stop'
if (-not $SdkRoot -or -not (Test-Path -LiteralPath "$SdkRoot\emulator\emulator.exe")) { throw 'Pass -SdkRoot with the installed Android SDK directory.' }
$env:ANDROID_HOME = $SdkRoot
if ($JavaRoot) { $env:JAVA_HOME = $JavaRoot }
if ($AvdRoot) { $env:ANDROID_AVD_HOME = $AvdRoot }
$env:PATH = "$SdkRoot\platform-tools;$SdkRoot\emulator;$env:PATH"
& "$SdkRoot\emulator\emulator.exe" -accel-check
if ($LASTEXITCODE -ne 0) { throw 'Enable Windows Hypervisor Platform and BIOS virtualization, restart if Windows requests it, then retry.' }
# The user explicitly requested a visible emulator window.
Start-Process -FilePath "$SdkRoot\emulator\emulator.exe" -ArgumentList @('-avd', $DeviceName, '-gpu', 'auto', '-no-snapshot', '-no-audio') -WindowStyle Normal
$trainaRepository = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $trainaRepository 'apps\mobile')
try { node ../../scripts/start-mobile-staging.cjs --android --port $Port } finally { Pop-Location }
