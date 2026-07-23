# update.ps1  —  refresh the ledger from ccusage and push to GitHub.
# Run manually:  powershell -ExecutionPolicy Bypass -File update.ps1
# Or let Task Scheduler run it daily (see SETUP.md).

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host "==> Rebuilding ledger from ccusage..." -ForegroundColor Cyan
node build-ledger.js

# Only commit if something actually changed
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "==> No changes since last run. Done." -ForegroundColor Yellow
    exit 0
}

$stamp = Get-Date -Format 'yyyy-MM-dd'
Write-Host "==> Committing and pushing..." -ForegroundColor Cyan
git add -A
git commit -m "chore: update AI coding ledger ($stamp)"
git push

Write-Host "==> Done. Live at https://ankursingh4u.github.io/ankursingh4u/" -ForegroundColor Green
