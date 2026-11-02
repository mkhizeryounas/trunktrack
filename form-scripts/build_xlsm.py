import os, re, sys, shutil, tempfile, zipfile
import openpyxl
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule

sys.path.insert(0, os.path.dirname(__file__))
import vbabin

SRC, OUT = sys.argv[1], sys.argv[2]
DATA = 'New Trunks 2026 May'
S = f"'{DATA}'"

wb = openpyxl.load_workbook(SRC)
src = wb[DATA]
for n in ('Data Entry Form', 'Lists'):
    if n in wb.sheetnames:
        del wb[n]

# ---------------- Lists (hidden) ----------------
ls = wb.create_sheet('Lists')
regions = sorted({str(src[f'C{r}'].value).strip() for r in range(2, src.max_row + 1)
                  if src[f'C{r}'].value} - {'Gugrat'})
ls.append(['Regions', 'Trunks Type', 'Remarks'])
for i in range(max(len(regions), 2)):
    ls.append([regions[i] if i < len(regions) else None,
               ['New', 'Old'][i] if i < 2 else None,
               ['Clear', 'Pending'][i] if i < 2 else None])
ls.sheet_state = 'hidden'

# ---------------- Form ----------------
f = wb.create_sheet('Data Entry Form', 0)
wb.active = 0
f.sheet_view.showGridLines = False
f.sheet_view.zoomScale = 110

FONT = 'Calibri'
NAVY, BLUE, PALE = '1F3864', '2F5597', 'DCE6F2'
WHITE = PatternFill('solid', fgColor='FFFFFF')
for col, w in zip('ABCDEFGH', [2, 2, 30, 36, 2, 50, 2, 2]):
    f.column_dimensions[col].width = w
for r in range(1, 40):
    for c in range(1, 9):
        f.cell(r, c).fill = WHITE

def band(rng, text, fill, font, height=None, row=None):
    f.merge_cells(rng)
    cell = f[rng.split(':')[0]]
    cell.value = text
    cell.font = font
    cell.alignment = Alignment(vertical='center', indent=1)
    for row_cells in f[rng]:
        for c in row_cells:
            c.fill = PatternFill('solid', fgColor=fill)
    if height:
        f.row_dimensions[row].height = height

band('B2:G2', 'New Trunks 2026 May  |  Data Entry Form', NAVY,
     Font(name=FONT, size=20, bold=True, color='FFFFFF'), 40, 2)
band('B3:G3', 'Central Record Office  -  fill the white boxes, then click Submit Entry. Grey boxes fill in automatically.',
     PALE, Font(name=FONT, size=10, italic=True, color=NAVY), 22, 3)
f.row_dimensions[4].height = 10

in_side = Side(style='thin', color='A6A6A6')
auto_side = Side(style='thin', color='C9D3E3')
IN_BORDER = Border(left=in_side, right=in_side, top=in_side, bottom=in_side)
AUTO_BORDER = Border(left=auto_side, right=auto_side, top=auto_side, bottom=auto_side)

def section(row, text):
    f.merge_cells(f'C{row}:F{row}')
    c = f[f'C{row}']
    c.value = text
    c.font = Font(name=FONT, size=10, bold=True, color=BLUE)
    c.alignment = Alignment(vertical='bottom')
    for col in 'CDEF':
        f[f'{col}{row}'].border = Border(bottom=Side(style='medium', color=BLUE))
    f.row_dimensions[row].height = 24

def field(row, label, kind='input', value=None, hint=None, fmt=None):
    lc, vc, hc = f[f'C{row}'], f[f'D{row}'], f[f'F{row}']
    lc.value = label
    lc.font = Font(name=FONT, size=11, color='404040', bold=label.endswith('*'))
    lc.alignment = Alignment(vertical='center', indent=1)
    vc.value = value
    if kind == 'input':
        vc.font = Font(name=FONT, size=11, color='1F1F1F')
        vc.border = IN_BORDER
    else:
        vc.font = Font(name=FONT, size=11, italic=True, bold=True, color=NAVY)
        vc.fill = PatternFill('solid', fgColor='EEF3FA')
        vc.border = AUTO_BORDER
    vc.alignment = Alignment(horizontal='left', vertical='center', indent=1)
    if fmt:
        vc.number_format = fmt
    hc.value = hint
    hc.font = Font(name=FONT, size=9, italic=True, color='7F7F7F')
    hc.alignment = Alignment(vertical='center')
    f.row_dimensions[row].height = 24

