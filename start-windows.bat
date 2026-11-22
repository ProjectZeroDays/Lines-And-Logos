@echo off
title Lines ^& Logos Business OS
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install from https://nodejs.org then re-run this file.
  pause
  exit /b 1
)
start "" http://localhost:3001
node server.js
pause
