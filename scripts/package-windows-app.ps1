param(
    [Parameter(Mandatory = $true)]
    [string]$JdkHome
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    throw "ERROR: $Message"
}

if ($env:OS -ne "Windows_NT") {
    Fail "The Windows app-image can only be built on Windows"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

$Release = Join-Path $RepoRoot "Dist\release"
$ReleaseRuntime = Join-Path $Release "Runtime"
$ReleaseWorkspace = Join-Path $Release "Workspace"
$ReleaseApp = Join-Path $Release "INGenious-Windows"

$InputDir = Join-Path $RepoRoot "Dist\target\jpackage\windows-input"
$OutputDir = Join-Path $RepoRoot "Dist\target\jpackage\windows-output"
$GeneratedApp = Join-Path $OutputDir "INGenious"

$AppDir = Join-Path $GeneratedApp "app"
$ConfigFile = Join-Path $AppDir "INGenious.cfg"
$Launcher = Join-Path $GeneratedApp "INGenious.exe"
$JvmLibrary = Join-Path $GeneratedApp "runtime\bin\server\jvm.dll"
$Jpackage = Join-Path $JdkHome "bin\jpackage.exe"

Write-Host ""
Write-Host "========================================"
Write-Host " INGenious Windows app-image packaging"
Write-Host "========================================"
Write-Host "Repository: $RepoRoot"
Write-Host ""

if (-not (Test-Path -LiteralPath $ReleaseRuntime -PathType Container)) {
    Fail "Release Runtime does not exist: $ReleaseRuntime"
}

if (-not (Test-Path -LiteralPath $ReleaseWorkspace -PathType Container)) {
    Fail "Release Workspace does not exist: $ReleaseWorkspace"
}

$GuiJar = Join-Path $ReleaseRuntime "ingenious-ide-3.0.0.jar"

if (-not (Test-Path -LiteralPath $GuiJar -PathType Leaf)) {
    Fail "Release Runtime is missing ingenious-ide-3.0.0.jar"
}

if (-not (Test-Path -LiteralPath $Jpackage -PathType Leaf)) {
    Fail "jpackage.exe is missing: $Jpackage"
}

$JpackageVersion = (& $Jpackage --version 2>&1 | Out-String).Trim()

if (-not $JpackageVersion.StartsWith("17")) {
    Fail "Expected jpackage 17, but detected: $JpackageVersion"
}

Write-Host "Using jpackage $JpackageVersion from:"
Write-Host "  $Jpackage"
Write-Host ""

Write-Host "[1/5] Recreating jpackage input"

if (Test-Path -LiteralPath $InputDir) {
    Remove-Item -LiteralPath $InputDir -Recurse -Force
}

New-Item -ItemType Directory -Path $InputDir -Force | Out-Null

Get-ChildItem -LiteralPath $ReleaseRuntime -Force |
    Copy-Item -Destination $InputDir -Recurse -Force

Write-Host ""
Write-Host "[2/5] Validating staged Runtime"

$RequiredInputItems = @(
    (Join-Path $InputDir "lib"),
    (Join-Path $InputDir "Engine"),
    (Join-Path $InputDir "plugins"),
    (Join-Path $InputDir "Tools"),
    (Join-Path $InputDir "web"),
    (Join-Path $InputDir "ingenious-ide-3.0.0.jar")
)

foreach ($Item in $RequiredInputItems) {
    if (-not (Test-Path -LiteralPath $Item)) {
        Fail "Required staged resource is missing: $Item"
    }

    Write-Host "OK: $Item"
}

$EngineJars = @(
    Get-ChildItem -LiteralPath $InputDir -Recurse -File |
        Where-Object { $_.Name -eq "ingenious-engine-3.0.0.jar" }
)

if ($EngineJars.Count -ne 1) {
    Fail "Expected one staged Engine JAR; found $($EngineJars.Count)"
}

$ExpectedEngineJar = Join-Path $InputDir "lib\ingenious-engine-3.0.0.jar"

if ($EngineJars[0].FullName -ne $ExpectedEngineJar) {
    Fail "Engine JAR is not in the required input\lib directory"
}

$ExcludedItems = @(
    (Join-Path $InputDir "Workspace"),
    (Join-Path $InputDir "Projects"),
    (Join-Path $InputDir "Shared"),
    (Join-Path $InputDir "Configuration"),
    (Join-Path $InputDir "ingenious"),
    (Join-Path $InputDir "ingenious.bat"),
    (Join-Path $InputDir "ingenious.command"),
    (Join-Path $InputDir "Readme.md")
)

foreach ($Item in $ExcludedItems) {
    if (Test-Path -LiteralPath $Item) {
        Fail "Non-Runtime content is inside the app input: $Item"
    }
}

Write-Host "OK: Workspace and traditional launchers are excluded"

Write-Host ""
Write-Host "[3/5] Recreating the Windows app-image"

if (Test-Path -LiteralPath $OutputDir) {
    Remove-Item -LiteralPath $OutputDir -Recurse -Force
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$JpackageArguments = @(
    "--type", "app-image",
    "--name", "INGenious",
    "--app-version", "3.0.0",
    "--vendor", "ING",
    "--description", "INGenious Playwright Studio",
    "--input", $InputDir,
    "--dest", $OutputDir,
    "--main-jar", "ingenious-ide-3.0.0.jar",
    "--main-class", "com.ing.ide.main.Main",
    "--java-options", '-Dingenious.app.home=$APPDIR',
    "--java-options", '-Dingenious.workspace=$APPDIR/../../Workspace',
    "--java-options", "-Xms128m",
    "--java-options", "-Xmx1024m",
    "--java-options", "-Dfile.encoding=UTF-8",
    "--java-options", "-Djdk.httpclient.allowRestrictedHeaders=host,connection,content-length,upgrade,expect,via,date,accept-encoding",
    "--verbose"
)

& $Jpackage @JpackageArguments

if ($LASTEXITCODE -ne 0) {
    Fail "jpackage exited with code $LASTEXITCODE"
}

if (-not (Test-Path -LiteralPath $GeneratedApp -PathType Container)) {
    Fail "jpackage did not create $GeneratedApp"
}

Write-Host ""
Write-Host "[4/5] Validating the generated application"

$RequiredPackagedItems = @(
    $Launcher,
    $JvmLibrary,
    $ConfigFile,
    (Join-Path $AppDir "lib"),
    (Join-Path $AppDir "Engine"),
    (Join-Path $AppDir "plugins"),
    (Join-Path $AppDir "Tools"),
    (Join-Path $AppDir "web"),
    (Join-Path $AppDir "ingenious-ide-3.0.0.jar")
)

foreach ($Item in $RequiredPackagedItems) {
    if (-not (Test-Path -LiteralPath $Item)) {
        Fail "Required packaged resource is missing: $Item"
    }
}

$PackagedEngineJars = @(
    Get-ChildItem -LiteralPath $AppDir -Recurse -File |
        Where-Object { $_.Name -eq "ingenious-engine-3.0.0.jar" }
)

if ($PackagedEngineJars.Count -ne 1) {
    Fail "Expected one packaged Engine JAR; found $($PackagedEngineJars.Count)"
}

$ExpectedPackagedEngineJar = Join-Path $AppDir "lib\ingenious-engine-3.0.0.jar"

if ($PackagedEngineJars[0].FullName -ne $ExpectedPackagedEngineJar) {
    Fail "Packaged Engine JAR is not in app\lib"
}

$ConfigText = Get-Content -LiteralPath $ConfigFile -Raw

if (-not $ConfigText.Contains('java-options=-Dingenious.app.home=$APPDIR')) {
    Fail "ingenious.app.home is missing from INGenious.cfg"
}

if (-not $ConfigText.Contains('java-options=-Dingenious.workspace=$APPDIR/../../Workspace')) {
    Fail "Sibling ingenious.workspace is missing from INGenious.cfg"
}

if (-not $ConfigText.Contains("app.mainclass=com.ing.ide.main.Main")) {
    Fail "GUI main class is missing from INGenious.cfg"
}

if (-not $ConfigText.Contains('app.classpath=$APPDIR\ingenious-ide-3.0.0.jar')) {
    Fail "GUI main JAR is missing from INGenious.cfg"
}

if (Test-Path -LiteralPath (Join-Path $AppDir "Workspace")) {
    Fail "Workspace must remain outside the Windows app-image"
}

if (Test-Path -LiteralPath $ReleaseApp) {
    Remove-Item -LiteralPath $ReleaseApp -Recurse -Force
}

Copy-Item -LiteralPath $GeneratedApp -Destination $ReleaseApp -Recurse -Force

if (-not (Test-Path -LiteralPath $ReleaseApp -PathType Container)) {
    Fail "Windows app-image was not copied into the release"
}

if (-not (Test-Path -LiteralPath (Join-Path $ReleaseApp "INGenious.exe") -PathType Leaf)) {
    Fail "Release Windows application is missing INGenious.exe"
}

Write-Host "OK: INGenious-Windows added to the existing release"

Write-Host ""
Write-Host "[5/5] Windows app-image completed successfully"
Write-Host ""
Write-Host "Application:"
Write-Host "  $ReleaseApp"
Write-Host ""
Write-Host "Application Workspace:"
Write-Host "  $ReleaseWorkspace"
Write-Host ""