section(6, 'BRANCH DETAILS')
field(7, 'Sr No (next)', 'auto', f'=MAX({S}!A:A)+1', 'Assigned automatically when you submit')
field(8, 'Branch Code *', hint='Whole number, e.g. 819')
field(9, 'Region *', hint=f'=IFERROR("Previously used for this branch: "&INDEX({S}!C:C,MATCH(D8,{S}!B:B,0)),"Pick from the list or type a new region")')
field(10, 'Date *', hint='dd/mm/yyyy', fmt='dd/mm/yyyy')
field(11, 'Trunks Type *', value='New', hint='Pick from the list')
f.row_dimensions[12].height = 8
section(13, 'TRUNKS')
field(14, 'Trunks Received *', hint='Whole number')
field(15, 'Stand Received', hint='Whole number')
f.row_dimensions[16].height = 8
section(17, 'INVOICE & PAYMENT')
field(18, 'Invoice Status', hint=f'=IF(AND(D18<>"",COUNTIF({S}!H:H,D18)>0),"WARNING: this invoice is already in the sheet","e.g. 819/I-960/18/9/2026")')
field(19, 'Invoice Amount *', hint='Amount in Rs', fmt='#,##0')
field(20, 'Payment Received', 'auto', '=IF(D19="","",D19-(D19*5.5%))', 'Invoice Amount less 5.5% (same formula as the main sheet)', fmt='#,##0')
field(21, 'Payment Transfar Date', hint='dd/mm/yyyy - leave blank if not paid yet', fmt='dd/mm/yyyy')
field(22, 'Remarks', value='Pending', hint='Clear / Pending')
f.row_dimensions[23].height = 12

# status pill
f.merge_cells('C24:F24')
st = f['C24']
st.value = '=IF(COUNTA(D8,D9,D10,D11,D14,D19)<6,"Fill in all required (*) fields to submit","Ready to submit - click Submit Entry")'
st.font = Font(name=FONT, size=11, bold=True, color='7F6000')
st.alignment = Alignment(horizontal='center', vertical='center')
for col in 'CDEF':
    f[f'{col}24'].fill = PatternFill('solid', fgColor='FFF2CC')
f.row_dimensions[24].height = 26
f.conditional_formatting.add('C24:F24', FormulaRule(
    formula=['COUNTA($D$8,$D$9,$D$10,$D$11,$D$14,$D$19)=6'],
    fill=PatternFill('solid', fgColor='E2EFDA', bgColor='E2EFDA'),
    font=Font(color='375623', bold=True)))
f.conditional_formatting.add('F18', FormulaRule(
    formula=['AND($D$18<>"",COUNTIF(' + S + '!$H:$H,$D$18)>0)'],
    font=Font(color='C00000', bold=True)))
f.row_dimensions[25].height = 10
f.row_dimensions[26].height = 20
f.row_dimensions[27].height = 20
f['C29'] = ('Tip: macros must be enabled. If Excel shows a yellow "Enable Content" bar, click it. '
            'If the file came by email/download, right-click it > Properties > tick "Unblock" first (Windows).')
f['C29'].font = Font(name=FONT, size=9, italic=True, color='7F7F7F')

# validation
def dv(cell, **kw):
    d = DataValidation(showErrorMessage=True, **kw)
    f.add_data_validation(d)
    d.add(cell)
