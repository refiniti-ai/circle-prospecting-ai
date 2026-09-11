# Copy the client buy-leads flow screenshot into public/ for /buy-leads only.
# Usage: .\scripts\copy-buy-leads-preview.ps1 -Source "C:\path\to\screenshot.png"
param(
  [Parameter(Mandatory = $true)]
  [string]$Source
)
$dest = Join-Path $PSScriptRoot "..\public\buy-leads-flow-preview.png"
Copy-Item -Path $Source -Destination $dest -Force
Write-Host "Copied to $dest"
