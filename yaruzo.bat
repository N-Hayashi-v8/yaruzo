@echo off
chcp 65001 >nul
rem ビルドしてサーバを立て、確認用にブラウザのタブで開く。止めるときはこの窓で Ctrl+C。
rem 普段の起動はここではなく、インストールした PWA（スタートメニューの「やるぞ！」）。
rem 一度これで開いておけば Service Worker がキャッシュを更新するので、
rem 次からはこの窓なしで起動できる。
cd /d "%~dp0"

if not exist "node_modules" call npm install
if errorlevel 1 goto fail

call npm run build
if errorlevel 1 goto fail

rem 普通のタブで開く。--app の独立窓はインストール済み PWA とは別インスタンスになり、
rem どちらが「アプリ」なのか紛らわしいので使わない。ここはインストールと更新の確認用

rem サーバ起動待ちのあいだにタブを開く（ping で 4 秒待つ。timeout は入力を奪われると落ちる）
start "" /min cmd /c "ping -n 5 127.0.0.1 >nul & start http://localhost:3000"

call npm run start
if errorlevel 1 goto fail
exit /b 0

:fail
echo.
echo 起動に失敗しました。上のエラーを確認してください。
pause
exit /b 1
