# Private path from App Runner → roofs RDS. Does not change RDS-Pvt-rt.
#
# Creates:
#   - two private subnets (172.31.50.0/24, 172.31.51.0/24)
#   - EIP + NAT in public subnet-ad8f6bc5 (needed so Stripe/GHL/Firestore still work)
#   - route table for those subnets only
#   - security group + inbound 3306 on existing RDS SG
#   - App Runner VPC connector
#
# Does not attach the connector to the running service (call attach-rds-vpc.ps1 after NAT is available).
# Does not reset the RDS master password or create the MySQL user.
#
# Usage:  pwsh infra/aws/connect-rds-vpc.ps1

$ErrorActionPreference = "Stop"
$Region = "us-east-2"
$VpcId = "vpc-852a3dec"
$PublicSubnetForNat = "subnet-ad8f6bc5"
$RdsSg = "sg-07d89358742cd15a5"
$ConnectorName = "circle-prospecting-rds"

function Get-TaggedId([string]$ResourceType, [string]$Name) {
  $q = aws ec2 describe-tags --region $Region --filters "Name=key,Values=Name" "Name=value,Values=$Name" "Name=resource-type,Values=$ResourceType" --query "Tags[0].ResourceId" --output text
  if (-not $q -or $q -eq "None") { return $null }
  return $q.Trim()
}

Write-Host "=== Circle Prospecting RDS VPC path ==="

$subnetA = Get-TaggedId "subnet" "circle-prospecting-apprunner-priv-a"
if (-not $subnetA) {
  $subnetA = (aws ec2 create-subnet --region $Region --vpc-id $VpcId --cidr-block 172.31.50.0/24 --availability-zone us-east-2a --query Subnet.SubnetId --output text).Trim()
  aws ec2 create-tags --region $Region --resources $subnetA --tags Key=Name,Value=circle-prospecting-apprunner-priv-a Key=Project,Value=circle-prospecting | Out-Null
  Write-Host "Created subnet A $subnetA"
} else {
  Write-Host "Subnet A exists $subnetA"
}

$subnetB = Get-TaggedId "subnet" "circle-prospecting-apprunner-priv-b"
if (-not $subnetB) {
  $subnetB = (aws ec2 create-subnet --region $Region --vpc-id $VpcId --cidr-block 172.31.51.0/24 --availability-zone us-east-2b --query Subnet.SubnetId --output text).Trim()
  aws ec2 create-tags --region $Region --resources $subnetB --tags Key=Name,Value=circle-prospecting-apprunner-priv-b Key=Project,Value=circle-prospecting | Out-Null
  Write-Host "Created subnet B $subnetB"
} else {
  Write-Host "Subnet B exists $subnetB"
}

$sg = (aws ec2 describe-security-groups --region $Region --filters "Name=vpc-id,Values=$VpcId" "Name=group-name,Values=circle-prospecting-apprunner-vpc" --query "SecurityGroups[0].GroupId" --output text).Trim()
if (-not $sg -or $sg -eq "None") {
  $sg = (aws ec2 create-security-group --region $Region --group-name circle-prospecting-apprunner-vpc --description "App Runner VPC connector — Circle Prospecting to roofs RDS" --vpc-id $VpcId --query GroupId --output text).Trim()
  aws ec2 create-tags --region $Region --resources $sg --tags Key=Name,Value=circle-prospecting-apprunner-vpc Key=Project,Value=circle-prospecting | Out-Null
  Write-Host "Created connector SG $sg"
} else {
  Write-Host "Connector SG exists $sg"
}

$existingRdsRule = aws ec2 describe-security-groups --region $Region --group-ids $RdsSg --query "SecurityGroups[0].IpPermissions[?FromPort==``3306``].UserIdGroupPairs[?GroupId=='$sg']" --output text
if (-not $existingRdsRule) {
  aws ec2 authorize-security-group-ingress --region $Region --group-id $RdsSg --ip-permissions "IpProtocol=tcp,FromPort=3306,ToPort=3306,UserIdGroupPairs=[{GroupId=$sg,Description='Circle Prospecting App Runner VPC connector'}]" | Out-Null
  Write-Host "Opened RDS 3306 from $sg"
} else {
  Write-Host "RDS 3306 from $sg already open"
}

