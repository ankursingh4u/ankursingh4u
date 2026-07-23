# AI Coding Ledger — Setup

Auto-updating GitHub profile README **+** a live GitHub Pages dashboard, driven by your local `ccusage` data.

## What's in this folder
| File | Purpose |
|---|---|
| `build-ledger.js` | Reads live `ccusage` data → regenerates `index.html` + `README.md` |
| `index.html` | The dashboard (served by GitHub Pages) |
| `README.md` | Your profile page (generated — don't hand-edit) |
| `update.ps1` | Rebuilds + commits + pushes |
| `SETUP.md` | This file |

Requirements: **Node.js** and **git** installed. (`ccusage` is fetched automatically via `npx`.)

---

## One-time setup

### 1. Create the profile repo
On GitHub, create a **public** repo named exactly **`ankursingh4u`** (same as your username). Don't add a README from the wizard.

### 2. Put these files in it
```powershell
cd "C:\Users\ankur\work\app fix\ledger-site"
git init
git branch -M main
git remote add origin https://github.com/ankursingh4u/ankursingh4u.git
git add -A
git commit -m "AI coding ledger"
git push -u origin main
```
(If git asks you to log in, use the GitHub browser sign-in it offers, or a Personal Access Token with `repo` scope.)

### 3. Turn on GitHub Pages
Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main** / **/(root)** → Save.
Your dashboard goes live at **https://ankursingh4u.github.io/ankursingh4u/** in ~1 minute.

> Note: because Pages serves from the repo root, the same repo shows the **README** on your profile *and* hosts the **dashboard** — one repo, both jobs.

Done. Your profile now shows the stats, and the dashboard is live.

---

## Make it auto-update daily (Task Scheduler)

Run this **once** in PowerShell to schedule a daily 9:00 AM refresh:

```powershell
$action  = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument '-ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Users\ankur\work\app fix\ledger-site\update.ps1"'
$trigger = New-ScheduledTaskTrigger -Daily -At 9:00AM
Register-ScheduledTask -TaskName "AI-Coding-Ledger" -Action $action -Trigger $trigger `
  -Description "Refresh AI coding ledger and push to GitHub"
```

From then on it rebuilds from your latest `ccusage` data and pushes — hands-off.

- **Run it right now to test:** `Start-ScheduledTask -TaskName "AI-Coding-Ledger"`
- **Remove it later:** `Unregister-ScheduledTask -TaskName "AI-Coding-Ledger" -Confirm:$false`

---

## Manual refresh anytime
```powershell
cd "C:\Users\ankur\work\app fix\ledger-site"
powershell -ExecutionPolicy Bypass -File update.ps1
```
