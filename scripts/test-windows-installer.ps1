$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $IsWindows -or $env:GITHUB_ACTIONS -ne 'true') {
    throw 'Dieser Installationstest darf nur auf einem frischen Windows-GitHub-Actions-Runner laufen.'
}

$root = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $root 'dist'
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$setup = Join-Path $dist "Batto-MultiChat-Setup-$version-x64.exe"
$installDir = Join-Path $env:RUNNER_TEMP 'BATTO Install Test'
$exe = Join-Path $installDir 'Batto-MultiChat.exe'
$profileDir = Join-Path $env:APPDATA 'batto-multichat'
$settingsFile = Join-Path $profileDir 'settings.json'
$logFile = Join-Path $profileDir 'batto-startup.log'
$desktopLink = Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Batto Multi-Chat.lnk'
$menuLink = Join-Path ([Environment]::GetFolderPath('Programs')) 'Batto Multi-Chat.lnk'
$report = [System.Collections.Generic.List[string]]::new()
$report.Add("BATTO MULTI-CHAT $version - Windows-Installationstest")

function Assert-That([bool] $Condition, [string] $Message) {
    if (-not $Condition) { throw $Message }
}
function Wait-Until([scriptblock] $Condition, [string] $Message, [int] $Seconds = 30) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    do {
        if (& $Condition) { return }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    throw $Message
}
function Assert-Settings {
    $saved = Get-Content $settingsFile -Raw | ConvertFrom-Json
    Assert-That ($saved.installerTestMarker -eq 'existing-profile-preserved') 'Vorhandenes Profil wurde ersetzt.'
    Assert-That ($saved.autoBroadcast.messages[0] -eq 'Gespeicherte Vorlage') 'Auto-Broadcast-Vorlagen wurden ersetzt.'
    Assert-That ($saved.autoBroadcast.intervalMinutes -eq 17) 'Auto-Broadcast-Intervall wurde ersetzt.'
}
function Start-InstalledApp {
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $exe
    $info.WorkingDirectory = $env:WINDIR
    $info.UseShellExecute = $false
    # Only Windows system tools are on PATH; the application must bring its runtime.
    $info.Environment['PATH'] = "$env:WINDIR\System32;$env:WINDIR"
    [void] $info.Environment.Remove('ELECTRON_RUN_AS_NODE')
    return [System.Diagnostics.Process]::Start($info)
}

# Never overwrite an existing user profile or installation, even on a misconfigured runner.
foreach ($item in @($profileDir, $installDir, $desktopLink, $menuLink)) {
    Assert-That (-not (Test-Path $item)) "Test setzt einen frischen Runner voraus: $item existiert bereits."
}
New-Item $profileDir -ItemType Directory | Out-Null
@{
    installerTestMarker = 'existing-profile-preserved'
    autoBroadcast = @{ messages = @('Gespeicherte Vorlage'); intervalMinutes = 17; platforms = @('twitch') }
} | ConvertTo-Json -Depth 5 | Set-Content $settingsFile -Encoding utf8NoBOM