$eipAlloc = (aws ec2 describe-addresses --region $Region --filters "Name=tag:Name,Values=circle-prospecting-nat" --query "Addresses[0].AllocationId" --output text).Trim()
if (-not $eipAlloc -or $eipAlloc -eq "None") {
  $eipAlloc = (aws ec2 allocate-address --region $Region --domain vpc --query AllocationId --output text).Trim()
  aws ec2 create-tags --region $Region --resources $eipAlloc --tags Key=Name,Value=circle-prospecting-nat Key=Project,Value=circle-prospecting | Out-Null
  Write-Host "Allocated EIP $eipAlloc"
} else {
  Write-Host "EIP exists $eipAlloc"
}

$natId = (aws ec2 describe-nat-gateways --region $Region --filter "Name=tag:Name,Values=circle-prospecting-nat" "Name=state,Values=pending,available" --query "NatGateways[0].NatGatewayId" --output text).Trim()
if (-not $natId -or $natId -eq "None") {
  $natId = (aws ec2 create-nat-gateway --region $Region --subnet-id $PublicSubnetForNat --allocation-id $eipAlloc --query NatGateway.NatGatewayId --output text).Trim()
  aws ec2 create-tags --region $Region --resources $natId --tags Key=Name,Value=circle-prospecting-nat Key=Project,Value=circle-prospecting | Out-Null
  Write-Host "Created NAT $natId (waiting until available)"
} else {
  Write-Host "NAT exists $natId"
}

aws ec2 wait nat-gateway-available --region $Region --nat-gateway-ids $natId
Write-Host "NAT available $natId"

$rtb = Get-TaggedId "route-table" "circle-prospecting-apprunner-rt"
if (-not $rtb) {
  $rtb = (aws ec2 create-route-table --region $Region --vpc-id $VpcId --query RouteTable.RouteTableId --output text).Trim()
  aws ec2 create-tags --region $Region --resources $rtb --tags Key=Name,Value=circle-prospecting-apprunner-rt Key=Project,Value=circle-prospecting | Out-Null
  Write-Host "Created route table $rtb"
} else {
  Write-Host "Route table exists $rtb"
}

$hasDefaultRoute = aws ec2 describe-route-tables --region $Region --route-table-ids $rtb --query "RouteTables[0].Routes[?DestinationCidrBlock=='0.0.0.0/0'].NatGatewayId" --output text
if (-not $hasDefaultRoute -or $hasDefaultRoute -eq "None") {
  aws ec2 create-route --region $Region --route-table-id $rtb --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $natId | Out-Null
  Write-Host "Added 0.0.0.0/0 -> $natId on $rtb"
} else {
  Write-Host "Default route already on $rtb"
}

foreach ($sn in @($subnetA, $subnetB)) {
  $assoc = aws ec2 describe-route-tables --region $Region --route-table-ids $rtb --query "RouteTables[0].Associations[?SubnetId=='$sn'].RouteTableAssociationId" --output text
  if (-not $assoc) {
    aws ec2 associate-route-table --region $Region --route-table-id $rtb --subnet-id $sn | Out-Null
    Write-Host "Associated $sn -> $rtb"
  } else {
    Write-Host "$sn already on $rtb"
  }
}

$connectorArn = (aws apprunner list-vpc-connectors --region $Region --query "VpcConnectors[?VpcConnectorName=='$ConnectorName' && Status=='ACTIVE'].VpcConnectorArn | [0]" --output text).Trim()
if (-not $connectorArn -or $connectorArn -eq "None") {
  $connectorArn = (aws apprunner create-vpc-connector --region $Region --vpc-connector-name $ConnectorName --subnets $subnetA $subnetB --security-groups $sg --query VpcConnector.VpcConnectorArn --output text).Trim()
  Write-Host "Created VPC connector $connectorArn"
} else {
  Write-Host "VPC connector exists $connectorArn"
}

Write-Host ""
Write-Host "Done. RDS-Pvt-rt was not changed."
Write-Host "SubnetA=$subnetA"
Write-Host "SubnetB=$subnetB"
Write-Host "SG=$sg"
Write-Host "NAT=$natId"
Write-Host "RT=$rtb"
Write-Host "ConnectorArn=$connectorArn"
Write-Host "Next: attach this connector to App Runner after NAT is proven, then store ROOFS_DB_* (never the master password)."
