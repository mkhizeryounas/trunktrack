Attribute VB_Name = "DataEntry"
' Excel desktop: Submit for the "Data Entry Form" sheet.
' Setup: Alt+F11 > File > Import File... > SubmitEntry.bas
'        Developer > Insert > Button (Form Control) on the form sheet, then assign macro SubmitEntry
'        Save the workbook as .xlsm (Excel Macro-Enabled Workbook)
Option Explicit

Private Const FORM_SHEET As String = "Data Entry Form"
Private Const DATA_SHEET As String = "New Trunks 2026 May"

Public Sub SubmitEntry()
    Dim f As Worksheet, d As Worksheet
    Set f = ThisWorkbook.Worksheets(FORM_SHEET)
    Set d = ThisWorkbook.Worksheets(DATA_SHEET)

    Dim req, names, i As Long, missing As String
    req = Array("C5", "C6", "C7", "C8", "C9", "C12")
    names = Array("Branch Code", "Region", "Date", "Trunks Type", "Trunks Received", "Invoice Amount")
    For i = 0 To UBound(req)
        If Trim(CStr(f.Range(req(i)).Value)) = "" Then missing = missing & vbLf & "  - " & names(i)
    Next i
    If missing <> "" Then
        MsgBox "Please fill:" & missing, vbExclamation, "Data Entry"
        Exit Sub
    End If

    Dim inv As String
    inv = Trim(CStr(f.Range("C11").Value))
    If inv <> "" Then
        If Application.WorksheetFunction.CountIf(d.Range("H:H"), inv) > 0 Then
            If MsgBox("Invoice """ & inv & """ already exists. Add anyway?", vbYesNo + vbQuestion, "Data Entry") <> vbYes Then Exit Sub
        End If
    End If

    Dim lastRow As Long, r As Long
    lastRow = d.Cells(d.Rows.Count, "B").End(xlUp).Row
    r = lastRow + 1

    d.Range("A" & lastRow & ":L" & lastRow).Copy
    d.Range("A" & r & ":L" & r).PasteSpecial xlPasteFormats
    Application.CutCopyMode = False

    d.Cells(r, 1).Value = Application.WorksheetFunction.Max(d.Range("A:A")) + 1
    d.Cells(r, 2).Value = f.Range("C5").Value
    d.Cells(r, 3).Value = f.Range("C6").Value
    d.Cells(r, 4).Value = f.Range("C7").Value
    d.Cells(r, 4).NumberFormat = "dd/mm/yyyy"
    d.Cells(r, 5).Value = f.Range("C8").Value
    d.Cells(r, 6).Value = f.Range("C9").Value
    d.Cells(r, 7).Value = f.Range("C10").Value
    d.Cells(r, 8).Value = f.Range("C11").Value
    d.Cells(r, 9).Value = f.Range("C12").Value
    d.Cells(r, 10).Formula = "=I" & r & "-(I" & r & "*5.5%)"
    If f.Range("C14").Value <> "" Then
        d.Cells(r, 11).Value = f.Range("C14").Value
        d.Cells(r, 11).NumberFormat = "dd/mm/yyyy"
    End If
    d.Cells(r, 12).Value = f.Range("C15").Value

    f.Range("C5,C6,C7,C9,C10,C11,C12,C14").ClearContents
    f.Range("C8").Value = "New"
    f.Range("C15").Value = "Pending"
    f.Range("C5").Select
    MsgBox "Saved as Sr No " & d.Cells(r, 1).Value & " (row " & r & ")", vbInformation, "Data Entry"
End Sub
