@echo off
REM 项目固定工具链：把 node v22.22.1 目录注入 PATH 最前（pnpm/vitest 子进程会读 PATH）
set "PATH=D:\DevTools\nvm\v22.22.1;%PATH%"
set "NO_UPDATE_NOTIFIER=1"
%*
