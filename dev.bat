@echo off
rem 開発サーバを起動してブラウザで開く。閉じるときはこの窓で Ctrl+C。
cd /d "%~dp0"

if not exist "node_modules" (
  echo 依存が未インストール。npm install を実行します。
  call npm install || exit /b 1
)

rem サーバ起動待ちのあいだにブラウザを開く（別プロセス）
start "" /b cmd /c "timeout /t 4 >nul & explorer http://localhost:3000"

npm run dev
