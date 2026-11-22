@echo off
REM Lines & Logos Business OS - launcher (Windows)
cd /d "%~dp0"
if "%PORT%"=="" set PORT=3001
echo Starting Lines & Logos Business OS on port %PORT% ...
node server.js
