# update.ps1  —  refresh the ledger from ccusage and push to GitHub.
# Run manually:  powershell -ExecutionPolicy Bypass -File update.ps1
# Or let Task Scheduler run it daily (see SETUP.md).

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

# Pull first so the WakaTime Action's commits (which update the coding-activity
# block on GitHub) are merged in before we rebuild — avoids push conflicts.
Write-Host "==> Syncing with GitHub..." -ForegroundColor Cyan
git pull --rebase origin main 2>&1 | Out-Host

Write-Host "==> Rebuilding ledger from ccusage..." -ForegroundColor Cyan
node build-ledger.js

# Only commit if something actually changed
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "==> No changes since last run. Done." -ForegroundColor Yellow
    exit 0
}

$stamp = Get-Date -Format 'yyyy-MM-dd'
Write-Host "==> Committing..." -ForegroundColor Cyan
git add -A
git commit -m "chore: update AI coding ledger ($stamp)"

Write-Host "==> Pushing to GitHub..." -ForegroundColor Cyan
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "!! Push FAILED (check your internet connection)." -ForegroundColor Red
    Write-Host "   Your changes are committed locally and safe." -ForegroundColor Yellow
    Write-Host "   Re-run this script when you're back online to push them." -ForegroundColor Yellow
    exit 1
}

Write-Host "==> Done. Live at https://ankursingh4u.github.io/ankursingh4u/" -ForegroundColor Green
