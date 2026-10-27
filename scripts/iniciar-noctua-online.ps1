$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerUrl = 'http://127.0.0.1:3333'
$HealthUrl = "$ServerUrl/health"
$VercelSite = 'https://notcua.vercel.app/atendimento'
$LocalNoctua = Join-Path $env:LOCALAPPDATA 'Noctua'
$ToolsDir = Join-Path $LocalNoctua 'tools'
$LogsDir = Join-Path $LocalNoctua 'logs'
$Cloudflared = Join-Path $ToolsDir 'cloudflared.exe'
$StartedServer = $null
$Tunnel = $null

function Write-Step([string]$Message) {
  Write-Host "`n$Message" -ForegroundColor Cyan
}

function Stop-Tree($Process) {
  if ($null -ne $Process) {
    try {
      if (-not $Process.HasExited) { & taskkill.exe /PID $Process.Id /T /F | Out-Null }
    } catch { }
  }
}

function Invoke-Vercel([string[]]$Arguments) {
  & npx.cmd --yes vercel @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "A Vercel não concluiu a etapa solicitada. Veja a mensagem acima."
  }
}

try {
  Set-Location -LiteralPath $ProjectRoot
  New-Item -ItemType Directory -Force -Path $ToolsDir, $LogsDir | Out-Null

  if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'apps\server\.env'))) {
    throw 'Falta a configuração local do servidor. Não encontrei apps\server\.env.'
  }
  $CredentialLine = Get-Content -LiteralPath (Join-Path $ProjectRoot 'apps\server\.env') |
    Where-Object { $_ -match '^GOOGLE_APPLICATION_CREDENTIALS=' } |
    Select-Object -First 1
  if (-not $CredentialLine) {
    throw 'O Firebase Admin ainda não está configurado no servidor local.'
  }
  $CredentialPath = $CredentialLine.Substring('GOOGLE_APPLICATION_CREDENTIALS='.Length).Trim().Trim('"')
  if (-not (Test-Path -LiteralPath $CredentialPath)) {
    throw 'O arquivo de acesso seguro do Firebase não foi encontrado no local configurado.'
  }

  Write-Step '1 de 5 — Preparando o servidor do Noctua'
  try {
    $null = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 3
    Write-Host 'O servidor já está ligado.' -ForegroundColor Green
  } catch {
    $LogBase = Join-Path $LogsDir 'servidor'
    $StartedServer = Start-Process -FilePath $env:ComSpec `
      -ArgumentList @('/d', '/c', 'npm.cmd run dev -w @noctua/server') `
      -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput "$LogBase-saida.log" -RedirectStandardError "$LogBase-erros.log"
    $Healthy = $false
    for ($Attempt = 0; $Attempt -lt 40; $Attempt++) {
      Start-Sleep -Seconds 2
      try {
        $Health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 3
        if ($Health.status -eq 'ok') { $Healthy = $true; break }
      } catch { }
      if ($StartedServer.HasExited) { break }
    }
    if (-not $Healthy) {
      throw 'Não consegui iniciar o servidor. Confira Node.js e o arquivo de configuração do Firebase.'
    }
    Write-Host 'Servidor iniciado.' -ForegroundColor Green
  }

  Write-Step '2 de 5 — Preparando a conexão segura'
  if (-not (Test-Path -LiteralPath $Cloudflared)) {
    Write-Host 'Instalando o conector oficial da Cloudflare (somente na primeira vez)...'
    $DownloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $Cloudflared
  }
  $Signature = Get-AuthenticodeSignature -FilePath $Cloudflared
  if ($Signature.Status -ne 'Valid' -or $Signature.SignerCertificate.Subject -notmatch 'Cloudflare') {
    Remove-Item -LiteralPath $Cloudflared -Force -ErrorAction SilentlyContinue
    throw 'A assinatura do programa Cloudflare não foi validada. O arquivo foi descartado por segurança.'
  }

  Write-Step '3 de 5 — Preparando o acesso à Vercel'
  if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
    throw 'Node.js não foi encontrado. O Noctua precisa dele instalado no computador.'
  }
  & npx.cmd --yes vercel whoami
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Na primeira vez, entre na sua conta Vercel quando o navegador abrir.' -ForegroundColor Yellow
    Invoke-Vercel @('login')
  }
  if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot '.vercel\repo.json'))) {
    Write-Host 'Na primeira vez, selecione sua conta e o projeto Noctua na lista da Vercel.' -ForegroundColor Yellow
    Invoke-Vercel @('link')
  }

  Write-Step '4 de 5 — Abrindo o túnel e atualizando o site'
  $TunnelStdout = Join-Path $LogsDir 'tunnel-saida.log'
  $TunnelStderr = Join-Path $LogsDir 'tunnel-erros.log'
  Remove-Item -LiteralPath $TunnelStdout, $TunnelStderr -Force -ErrorAction SilentlyContinue
  $Tunnel = Start-Process -FilePath $Cloudflared `
    -ArgumentList @('tunnel', '--url', $ServerUrl, '--no-autoupdate') `
    -WindowStyle Hidden -PassThru -RedirectStandardOutput $TunnelStdout -RedirectStandardError $TunnelStderr
  $PublicApiUrl = $null
  for ($Attempt = 0; $Attempt -lt 60; $Attempt++) {
    Start-Sleep -Seconds 2
    $TunnelLog = @()
    foreach ($LogFile in @($TunnelStdout, $TunnelStderr)) {
      if (Test-Path -LiteralPath $LogFile) { $TunnelLog += Get-Content -LiteralPath $LogFile -ErrorAction SilentlyContinue }
    }
    $Match = $TunnelLog | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
    if ($Match) { $PublicApiUrl = $Match.Matches[0].Value; break }
    if ($Tunnel.HasExited) { break }
  }
  if (-not $PublicApiUrl) {
    $Reason = 'A Cloudflare não conseguiu abrir o túnel.'
    if (Test-Path -LiteralPath $TunnelStderr) {
      $Tail = (Get-Content -LiteralPath $TunnelStderr -ErrorAction SilentlyContinue | Select-Object -Last 5) -join ' '
      if ($Tail) { $Reason += " Detalhe: $Tail" }
    }
    throw $Reason
  }
  Write-Host 'Conexão pronta. Atualizando o endereço da API na Vercel...'
  Invoke-Vercel @('env', 'add', 'VITE_API_URL', '--environment', 'production', '--value', $PublicApiUrl, '--type', 'config', '--force', '--yes')

  Write-Step '5 de 5 — Publicando o site atualizado'
  Invoke-Vercel @('--prod', '--yes')
  Write-Host "`nNoctua online: $VercelSite" -ForegroundColor Green
  Write-Host 'Já abri o site no navegador. Deixe esta janela aberta enquanto estiver usando o sistema.' -ForegroundColor Green
  Start-Process $VercelSite
  Write-Host "`nPara desligar o Noctua online, pressione Ctrl+C nesta janela."
  while ($true) {
    if ($Tunnel.HasExited) { throw 'O túnel foi encerrado. Inicie o Noctua novamente pelo atalho.' }
    Start-Sleep -Seconds 2
  }
} catch {
  Write-Host "`nNão consegui iniciar o Noctua online:`n$($_.Exception.Message)" -ForegroundColor Red
  Write-Host "`nSe for a primeira utilização, confira o acesso à Vercel e aceite o login no navegador."
  Write-Host "Os registros técnicos ficam em: $LogsDir"
} finally {
  Stop-Tree $Tunnel
  Stop-Tree $StartedServer
}
