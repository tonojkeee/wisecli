@echo off
REM WiseCLI start script with GPU handling (Windows)

set NPM_CONFIG_NO_SCRIPTS=true

REM GPU handling
if "%ENABLE_GPU%"=="1" (
    echo Running with GPU enabled
) else (
    echo Running with GPU disabled (set ENABLE_GPU=1 to enable)
    set ELECTRON_DISABLE_GPU=1
)

REM Run the app
pnpm run dev
