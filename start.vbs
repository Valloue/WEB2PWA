Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Obtenir le répertoire du script
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Changer vers le répertoire de l'application
WshShell.CurrentDirectory = scriptDir

' Lancer l'application Electron de manière silencieuse
WshShell.Run "npm start", 0, False
