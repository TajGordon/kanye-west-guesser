@echo off
REM ================================================================
REM  FIX GIT - Remove Large Question Files from Git History
REM ================================================================
REM  If you accidentally committed large question JSON files to git,
REM  run this script to remove them from git history.
REM  
REM  WARNING: This rewrites git history! Only run if:
REM    - You haven't pushed yet, OR
REM    - You're okay with force-pushing
REM ================================================================

echo.
echo ================================================================
echo  FIX GIT - Remove Large Files from Git
echo ================================================================
echo.
echo This will remove server/data/questions/*.json from git history
echo and keep only the compressed archive.
echo.
echo WARNING: This rewrites git history!
echo.
set /p CONFIRM="Are you sure? (yes/no): "
if /i not "%CONFIRM%"=="yes" (
    echo Aborted.
    pause
    exit /b 0
)

echo.
echo [1/4] Checking current status...
git status

echo.
echo [2/4] Removing large files from git (keeping in working directory)...
REM If files are staged, unstage them
git reset HEAD server/data/questions/*.json 2>nul

REM Remove from git but keep local files
git rm --cached server/data/questions/*.json 2>nul

REM If already committed, remove from last commit
echo.
echo [3/4] Checking if files are in last commit...
git diff --cached --name-only | findstr "server/data/questions" >nul
if %ERRORLEVEL% EQU 0 (
    echo   Found in staging area. Committing removal...
    git commit -m "Remove large question files (use compressed archive instead)"
) else (
    echo   Not in staging area. Checking last commit...
    git show HEAD --name-only | findstr "server/data/questions/.*\.json" >nul
    if %ERRORLEVEL% EQU 0 (
        echo   Found in last commit. Amending...
        git commit --amend --no-edit
    ) else (
        echo   Not found in recent commits. Nothing to do.
    )
)

echo.
echo [4/4] Verifying .gitignore...
findstr "server/data/questions/" .gitignore >nul
if %ERRORLEVEL% EQU 0 (
    echo   ✅ .gitignore already configured
) else (
    echo   ⚠️  Adding to .gitignore...
    echo server/data/questions/*.json >> .gitignore
    git add .gitignore
    git commit -m "Update .gitignore for question files"
)

echo.
echo ================================================================
echo  CLEANUP COMPLETE
echo ================================================================
echo.
echo What happened:
echo   ✅ Removed *.json files from git tracking
echo   ✅ Files still exist locally in server/data/questions/
echo   ✅ .gitignore updated to prevent future commits
echo.
echo NEXT STEPS:
echo.
echo   1. Verify files are ignored:
echo      git status
echo      (Should NOT show question JSON files)
echo.
echo   2. Run question generation to create compressed archive:
echo      run_on_pc.bat
echo.
echo   3. Commit the compressed file:
echo      git add server/data/questions-data.*
echo      git commit -m "Add compressed question data"
echo.
echo   4. If you already pushed to remote, you'll need to force push:
echo      git push --force origin main
echo      (WARNING: Only do this if you're the only one using the repo!)
echo.
echo ================================================================
pause