n = len(regions) + 1
dv('D8', type='whole', operator='greaterThan', formula1='0', error='Branch code must be a whole number.')
dv('D9', type='list', formula1='RegionList', errorStyle='warning', error='New region? Click Yes - it will be added to the list when you submit.')
dv('D10', type='date', operator='greaterThan', formula1='36526', error='Enter a valid date (dd/mm/yyyy).')
dv('D21', type='date', operator='greaterThan', formula1='36526', error='Enter a valid date (dd/mm/yyyy).')
dv('D11', type='list', formula1='TypeList', error='Pick a value from the list.')
dv('D14', type='whole', operator='greaterThanOrEqual', formula1='0', error='Enter a whole number.')
dv('D15', type='whole', operator='greaterThanOrEqual', formula1='0', error='Enter a whole number.')
dv('D19', type='decimal', operator='greaterThanOrEqual', formula1='0', error='Enter an amount.')
dv('D22', type='list', formula1='RemarksList', errorStyle='warning', error='Not in the list. Click Yes to keep it anyway.')
f.sheet_view.selection[0].activeCell = 'D8'
f.sheet_view.selection[0].sqref = 'D8'

# code names (must match VBA document modules)
wb.code_name = 'ThisWorkbook'
codenames = []
for i, ws in enumerate(wb.worksheets, 1):
    ws.sheet_properties.codeName = f'Sheet{i}'
    codenames.append(f'Sheet{i}')

from openpyxl.workbook.properties import CalcProperties
from openpyxl.workbook.defined_name import DefinedName
for nm, col in (('RegionList','A'),('TypeList','B'),('RemarksList','C')):
    wb.defined_names[nm] = DefinedName(nm, attr_text=f'OFFSET(Lists!${col}$2,0,0,MAX(1,COUNTA(Lists!${col}:${col})-1),1)')
wb.calculation = CalcProperties(fullCalcOnLoad=True)
tmp_xlsx = tempfile.mktemp(suffix='.xlsx')
wb.save(tmp_xlsx)

