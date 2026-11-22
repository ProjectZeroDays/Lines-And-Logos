; ============================================================================
; Lines & Logos Business OS — Windows installer (NSIS)
;
;   Build:  makensis /V4 scripts/installer.nsi
;   Output: LinesAndLogos-BusinessOS-Setup.exe
;
; Bundles a portable Node.js runtime (node.exe) so no separate Node install is
; required. Installs the zero-dependency server, creates shortcuts, optionally
; opens firewall port 3001, and registers an uninstaller. First person to open
; http://localhost:3001/login.html creates the owner account.
; ============================================================================
Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

Name "Lines & Logos Business OS"
OutFile "LinesAndLogos-BusinessOS-Setup.exe"
InstallDir "$PROGRAMFILES64\Lines and Logos\Business OS"
InstallDirRegKey HKLM "Software\LinesAndLogos\BusinessOS" "InstallDir"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "payload\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!define MUI_COMPONENTSPAGE_SMALLDESC
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\bin\autodropshipstore.cmd"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Var StartMenuFolder

Section "!Lines & Logos Business OS" SecCore
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "payload\*.*"
  ; fresh server config if none exists (keys are added later in the app:
  ; Admin -> Keys & Integrations)
  IfFileExists "$INSTDIR\.env" skipEnv writeEnv
  writeEnv:
    FileOpen $0 "$INSTDIR\.env" w
    FileWrite $0 "# Lines & Logos Business OS$\r$\n"
    FileWrite $0 "PORT=3001$\r$\n"
    FileWrite $0 "# Add keys here OR use Admin -> Keys & Integrations in the app$\r$\n"
    FileClose $0
  skipEnv:
  ; register install location
  WriteRegStr HKLM "Software\LinesAndLogos\BusinessOS" "InstallDir" "$INSTDIR"
  ; uninstaller + Add/Remove Programs entry
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LinesAndLogosBusinessOS" "DisplayName" "Lines & Logos Business OS"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LinesAndLogosBusinessOS" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LinesAndLogosBusinessOS" "DisplayIcon" '"$INSTDIR\node.exe",0'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LinesAndLogosBusinessOS" "Publisher" "Lines & Logos"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LinesAndLogosBusinessOS" "URLInfoAbout" "https://linesandlogos.team"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LinesAndLogosBusinessOS" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LinesAndLogosBusinessOS" "NoRepair" 1

  ; --- CLI alias: autodropshipstore -------------------------------------
  ; bin\autodropshipstore.cmd starts the server (if needed) and opens the app.
  CreateDirectory "$INSTDIR\bin"
  FileOpen $0 "$INSTDIR\bin\autodropshipstore.cmd" w
  FileWrite $0 '@echo off$\r$\n'
  FileWrite $0 'REM autodropshipstore - Lines & Logos Business OS launcher$\r$\n'
  FileWrite $0 'REM Starts the server (if not running) and opens the app in your browser.$\r$\n'
  FileWrite $0 'setlocal$\r$\n'
  FileWrite $0 'cd /d "%~dp0.."$\r$\n'
  FileWrite $0 'set "PORT=3001"$\r$\n'
  FileWrite $0 'if exist ".env" for /f "usebackq tokens=2 delims==" %%a in (`findstr /b /c:"PORT=" .env`) do set "PORT=%%a"$\r$\n'
  FileWrite $0 'netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING >nul$\r$\n'
  FileWrite $0 'if errorlevel 1 start "Lines & Logos Business OS" /min "%~dp0..\node.exe" "%~dp0..\server.js"$\r$\n'
  FileWrite $0 'set /a TRIES=0$\r$\n'
  FileWrite $0 ':wait$\r$\n'
  FileWrite $0 'set /a TRIES+=1$\r$\n'
  FileWrite $0 'powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri ("http://localhost:%PORT%/api/health") -TimeoutSec 2).StatusCode } catch { 0 }" 2>nul ^| findstr "200" >nul$\r$\n'
  FileWrite $0 'if not errorlevel 1 goto open$\r$\n'
  FileWrite $0 'if %TRIES% lss 20 goto wait$\r$\n'
  FileWrite $0 ':open$\r$\n'
  FileWrite $0 'start "" "http://localhost:%PORT%/login.html"$\r$\n'
  FileClose $0

  ; add $INSTDIR\bin to the per-user PATH (once — marker in our uninstall key)
  ReadRegStr $1 HKLM "Software\LinesAndLogos\BusinessOS" "PathAdded"
  StrCmp $1 "1" donePathCLI addPathCLI
  addPathCLI:
    ReadRegStr $2 HKCU "Environment" "Path"
    StrCmp $2 "" setFreshPathCLI appendPathCLI
    setFreshPathCLI:
      WriteRegStr HKCU "Environment" "Path" "$INSTDIR\bin"
      Goto markPathCLI
    appendPathCLI:
      StrCpy $2 "$2;$INSTDIR\bin"
      WriteRegStr HKCU "Environment" "Path" $2
    markPathCLI:
      WriteRegStr HKLM "Software\LinesAndLogos\BusinessOS" "PathAdded" "1"
      ; tell Windows the environment changed (new terminals/Win+R pick it up)
      System::Call 'user32::SendMessageTimeoutW(i 0xffff, i 0x1a, i 0, w "Environment", i 0x2, i 5000, *i 0r0) ?e'
  donePathCLI:
  ; helper that uninstall uses to strip $INSTDIR\bin from the user PATH
  FileOpen $0 "$INSTDIR\bin\remove-path.ps1" w
  FileWrite $0 "$$p = [Environment]::GetEnvironmentVariable('Path','User')$\r$\n"
  FileWrite $0 "if ($$p) {$\r$\n"
  FileWrite $0 "  $$new = ($$p -split ';' | Where-Object { $$_ -and ($$_ -ne '$INSTDIR\bin') }) -join ';'$\r$\n"
  FileWrite $0 "  [Environment]::SetEnvironmentVariable('Path', $$new, 'User')$\r$\n"
  FileWrite $0 "}$\r$\n"
  FileClose $0
