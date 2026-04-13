# Soulkiller installer for Windows
# Usage: irm https://raw.githubusercontent.com/Xeonice/soul-killer/main/scripts/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Repo = "Xeonice/soul-killer"
$InstallDir = "$env:LOCALAPPDATA\soulkiller"
$Binary = "$InstallDir\soulkiller.exe"

Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗"
Write-Host "  ║   SOULKILLER INSTALLER               ║"
Write-Host "  ╚══════════════════════════════════════╝"
Write-Host ""

# Download
$Asset = "soulkiller-windows-x64.zip"
# Primary: Cloudflare CDN (global edge, reliable in all regions)
$DownloadUrl = "https://soulkiller-download.ad546971975.workers.dev/download/windows-x64"
# Fallback: GitHub Releases
$FallbackUrl = "https://github.com/$Repo/releases/latest/download/$Asset"
$TmpZip = "$env:TEMP\soulkiller-install.zip"

Write-Host "  Downloading soulkiller for windows-x64..."

if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TmpZip -UseBasicParsing
} catch {
    Write-Host "  CDN unavailable, falling back to GitHub..."
    Invoke-WebRequest -Uri $FallbackUrl -OutFile $TmpZip -UseBasicParsing
}

# Extract
Expand-Archive -Path $TmpZip -DestinationPath $InstallDir -Force
Remove-Item $TmpZip -Force

# Rename if needed (archive contains soulkiller-windows-x64.exe)
$ExtractedExe = Join-Path $InstallDir "soulkiller-windows-x64.exe"
if (Test-Path $ExtractedExe) {
    Move-Item -Path $ExtractedExe -Destination $Binary -Force
}

# Configure PATH
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($CurrentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$InstallDir;$CurrentPath", "User")
    $PathConfigured = $true
}

# Version
try {
    $Version = & $Binary --version 2>$null
} catch {
    $Version = "soulkiller"
}

Write-Host ""
Write-Host "  ✓ Installed: $Version"
Write-Host "  ✓ Location:  $Binary"
Write-Host ""

if ($PathConfigured) {
    Write-Host "  PATH updated in user environment."
    Write-Host ""
    Write-Host "  To use in this terminal:"
    Write-Host ""
    Write-Host "    `$env:Path = `"$InstallDir;`$env:Path`""
    Write-Host ""
    Write-Host "  Or open a new terminal window."
} else {
    Write-Host "  Run:"
    Write-Host ""
    Write-Host "    soulkiller"
}

Write-Host ""
