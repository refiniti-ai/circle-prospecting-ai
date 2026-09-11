# Copy six how-it-works step icons into public/marketing/how-it-works/
# Usage (single folder with client files):
#   .\scripts\copy-how-it-works-steps.ps1 -SourceDir "C:\path\to\folder"
#
# Or pass each file explicitly:
#   .\scripts\copy-how-it-works-steps.ps1 -Step1 "..." -Step2 "..." ...

param(
  [string]$SourceDir,
  [string]$Step1,
  [string]$Step2,
  [string]$Step3,
  [string]$Step4,
  [string]$Step5,
  [string]$Step6
)

$destDir = Join-Path $PSScriptRoot "..\public\marketing\how-it-works"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$targets = @{
  "step-1-listing-live.png" = $Step1
  "step-2-target-area.png"  = $Step2
  "step-3-audience.png"     = $Step3
  "step-4-promote.png"      = $Step4
  "step-5-respond.png"      = $Step5
  "step-6-opportunities.png" = $Step6
}

if ($SourceDir) {
  $patterns = @{
    "step-1-listing-live.png" = @("*Listing*Live*", "*listing*live*")
    "step-2-target-area.png"  = @("*Target*Area*", "*target*area*")
    "step-3-audience.png"     = @("*Build*Audience*", "*audience*")
    "step-4-promote.png"      = @("*Promote*You*", "*promote*")
    "step-5-respond.png"      = @("*Homeowners*Respond*", "*respond*")
    "step-6-opportunities.png" = @("*Receive*Opportunities*", "*opportunities*")
  }
  foreach ($entry in $patterns.GetEnumerator()) {
    if ($targets[$entry.Key]) { continue }
    foreach ($pat in $entry.Value) {
      $hit = Get-ChildItem -Path $SourceDir -File -Include "*.png","*.webp","*.jpg" -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like $pat } |
        Select-Object -First 1
      if ($hit) {
        $targets[$entry.Key] = $hit.FullName
        break
      }
    }
  }
}

$copied = 0
foreach ($entry in $targets.GetEnumerator()) {
  $src = $entry.Value
  if (-not $src -or -not (Test-Path $src)) {
    Write-Warning "Missing source for $($entry.Key)"
    continue
  }
  $out = Join-Path $destDir $entry.Key
  Copy-Item -Path $src -Destination $out -Force
  Write-Host "Copied $($entry.Key)"
  $copied++
}

if ($copied -lt 6) {
  Write-Host ""
  Write-Host "Expected 6 files in $destDir"
  Write-Host "Drop client PNGs in SourceDir or pass -Step1 ... -Step6 paths."
  exit 1
}

Write-Host "All 6 step images ready in $destDir"
