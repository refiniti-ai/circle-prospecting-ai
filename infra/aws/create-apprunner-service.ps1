# Creates (or updates) the App Runner service that runs the Express API.
#
# Reads the plain settings produced by mirror-config-to-aws.ps1 and wires every
# circle-prospecting/* secret in Secrets Manager to a matching environment
# variable. Secret values stay in Secrets Manager and are never read here.
#
# Usage:  pwsh infra/aws/create-apprunner-service.ps1

$ErrorActionPreference = "Continue"

$Region       = "us-east-2"
$AccountId    = "381767547693"
$ServiceName  = "circle-prospecting-api"
$Image        = "$AccountId.dkr.ecr.$Region.amazonaws.com/circle-prospecting-api:latest"
$AccessRole   = "arn:aws:iam::${AccountId}:role/circle-prospecting-apprunner-ecr-role"
$InstanceRole = "arn:aws:iam::${AccountId}:role/circle-prospecting-apprunner-instance-role"

$envFile = Join-Path $PSScriptRoot "apprunner-env.generated.json"
if (-not (Test-Path $envFile)) {
  throw "Missing $envFile. Run mirror-config-to-aws.ps1 first."
}

$plainObj = Get-Content $envFile -Raw | ConvertFrom-Json
$plain = @{}
foreach ($p in $plainObj.PSObject.Properties) { $plain[$p.Name] = [string]$p.Value }

# Map every circle-prospecting/<NAME> secret to environment variable <NAME>.
$secretsJson = aws secretsmanager list-secrets --region $Region --output json 2>&1 | Out-String | ConvertFrom-Json
$secretMap = @{}
foreach ($s in $secretsJson.SecretList) {
  if ($s.Name -like "circle-prospecting/*") {
    $varName = $s.Name.Substring("circle-prospecting/".Length)
    $secretMap[$varName] = $s.ARN
  }
}

Write-Host "Plain variables : $($plain.Count)"
Write-Host "Secret variables: $($secretMap.Count)"

$config = [ordered]@{
  ServiceName         = $ServiceName
  SourceConfiguration = [ordered]@{
    AuthenticationConfiguration = @{ AccessRoleArn = $AccessRole }
    AutoDeploymentsEnabled      = $true
    ImageRepository             = [ordered]@{
      ImageIdentifier     = $Image
      ImageRepositoryType = "ECR"
      ImageConfiguration  = [ordered]@{
        Port                        = "8080"
        RuntimeEnvironmentVariables = $plain
        RuntimeEnvironmentSecrets   = $secretMap
      }
    }
  }
  InstanceConfiguration = [ordered]@{
    Cpu             = "1 vCPU"
    Memory          = "2 GB"
    InstanceRoleArn = $InstanceRole
  }
  HealthCheckConfiguration = [ordered]@{
    Protocol           = "HTTP"
    Path               = "/api/health"
    Interval           = 10
    Timeout            = 5
    HealthyThreshold   = 1
    UnhealthyThreshold = 5
  }
}

$cfgPath = Join-Path $PSScriptRoot "apprunner-service.generated.json"
# The AWS CLI rejects a UTF-8 byte-order mark, which Set-Content -Encoding utf8
# adds on Windows PowerShell. Write the file without one.
$noBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($cfgPath, ($config | ConvertTo-Json -Depth 10), $noBom)
Write-Host "Wrote $cfgPath"

# Copy to a path without spaces; file:// arguments handle those poorly.
$cliPath = Join-Path $env:TEMP "apprunner-service.json"
[System.IO.File]::WriteAllText($cliPath, [System.IO.File]::ReadAllText($cfgPath), $noBom)

aws apprunner create-service --cli-input-json "file://$cliPath" --region $Region --output json 2>&1 | Out-String | ForEach-Object {
  if ($_ -match "ServiceAlreadyExists|already exists") {
    Write-Host "Service already exists - use update-service instead." -ForegroundColor Yellow
  }
  elseif ($_ -match "error occurred") {
    Write-Host "ERROR: $_" -ForegroundColor Red
  }
  else {
    $r = $_ | ConvertFrom-Json
    Write-Host ""
    Write-Host "Service ARN : $($r.Service.ServiceArn)"
    Write-Host "Service URL : https://$($r.Service.ServiceUrl)"
    Write-Host "Status      : $($r.Service.Status)"
  }
}
