# Manual diagnostic for BUG-011. Does not start the app, tunnel, or deployment.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$auditDirectory = Join-Path $projectRoot '.audit'
$outputPath = Join-Path $auditDirectory 'manual-signature.json'
$signedExecutable = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$attempts = @()
$validated = $false
for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
        Import-Module Microsoft.PowerShell.Security -ErrorAction Stop
        $signature = Get-AuthenticodeSignature -FilePath $signedExecutable -ErrorAction Stop
        $attempts += [PSCustomObject]@{ attempt = $attempt; moduleLoaded = $true; signatureStatus = [string]$signature.Status }
        $validated = $signature.Status -eq 'Valid'
        if ($validated) { break }
    } catch {
        $attempts += [PSCustomObject]@{ attempt = $attempt; moduleLoaded = $false; error = $_.Exception.Message }
    }
}
New-Item -ItemType Directory -Path $auditDirectory -Force | Out-Null
[PSCustomObject]@{
    bug = 'BUG-011'
    checkedAt = [DateTime]::UtcNow.ToString('o')
    powerShellVersion = [string]$PSVersionTable.PSVersion
    validated = $validated
    attempts = $attempts
    limitation = 'Tests module import and an existing Windows signature only; does not validate the protected launcher or Cloudflare.'
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $outputPath -Encoding UTF8
if (-not $validated) { exit 1 }
