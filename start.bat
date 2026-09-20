@echo off
setlocal
chcp 65001 >nul
title AI RPS - Quick Start
pushd "%~dp0"
if errorlevel 1 goto directory_error

set "RPS_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined RPS_NODE set "RPS_NODE=%%N"
if not defined RPS_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "RPS_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined RPS_NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "RPS_NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined RPS_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "RPS_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined RPS_NODE goto missing_node

"%RPS_NODE%" "%~dp0scripts\start.mjs" %*
set "RPS_EXIT=%ERRORLEVEL%"
popd
if not "%RPS_EXIT%"=="0" pause
exit /b %RPS_EXIT%

:missing_node
echo.
echo [ERROR] Node.js was not found.
echo Install Node.js 24 LTS from https://nodejs.org/ and run this file again.
popd
pause
exit /b 1

:directory_error
echo [ERROR] Unable to open the project folder.
pause
exit /b 1