# ---------------- VBA ----------------
VBA = r'''Attribute VB_Name = "DataEntry"
Option Explicit

Private Const FORM_SHEET As String = "Data Entry Form"
Private Const DATA_SHEET As String = "New Trunks 2026 May"

Public Sub SubmitEntry()
    Dim f As Worksheet, d As Worksheet
    Set f = ThisWorkbook.Worksheets(FORM_SHEET)
    Set d = ThisWorkbook.Worksheets(DATA_SHEET)

    Dim req As Variant, names As Variant, i As Long, missing As String
    req = Array("D8", "D9", "D10", "D11", "D14", "D19")
    names = Array("Branch Code", "Region", "Date", "Trunks Type", "Trunks Received", "Invoice Amount")
    For i = 0 To UBound(req)
        If Trim(CStr(f.Range(req(i)).Value)) = "" Then missing = missing & vbLf & "   - " & names(i)
    Next i
    If missing <> "" Then
        MsgBox "Please fill in:" & missing, vbExclamation, "Data Entry"
        Exit Sub
    End If
    If Not IsDate(f.Range("D10").Value) Then
        MsgBox "Date is not a valid date.", vbExclamation, "Data Entry"
        Exit Sub
    End If

    Dim inv As String
    inv = Trim(CStr(f.Range("D18").Value))
    If inv <> "" Then
        If Application.WorksheetFunction.CountIf(d.Range("H:H"), inv) > 0 Then
            If MsgBox("Invoice """ & inv & """ is already in the sheet." & vbLf & "Add it anyway?", _
                      vbYesNo + vbQuestion, "Data Entry") <> vbYes Then Exit Sub
        End If
    End If

    Dim lastRow As Long, r As Long
    lastRow = d.Cells(d.Rows.Count, "B").End(xlUp).Row
    r = lastRow + 1

    Application.ScreenUpdating = False
    d.Range("A" & lastRow & ":L" & lastRow).Copy
    d.Range("A" & r & ":L" & r).PasteSpecial xlPasteFormats
    Application.CutCopyMode = False

    d.Cells(r, 1).Value = Application.WorksheetFunction.Max(d.Range("A:A")) + 1
    d.Cells(r, 2).Value = f.Range("D8").Value
    d.Cells(r, 3).Value = f.Range("D9").Value
    d.Cells(r, 4).Value = f.Range("D10").Value
    d.Cells(r, 4).NumberFormat = "dd/mm/yyyy"
    d.Cells(r, 5).Value = f.Range("D11").Value
    d.Cells(r, 6).Value = f.Range("D14").Value
    d.Cells(r, 7).Value = f.Range("D15").Value
    d.Cells(r, 8).Value = f.Range("D18").Value
    d.Cells(r, 9).Value = f.Range("D19").Value
    d.Cells(r, 10).Formula = "=I" & r & "-(I" & r & "*5.5%)"
    If Trim(CStr(f.Range("D21").Value)) <> "" Then
        d.Cells(r, 11).Value = f.Range("D21").Value
        d.Cells(r, 11).NumberFormat = "dd/mm/yyyy"
    Else
        d.Cells(r, 11).ClearContents
    End If
    d.Cells(r, 12).Value = f.Range("D22").Value
    AddToList 1, CStr(f.Range("D9").Value)
    Application.ScreenUpdating = True

    Dim sr As Variant
    sr = d.Cells(r, 1).Value
    ClearForm
    MsgBox "Saved as Sr No " & sr & " (row " & r & " of '" & DATA_SHEET & "').", vbInformation, "Data Entry"
End Sub

' Adds a value to a column of the hidden Lists sheet if it is not there yet, then sorts that column.
Private Sub AddToList(ByVal col As Long, ByVal v As String)
    Dim ls As Worksheet, lastRow As Long
    v = Trim(v)
    If v = "" Then Exit Sub
    Set ls = ThisWorkbook.Worksheets("Lists")
    lastRow = ls.Cells(ls.Rows.Count, col).End(xlUp).Row
    If lastRow >= 2 Then
        If Application.WorksheetFunction.CountIf(ls.Range(ls.Cells(2, col), ls.Cells(lastRow, col)), v) > 0 Then Exit Sub
    End If
    ls.Cells(lastRow + 1, col).Value = v
    ls.Range(ls.Cells(2, col), ls.Cells(lastRow + 1, col)).Sort _
        Key1:=ls.Cells(2, col), Order1:=xlAscending, Header:=xlNo
End Sub

Public Sub ClearForm()
    Dim f As Worksheet
    Set f = ThisWorkbook.Worksheets(FORM_SHEET)
    f.Range("D8,D9,D10,D14,D15,D18,D19,D21").ClearContents
    f.Range("D11").Value = "New"
    f.Range("D22").Value = "Pending"
    f.Activate
    f.Range("D8").Select
End Sub
'''
THISWB = '''Private Sub Workbook_Open()
    On Error Resume Next
    ThisWorkbook.Worksheets("Data Entry Form").Activate
End Sub
'''
modules = [{'name': 'ThisWorkbook', 'type': 'doc', 'source': vbabin.doc_source('ThisWorkbook', 'workbook', THISWB)}]
modules += [{'name': cn, 'type': 'doc', 'source': vbabin.doc_source(cn, 'sheet')} for cn in codenames]
modules += [{'name': 'DataEntry', 'type': 'std', 'source': VBA}]
bin_path = tempfile.mktemp(suffix='.bin')
vbabin.build(modules, bin_path)

# ---------------- Drawing with buttons ----------------
EMU = 9525
def button(idx, name, text, macro, color, col, row0, row1, x0, x1):
    return f'''<xdr:twoCellAnchor editAs="absolute">
<xdr:from><xdr:col>{col}</xdr:col><xdr:colOff>{x0*EMU}</xdr:colOff><xdr:row>{row0}</xdr:row><xdr:rowOff>{2*EMU}</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>{col}</xdr:col><xdr:colOff>{x1*EMU}</xdr:colOff><xdr:row>{row1}</xdr:row><xdr:rowOff>{24*EMU}</xdr:rowOff></xdr:to>
<xdr:sp macro="[0]!{macro}" textlink="">
<xdr:nvSpPr><xdr:cNvPr id="{idx}" name="{name}"/><xdr:cNvSpPr/></xdr:nvSpPr>
<xdr:spPr><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="{color}"/></a:solidFill><a:ln><a:noFill/></a:ln>
<a:effectLst><a:outerShdw blurRad="38100" dist="19050" dir="5400000" algn="t" rotWithShape="0"><a:prstClr val="black"><a:alpha val="30000"/></a:prstClr></a:outerShdw></a:effectLst></xdr:spPr>
<xdr:txBody><a:bodyPr vertOverflow="clip" horzOverflow="clip" rtlCol="0" anchor="ctr"/><a:lstStyle/>
<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1200" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>{text}</a:t></a:r></a:p></xdr:txBody>
</xdr:sp><xdr:clientData/></xdr:twoCellAnchor>'''

