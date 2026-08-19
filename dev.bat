@echo off
chcp 65001 >nul
rem 開発サーバを起動してブラウザで開く。止めるときはこの窓で Ctrl+C。
cd /d "%~dp0"

if not exist "node_modules" call npm install
if errorlevel 1 goto fail

rem サーバ起動待ちのあいだにブラウザを開く（ping で 4 秒待つ。timeout は入力を奪われると落ちる）
start "" /min cmd /c "ping -n 5 127.0.0.1 >nul & explorer http://localhost:3000"

call npm run dev
if errorlevel 1 goto fail
exit /b 0

:fail
echo.
echo 起動に失敗しました。上のエラーを確認してください。
pause
exit /b 1
