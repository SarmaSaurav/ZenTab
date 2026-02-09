@echo off
echo Checking for updates from GitHub...

:: Navigate to your repo (Change this path!)
:: cd /d "C:\Path\To\Your\Repo"

:: Fetch the latest data from the server
git fetch origin

:: Check if the local branch is behind
git status -uno | findstr /C:"Your branch is behind" > nul

if %errorlevel% == 0 (
    echo Updates found. Pulling changes...
    git pull origin main
    echo Repository is now up to date.
) else (
    echo Already up to date. No action needed.
)

pause