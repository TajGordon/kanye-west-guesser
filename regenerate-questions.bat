@echo off
REM regenerate-questions.bat
REM Complete question data regeneration workflow for Windows

echo 🎵 KanyeGuesser Question Regeneration
echo ======================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Must run from KanyeGuesser root directory
    exit /b 1
)

if not exist "song_data_generation" (
    echo ❌ Error: Must run from KanyeGuesser root directory
    exit /b 1
)

REM Check dependencies are installed
echo 📦 Checking dependencies...
if not exist "song_data_generation\questions_generator\node_modules" (
    echo   Installing question generator dependencies...
    cd song_data_generation\questions_generator
    call npm install
    cd ..\..
)

if not exist "song_data_generation\alias_controller\node_modules" (
    echo   Installing alias controller dependencies...
    cd song_data_generation\alias_controller
    call npm install
    cd ..\..
)

REM Backup existing questions
echo.
echo 💾 Backing up existing questions...
set BACKUP_DIR=server\data\questions-backup-%date:~-4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%

if exist "server\data\questions" (
    xcopy /E /I /Q "server\data\questions" "%BACKUP_DIR%" >nul
    echo   ✅ Backup created: %BACKUP_DIR%
) else (
    echo   ⚠️  No existing questions to backup
)

REM Generate questions
echo.
echo 📝 Generating questions...
echo   (This may take 1-2 minutes for large datasets)
echo   Note: Run this on your development machine, not production server
cd song_data_generation\questions_generator
call node --max-old-space-size=768 index.js --validate --strict
if errorlevel 1 (
    cd ..\..
    echo ❌ Question generation failed!
    exit /b 1
)
cd ..\..

REM Apply aliases
echo.
echo 🏷️  Applying aliases...
cd song_data_generation\alias_controller
call node apply-aliases.js
if errorlevel 1 (
    cd ..\..
    echo ❌ Alias application failed!
    exit /b 1
)
cd ..\..

REM Statistics
echo.
echo 📊 Statistics:
for /f %%A in ('dir /b /a-d "server\data\questions\*.json" 2^>nul ^| find /c /v ""') do echo   - Question files: %%A

echo.
echo ✅ Question regeneration complete!
echo.
echo Next steps:
echo   1. Test locally: cd server ^&^& npm start
echo   2. Review changes: git diff server/data/questions/
echo   3. Deploy: git commit -am "Update questions" ^&^& git push
echo.
echo Backup location: %BACKUP_DIR%