drawing = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
           '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" '
           'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
           + button(2, 'btnSubmit', 'Submit Entry', 'SubmitEntry', '2E7D32', 3, 25, 26, 0, 250)
           + button(3, 'btnClear', 'Clear Form', 'ClearForm', '7F7F7F', 2, 25, 26, 70, 205)
           + '</xdr:wsDr>')

# ---------------- Repackage as .xlsm ----------------
zin = zipfile.ZipFile(tmp_xlsx)
files = {n: zin.read(n) for n in zin.namelist()}
zin.close()

wbxml = files['xl/workbook.xml'].decode()
rels = files['xl/_rels/workbook.xml.rels'].decode()
rid = re.search(r'<sheet [^>]*name="Data Entry Form"[^>]*r:id="(rId\d+)"', wbxml).group(1)
target = re.search(rf'<Relationship [^>]*Id="{rid}"[^>]*/>', rels).group(0)
target = re.search(r'Target="([^"]+)"', target).group(1).lstrip('/')
sheet_path = target if target.startswith('xl/') else 'xl/' + target
sheet_file = os.path.basename(sheet_path)
assert not any(n.startswith('xl/drawings/') for n in files), 'unexpected existing drawings'

rels = rels.replace('</Relationships>',
    '<Relationship Id="rIdVBA1" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>')
files['xl/_rels/workbook.xml.rels'] = rels.encode()
files['xl/vbaProject.bin'] = open(bin_path, 'rb').read()
files['xl/drawings/drawing1.xml'] = drawing.encode()

sheet_rels_path = f'xl/worksheets/_rels/{sheet_file}.rels'
rel_entry = ('<Relationship Id="rIdDrw1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" '
             'Target="../drawings/drawing1.xml"/>')
if sheet_rels_path in files:
    files[sheet_rels_path] = files[sheet_rels_path].decode().replace('</Relationships>', rel_entry + '</Relationships>').encode()
else:
    files[sheet_rels_path] = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rel_entry + '</Relationships>').encode()

sx = files[sheet_path].decode()
R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
if f'xmlns:r="{R_NS}"' not in sx:
    sx = re.sub(r'<worksheet ', f'<worksheet xmlns:r="{R_NS}" ', sx, count=1)
# <drawing> goes after pageMargins/pageSetup/headerFooter (schema order)
m = None
for tag in ('headerFooter', 'pageSetup', 'pageMargins'):
    m = re.search(rf'<{tag}\b[^>]*/>|<{tag}\b.*?</{tag}>', sx, re.S)
    if m:
        break
assert m, 'pageMargins not found'
sx = sx[:m.end()] + '<drawing r:id="rIdDrw1"/>' + sx[m.end():]
files[sheet_path] = sx.encode()

ct = files['[Content_Types].xml'].decode()
ct = ct.replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
                'application/vnd.ms-excel.sheet.macroEnabled.main+xml')
assert 'macroEnabled' in ct
if 'Extension="bin"' not in ct:
    ct = ct.replace('<Default ', '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/><Default ', 1)
ct = ct.replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" '
                'ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>')
files['[Content_Types].xml'] = ct.encode()

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    order = ['[Content_Types].xml'] + [n for n in files if n != '[Content_Types].xml']
    for n in order:
        z.writestr(n, files[n])
os.remove(tmp_xlsx); os.remove(bin_path)
print('wrote', OUT, '| form sheet part:', sheet_path, '| regions:', len(regions))
