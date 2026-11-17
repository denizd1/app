@echo off
rem Starts PM2 and the apps after a reboot / logon. Called by Task Scheduler or
rem the Startup folder (see docs\PM2_KURULUM.md). Safe to run when the apps are
rem already running: `pm2 resurrect` only starts the ones that are missing.
rem Output goes to %USERPROFILE%\.pm2\boot.log
setlocal
cd /d "%~dp0.."

rem If node.exe is not on this user's PATH, put its full path here, e.g.
rem set "NODE=C:\Users\me\node\node.exe"
set "NODE=node"

if not defined PM2_HOME set "PM2_HOME=%USERPROFILE%\.pm2"
if not exist "%PM2_HOME%" mkdir "%PM2_HOME%"
set "LOG=%PM2_HOME%\boot.log"

echo ==== %date% %time% >> "%LOG%"
if exist "%PM2_HOME%\dump.pm2" (
  "%NODE%" node_modules\pm2\bin\pm2 resurrect >> "%LOG%" 2>&1
) else (
  rem No saved list yet: start from the ecosystem file and save it.
  "%NODE%" node_modules\pm2\bin\pm2 start ecosystem.config.js >> "%LOG%" 2>&1
  "%NODE%" node_modules\pm2\bin\pm2 save >> "%LOG%" 2>&1
)
endlocal
