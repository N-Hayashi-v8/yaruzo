@echo off
chcp 65001 >nul
rem 開発サーバを起動してアプリ窓で開く。止めるときはこの窓で Ctrl+C。
cd /d "%~dp0"

if not exist "node_modules" call npm install
if errorlevel 1 goto fail

rem アプリ窓で開く。--app はタブもアドレスバーもない独立窓。Chrome があれば優先、なければ Edge
set "APP=msedge"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "APP=chrome"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "APP=chrome"

rem サーバ起動待ちのあいだに窓を開く（ping で 4 秒待つ。timeout は入力を奪われると落ちる）
start "" /min cmd /c "ping -n 5 127.0.0.1 >nul & start %APP% --app=http://localhost:3000"

call npm run dev
if errorlevel 1 goto fail
exit /b 0

:fail
echo.
echo 起動に失敗しました。上のエラーを確認してください。
pause
exit /b 1