SectionEnd

Section "Desktop shortcut" SecDesktop
  CreateShortcut "$DESKTOP\Lines & Logos Business OS.lnk" "$INSTDIR\bin\autodropshipstore.cmd" "" "$INSTDIR\icons\app.ico" 0 SW_SHOWMINIMIZED
SectionEnd

Section "Start Menu shortcuts" SecStartMenu
  StrCpy $StartMenuFolder "Lines & Logos"
  CreateDirectory "$SMPROGRAMS\$StartMenuFolder"
  CreateShortcut "$SMPROGRAMS\$StartMenuFolder\Lines & Logos Business OS.lnk" "$INSTDIR\bin\autodropshipstore.cmd" "" "$INSTDIR\icons\app.ico" 0 SW_SHOWMINIMIZED
  CreateShortcut "$SMPROGRAMS\$StartMenuFolder\Start Server (no browser).lnk" "$INSTDIR\node.exe" "server.js" "$INSTDIR\node.exe" 0 SW_SHOWMINIMIZED
  CreateShortcut "$SMPROGRAMS\$StartMenuFolder\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Run at Windows startup" SecStartup
  CreateShortcut "$SMSTARTUP\Lines & Logos Business OS.lnk" "$INSTDIR\node.exe" "server.js" "$INSTDIR\node.exe" 0 SW_SHOWMINIMIZED
SectionEnd

Section "Open firewall port 3001" SecFirewall
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Lines & Logos Business OS" dir=in action=allow protocol=TCP localport=3001'
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} "The Business OS server, website, and a bundled Node.js runtime (~100 MB)."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} "Shortcuts to start the server and open the app."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "A desktop shortcut that launches the app (starts the server, opens your browser)."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartup} "Start the server automatically when Windows boots (runs minimized)."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecFirewall} "Allow other computers on the network to reach the app on port 3001."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  ; stop a running server before removing files
  nsExec::ExecToLog 'taskkill /F /IM node.exe /FI "WINDOWTITLE eq Lines*"'
  Delete "$SMSTARTUP\Lines & Logos Business OS.lnk"
  Delete "$SMPROGRAMS\Lines & Logos\Lines & Logos Business OS.lnk"
  Delete "$SMPROGRAMS\Lines & Logos\Start Server (no browser).lnk"
  Delete "$SMPROGRAMS\Lines & Logos\Uninstall.lnk"
  RMDir "$SMPROGRAMS\Lines & Logos"
  Delete "$DESKTOP\Lines & Logos Business OS.lnk"
  Delete "$INSTDIR\Uninstall.exe"
  ; remove $INSTDIR\bin from the per-user PATH (helper written at install time)
  IfFileExists "$INSTDIR\bin\remove-path.ps1" stripPath skipStripPath
  stripPath:
    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\bin\remove-path.ps1"'
    System::Call 'user32::SendMessageTimeoutW(i 0xffff, i 0x1a, i 0, w "Environment", i 0x2, i 5000, *i 0r0) ?e'
  skipStripPath:
  Delete "$INSTDIR\bin\autodropshipstore.cmd"
  Delete "$INSTDIR\bin\remove-path.ps1"
  RMDir "$INSTDIR\bin"
  ; keep data on uninstall unless user removes it via the prompt below
  MessageBox MB_YESNO|MB_ICONQUESTION "Remove all business data too (data folder: accounts, invoices, keys cache)?$\r$\nChoose No to keep it for a reinstall." IDNO keepData
    RMDir /r "$INSTDIR\data"
  keepData:
  RMDir /r "$INSTDIR\assets"
  RMDir /r "$INSTDIR\lib"
  RMDir /r "$INSTDIR\icons"
  RMDir /r "$INSTDIR\.well-known"
  Delete "$INSTDIR\*.html"
  Delete "$INSTDIR\*.png"
  Delete "$INSTDIR\*.webmanifest"
  Delete "$INSTDIR\sw.js"
  Delete "$INSTDIR\sitemap.xml"
  Delete "$INSTDIR\robots.txt"
  Delete "$INSTDIR\package.json"
  Delete "$INSTDIR\server.js"
  Delete "$INSTDIR\node.exe"
  Delete "$INSTDIR\*.md"
  RMDir "$INSTDIR"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LinesAndLogosBusinessOS"
  DeleteRegKey HKLM "Software\LinesAndLogos\BusinessOS"
SectionEnd
