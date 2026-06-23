@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-submission-pack.ps1" %*
