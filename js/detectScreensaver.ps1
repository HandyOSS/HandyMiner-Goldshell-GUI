strComputer = "atl-dc-01"

Set objWMIService = GetObject("winmgmts:\\" & strComputer & "\root\cimv2")
Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process")
For Each objProcess in colProcesses
    If Right(objProcess.Name, 4) = ".scr" Then
        Wscript.Echo "The screen saver " & objProcess.Name & " is running."
        Wscript.Echo "Screen saver start time: " & objProcess.CreationDate
        Wscript.Quit
    End If
Next
Wscript.Echo "The screen saver is not running.""