# Mirrors the live Cloud Run configuration into AWS.
#
# Sensitive values go to AWS Secrets Manager; everything else is written to
# apprunner-env.generated.json for use as plain App Runner environment
# variables.
#
# Values are never printed. The script only reports variable names and where
# each one was sent.
#
# Usage:  pwsh infra/aws/mirror-config-to-aws.ps1

# The AWS CLI writes normal "not found" responses to stderr, which PowerShell
# would otherwise treat as terminating errors. Exit codes are checked instead.
$ErrorActionPreference = "Continue"

$GcpService  = "circle-prospecting-ai-git"
$GcpRegion   = "us-central1"
$GcpProject  = "circle-prospecting-ai"
$AwsRegion   = "us-east-2"
$SecretPrefix = "circle-prospecting/"

# A variable is treated as sensitive if its name matches any of these.
$SensitivePattern = 'SECRET|TOKEN|PASSWORD|_PASS$|_KEY$|API_KEY|CREDENTIAL|SERVICE_ACCOUNT_JSON|HMAC|SMTP_USER'

# Never copied to AWS — these are Google Cloud Run specifics or get overridden.
$Skip = @(
  "PORT", "API_PORT", "K_SERVICE", "FUNCTION_TARGET", "GAE_SERVICE",
  "FIREBASE_SERVICE_ACCOUNT_PATH",
  "FIREBASE_USE_ADC", "FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS"
)

Write-Host "Reading configuration from Cloud Run..." -ForegroundColor Cyan

$raw = gcloud run services describe $GcpService --region $GcpRegion --project $GcpProject --format=json 2>&1 | Out-String
if ($raw -match "Reauthentication failed|gcloud auth login") {
  throw "gcloud login expired. Run 'gcloud auth login' and try again."
}

$svc = $raw | ConvertFrom-Json
$envVars = $svc.spec.template.spec.containers[0].env

if (-not $envVars) { throw "No environment variables found on the Cloud Run service." }

$plain    = @{}
$secrets  = @()
$manual   = @()
$skipped  = @()
$failed   = @()

foreach ($e in $envVars) {
  $name = $e.name

  if ($Skip -contains $name) { $skipped += $name; continue }

  # Values sourced from Google Secret Manager cannot be read here.
  if (-not $e.value -and $e.valueFrom) { $manual += $name; continue }
  if ($null -eq $e.value -or $e.value -eq "") { $skipped += $name; continue }

  if ($name -match $SensitivePattern) {
    $secretName = "$SecretPrefix$name"
    $tmp = Join-Path $env:TEMP ("sec-" + [guid]::NewGuid().ToString("N") + ".txt")
    try {
      # -NoNewline matters: a trailing newline would corrupt keys and tokens.
      [System.IO.File]::WriteAllText($tmp, $e.value)

      aws secretsmanager describe-secret --secret-id $secretName --region $AwsRegion --output json *> $null
      $alreadyExists = ($LASTEXITCODE -eq 0)

      if ($alreadyExists) {
        aws secretsmanager put-secret-value --secret-id $secretName --secret-string "file://$tmp" --region $AwsRegion --output json *> $null
      } else {
        aws secretsmanager create-secret --name $secretName --secret-string "file://$tmp" --region $AwsRegion --output json *> $null
      }

      if ($LASTEXITCODE -eq 0) { $secrets += $name } else { $failed += $name }
    }
    finally {
      if (Test-Path $tmp) { Remove-Item $tmp -Force }
    }
  }
  else {
    $plain[$name] = $e.value
  }
}

# App Runner always listens on 8080 in this image.
$plain["PORT"] = "8080"
$plain["NODE_ENV"] = "production"

$outPath = Join-Path $PSScriptRoot "apprunner-env.generated.json"
$plain | ConvertTo-Json -Depth 3 | Set-Content -Path $outPath -Encoding utf8

Write-Host ""
Write-Host "=== Sent to AWS Secrets Manager ($($secrets.Count)) ===" -ForegroundColor Green
$secrets | Sort-Object | ForEach-Object { "  $SecretPrefix$_" }

Write-Host ""
Write-Host "=== Plain environment variables ($($plain.Count)) ===" -ForegroundColor Green
$plain.Keys | Sort-Object | ForEach-Object { "  $_" }

if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "=== FAILED to store ($($failed.Count)) ===" -ForegroundColor Red
  $failed | Sort-Object | ForEach-Object { "  $_" }
}

if ($manual.Count -gt 0) {
  Write-Host ""
  Write-Host "=== NEEDS MANUAL HANDLING ($($manual.Count)) ===" -ForegroundColor Yellow
  Write-Host "  These come from Google Secret Manager and cannot be read automatically:"
  $manual | Sort-Object | ForEach-Object { "  $_" }
}

if ($skipped.Count -gt 0) {
  Write-Host ""
  Write-Host "=== Skipped ($($skipped.Count)) ===" -ForegroundColor DarkGray
  $skipped | Sort-Object | ForEach-Object { "  $_" }
}

Write-Host ""
Write-Host "Wrote $outPath" -ForegroundColor Cyan
Write-Host "No secret values were printed."
