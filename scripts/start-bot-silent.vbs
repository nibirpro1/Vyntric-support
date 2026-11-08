Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "d:\vyntric-support"
WshShell.Run "cmd.exe /c ""d:\vyntric-support\scripts\run-bot.bat""", 0, False
