@echo off
REM ================================================================
REM  RUN ON YOUR PC (Windows Development Machine)
REM ================================================================
REM  This script regenerates question data files.
REM  Run this BEFORE deploying to your server.
REM  
REM  What it does:
REM    1. Generates questions from lyrics (requires ~768MB RAM)
REM    2. Applies aliases to all questions
REM    3. Creates backup of old questions
REM  
REM  Output: server\data\questions\*.json files ready to deploy
REM ================================================================

echo.
echo ================================================================
echo  KANYE GUESSER - PC BUILD SCRIPT
echo ================================================================
echo  This generates question data on your PC (NOT for server!)
echo ================================================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: Must run from KanyeGuesser root directory
    echo Current directory: %CD%
    pause
    exit /b 1
)

REM Install dependencies if needed
echo [1/4] Checking dependencies...
if not exist "song_data_generation\questions_generator\node_modules" (
    echo   Installing question generator dependencies...
    cd song_data_generation\questions_generator
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        cd ..\..
        pause
        exit /b 1
    )
    cd ..\..
)

if not exist "song_data_generation\alias_controller\node_modules" (
    echo   Installing alias controller dependencies...
    cd song_data_generation\alias_controller
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        cd ..\..
        pause
        exit /b 1
    )
    cd ..\..
)

REM Backup existing questions
echo.
echo [2/4] Backing up existing questions...
set BACKUP_DIR=server\data\questions-backup-%date:~-4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%

if exist "server\data\questions" (
    xcopy /E /I /Q "server\data\questions" "%BACKUP_DIR%" >nul
    echo   Backup created: %BACKUP_DIR%
) else (
    echo   No existing questions to backup
)

REM Generate questions
echo.
echo [3/4] Generating questions (takes 1-2 minutes)...
echo   Memory limit: 768MB
cd song_data_generation\questions_generator
call node --max-old-space-size=768 index.js --validate --strict
if errorlevel 1 (
    echo.
    echo ERROR: Question generation failed!
    echo.
    echo If you got "out of memory" error, try generating one type at a time:
    echo   cd song_data_generation\questions_generator
    echo   node --max-old-space-size=512 index.js --type=fill-missing-word
    echo   node --max-old-space-size=512 index.js --type=song-from-lyric
    echo   (etc for each type)
    cd ..\..
    pause
    exit /b 1
)
cd ..\..

REM Apply aliases
echo.
echo [4/4] Applying aliases...
cd song_data_generation\alias_controller
call node apply-aliases.js
if errorlevel 1 (
    echo ERROR: Alias application failed!
    cd ..\..
    pause
    exit /b 1
)
cd ..\..

REM Compress questions for deployment
echo.
echo [BONUS] Compressing questions for git...
set ARCHIVE_NAME=questions-data.tar.gz
cd server\data

REM Check if tar is available (Windows 10 1803+)
where tar >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   Using tar to compress...
    tar -czf %ARCHIVE_NAME% questions\
    echo   Created: server\data\%ARCHIVE_NAME%
) else (
    REM Fallback to PowerShell compression
    echo   Using PowerShell compression...
    powershell -command "Compress-Archive -Path 'questions' -DestinationPath 'questions-data.zip' -Force"
    set ARCHIVE_NAME=questions-data.zip
    echo   Created: server\data\%ARCHIVE_NAME%
)

cd ..\..

REM Success!
echo.
echo ================================================================
echo  SUCCESS! Questions generated and compressed
echo ================================================================
echo.
echo Generated files:
echo   - Raw: server\data\questions\ (95MB+, NOT for git)
echo   - Compressed: server\data\%ARCHIVE_NAME% (smaller, ready for git)
echo.
echo NEXT STEPS:
echo   1. Review compressed archive:
echo      dir server\data\%ARCHIVE_NAME%
echo.
echo   2. Commit compressed file to git:
echo      git add server/data/%ARCHIVE_NAME%
echo      git commit -m "Update questions"
echo      git push
echo.
echo   3. On your server, run:
echo      bash run_on_server.sh
echo      (It will automatically decompress)
echo.
echo ================================================================
pause
