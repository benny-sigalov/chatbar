Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distPath = Join-Path $repoRoot "dist"
$releasePath = Join-Path $repoRoot "release"
$packageJsonPath = Join-Path $repoRoot "package.json"

if (-not (Test-Path $packageJsonPath)) {
    throw "package.json not found."
}

Push-Location $repoRoot
try {
    yarn build

    if (-not (Test-Path $distPath)) {
        throw "dist folder was not created."
    }

    if (-not (Test-Path $releasePath)) {
        New-Item -ItemType Directory -Path $releasePath | Out-Null
    }

    $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    $version = $packageJson.version
    $zipPath = Join-Path $releasePath "chatbar-$version.zip"

    if (Test-Path $zipPath) {
        Remove-Item -LiteralPath $zipPath
    }

    Compress-Archive -Path (Join-Path $distPath "*") -DestinationPath $zipPath
    Write-Host "Created $zipPath"
}
finally {
    Pop-Location
}