$appProcess = $null
$secondProcess = $null
try {
    # NSIS requires /D to be last, with the complete remaining path unquoted.
    $installerProcess = Start-Process -FilePath $setup -ArgumentList "/S /currentuser /D=$installDir" -PassThru
    Assert-That ($installerProcess.WaitForExit(90000)) 'Installation hat das Zeitlimit erreicht.'
    Assert-That ($installerProcess.ExitCode -eq 0) "Installation fehlgeschlagen: $($installerProcess.ExitCode)"
    Assert-That (Test-Path $exe) 'Installierte Anwendung fehlt.'
    Assert-That (Test-Path (Join-Path $installDir 'resources\app.asar')) 'Installiertes Anwendungspaket fehlt.'
    Assert-Settings
    $report.Add('OK: Installation im Benutzerkonto, Zielpfad mit Leerzeichen, bestehendes Profil erhalten.')

    $shortcutShell = New-Object -ComObject WScript.Shell
    foreach ($link in @($desktopLink, $menuLink)) {
        Assert-That (Test-Path $link) "Verknuepfung fehlt: $link"
        Assert-That ($shortcutShell.CreateShortcut($link).TargetPath -eq $exe) "Verknuepfung zeigt auf das falsche Programm: $link"
    }
    $report.Add('OK: Desktop- und Startmenue-Verknuepfung zeigen auf die installierte EXE.')

    $appProcess = Start-InstalledApp
    Wait-Until {
        $appProcess.Refresh()
        Assert-That (-not $appProcess.HasExited) 'Die installierte Anwendung wurde beim Start beendet.'
        if (-not (Test-Path $logFile)) { return $false }
        $log = Get-Content $logFile -Raw
        return $log.Contains('Runtime erfolgreich gestartet.') -and $log.Contains('Renderer vollständig gestartet.') -and $appProcess.MainWindowHandle -ne 0
    } 'Die installierte Anwendung hat den Start nicht abgeschlossen.'
    $log = Get-Content $logFile -Raw
    Assert-That ($log -notmatch 'uncaughtException:|unhandledRejection:|Startfehler:|Preload-Fehler|loadFile fehlgeschlagen|Lade Diagnose-Fallback') 'Startprotokoll enthaelt einen Laufzeitfehler.'
    $report.Add('OK: Installierte EXE startet aus fremdem Arbeitsverzeichnis ohne Node/npm auf PATH; Runtime und Renderer melden erfolgreichen Start.')

    $secondProcess = Start-InstalledApp
    Assert-That ($secondProcess.WaitForExit(15000)) 'Ein zweiter Start hat eine weitere App-Instanz offen gelassen.'
    $appProcess.Refresh()
    Assert-That (-not $appProcess.HasExited) 'Der zweite Start hat die erste Instanz beendet.'
    $log = Get-Content $logFile -Raw
    Assert-That (([regex]::Matches($log, 'Runtime erfolgreich gestartet\.')).Count -eq 1) 'Die Runtime wurde doppelt gestartet.'
    $report.Add('OK: Erneuter Start verwendet die bestehende App-Instanz.')

    Assert-That ($appProcess.CloseMainWindow()) 'Das Programmfenster konnte nicht geschlossen werden.'
    Assert-That ($appProcess.WaitForExit(15000)) 'Die App blieb nach dem Schliessen des Fensters aktiv.'
    Assert-That ($appProcess.ExitCode -eq 0) "Programmende mit Fehlercode $($appProcess.ExitCode)."
    Assert-Settings
    $report.Add('OK: Normales Schliessen beendet die Anwendung; gespeicherte Einstellungen bleiben erhalten.')

    $uninstallers = @(Get-ChildItem $installDir -Filter 'Uninstall*.exe')
    Assert-That ($uninstallers.Count -eq 1) 'Deinstallationsprogramm fehlt oder ist nicht eindeutig.'
    $uninstallerProcess = Start-Process -FilePath $uninstallers[0].FullName -ArgumentList '/S /currentuser' -PassThru
    Assert-That ($uninstallerProcess.WaitForExit(60000)) 'Deinstallation hat das Zeitlimit erreicht.'
    Assert-That ($uninstallerProcess.ExitCode -eq 0) "Deinstallation fehlgeschlagen: $($uninstallerProcess.ExitCode)"
    Wait-Until { -not (Test-Path $exe) -and -not (Test-Path $desktopLink) -and -not (Test-Path $menuLink) } 'Deinstallation hat Programm oder Verknuepfungen nicht entfernt.'
    Assert-Settings
    $report.Add('OK: Deinstallation entfernt Programm und Verknuepfungen, behaelt das persoenliche Profil.')
    $report.Add('Keine visuelle Pruefung und kein Versand an echte Live-Konten in diesem Test.')
    $report | Set-Content (Join-Path $dist 'WINDOWS-INSTALLATION-TEST.txt') -Encoding utf8NoBOM
    $report | ForEach-Object { Write-Host $_ }
} catch {
    if (Test-Path $logFile) { Get-Content $logFile | Write-Host }
    throw
} finally {
    foreach ($process in @($secondProcess, $appProcess)) {
        if ($null -ne $process -and -not $process.HasExited) { $process.Kill($true) }
    }
}
