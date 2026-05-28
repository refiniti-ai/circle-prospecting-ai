# Copy brokerage logos from Cursor chat assets into public/logos/brokerages/
# Run from repo root:  powershell -ExecutionPolicy Bypass -File scripts/copy-brokerage-logos.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$src = Join-Path $env:USERPROFILE ".cursor\projects\c-Users-pudum-OneDrive-Desktop-Cursor-Projects-USA-Projects-Circle-Prospecting-AI\assets"
$dest = Join-Path $repoRoot "public\logos\brokerages"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

# Prefer stable 8.3 short names (long Cursor asset paths exceed Windows limits)
$shortMap = @{
  "remax.png"                = "C_BCD7~1.PNG"
  "coldwell-banker.png"      = "C_E01D~1.PNG"
  "homeservices-america.png" = "C_2CAA~1.PNG"
  "berkshire-hathaway.png"   = "C_F360~1.PNG"
  "exp-realty.png"           = "C_64F7~1.PNG"
  "anywhere.png"             = "C_57F9~1.PNG"
  "weichert.png"             = "C_B601~1.PNG"
  "sothebys.png"             = "C_7F19~1.PNG"
}

$fso = New-Object -ComObject Scripting.FileSystemObject
$folder = $fso.GetFolder((Resolve-Path $src).Path)

foreach ($kv in $shortMap.GetEnumerator()) {
  $out = Join-Path $dest $kv.Key
  try {
    $file = $folder.Files.Item($kv.Value)
  } catch {
    Write-Warning "Missing: $($kv.Key) ($($kv.Value))"
    continue
  }
  $shortSrc = $file.ShortPath
  if (-not $shortSrc) {
    Write-Warning "No short path for $($kv.Key)"
    continue
  }
  Copy-Item -LiteralPath $shortSrc -Destination $out -Force
  Write-Host "OK $($kv.Key) ($((Get-Item -LiteralPath $out).Length) bytes)"
}

Write-Host "`nFiles in $dest :"
Get-ChildItem $dest -File | Format-Table Name, Length
