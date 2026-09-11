# Copy client how-it-works infographic PNG into public/
param(
  [Parameter(Mandatory = $true)]
  [string]$Source
)
$dest = Join-Path $PSScriptRoot "..\public\how-it-works-flow.png"
Copy-Item -Path $Source -Destination $dest -Force
Write-Host "Copied to $dest"
