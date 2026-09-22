@echo off
cd /d "%~dp0"
call npm run tauri:build:test
start "" "%~dp0src-tauri\target\release\yaruzo.exe"
pause
