param(
  [Parameter(Mandatory=$false)] [string]$Repo,
  [Parameter(Mandatory=$false)] [string]$RenderDeployHookUrl,
  [Parameter(Mandatory=$false)] [string]$VercelToken,
  [Parameter(Mandatory=$false)] [string]$VercelOrgId,
  [Parameter(Mandatory=$false)] [string]$VercelProjectId,
  [switch]$UseRepoVariables
)

function Ensure-GHCLI {
  try { gh --version | Out-Null } catch { Write-Error "GitHub CLI (gh) yüklü değil. https://cli.github.com/ adresinden yükleyin."; exit 1 }
  $authStatus = gh auth status 2>$null
  if ($LASTEXITCODE -ne 0) { Write-Error "gh auth login gerekli. Lütfen 'gh auth login' komutunu çalıştırıp GitHub'a giriş yapın."; exit 1 }
}

function Resolve-Repo {
  param([string]$Repo)
  if ($Repo) { return $Repo }
  $remote = git remote get-url origin 2>$null
  if (-not $remote) { Write-Error "origin uzaktan depo bulunamadı. -Repo parametresiyle 'owner/name' belirtin."; exit 1 }
  if ($remote -match "github.com[/:]([^/]+)/([^/.]+)") { return "$($matches[1])/$($matches[2])" }
  Write-Error "Git remote URL çözümlenemedi. -Repo parametresi kullanın."; exit 1
}

function Set-Item {
  param([string]$Name, [string]$Value)
  if (-not $Value) { Write-Warning "Skip: $Name (değer boş)"; return }
  if ($UseRepoVariables) {
    gh variable set $Name --repo $Global:RepoResolved --body $Value
  } else {
    gh secret set $Name --repo $Global:RepoResolved --body $Value
  }
}

Ensure-GHCLI
$Global:RepoResolved = Resolve-Repo -Repo $Repo

Write-Host "Hedef repo: $Global:RepoResolved" -ForegroundColor Cyan
Write-Host (if ($UseRepoVariables) {"Mod: Repository Variables"} else {"Mod: Repository Secrets"}) -ForegroundColor Cyan

Set-Item -Name "RENDER_DEPLOY_HOOK_URL" -Value $RenderDeployHookUrl
Set-Item -Name "VERCEL_TOKEN" -Value $VercelToken
Set-Item -Name "VERCEL_ORG_ID" -Value $VercelOrgId
Set-Item -Name "VERCEL_PROJECT_ID" -Value $VercelProjectId

Write-Host "Tamamlandı." -ForegroundColor Green
Write-Host "Not: CI, secrets yoksa repository variables'a da bakar." -ForegroundColor Yellow