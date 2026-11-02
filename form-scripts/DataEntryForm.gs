/**
 * Data Entry Form for "New Trunks 2026 May".
 * Run setupForm() once to build the form; then use menu Data Entry > Submit Entry.
 */
const FORM_SHEET = 'Data Entry Form';
const DATA_SHEET = 'New Trunks 2026 May';
const LIST_SHEET = 'Lists';
const MAP = [null, 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', null, 'C14', 'C15'];
const REQUIRED = { C5: 'Branch Code', C6: 'Region', C7: 'Date', C8: 'Trunks Type', C9: 'Trunks Received', C12: 'Invoice Amount' };
const INPUTS = ['C5', 'C6', 'C7', 'C9', 'C10', 'C11', 'C12', 'C14'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Data Entry')
    .addItem('Submit Entry', 'submitEntry')
    .addItem('Clear Form', 'clearForm')
    .addSeparator()
    .addItem('Rebuild Form', 'setupForm')
    .addToUi();
}

function setupForm() {
  const ss = SpreadsheetApp.getActive();
  const data = ss.getSheetByName(DATA_SHEET);
  [FORM_SHEET, LIST_SHEET].forEach(n => { const s = ss.getSheetByName(n); if (s) ss.deleteSheet(s); });

  // Lists (hidden)
  const last = data.getLastRow();
  const regions = [...new Set(data.getRange(2, 3, last - 1, 1).getValues().flat()
    .map(v => String(v).trim()).filter(v => v && v !== 'Gugrat'))].sort();
  const ls = ss.insertSheet(LIST_SHEET);
  ls.getRange('A1:C1').setValues([['Regions', 'Trunks Type', 'Remarks']]).setFontWeight('bold');
  ls.getRange(2, 1, regions.length, 1).setValues(regions.map(r => [r]));
  ls.getRange('B2:B3').setValues([['New'], ['Old']]);
  ls.getRange('C2:C3').setValues([['Clear'], ['Pending']]);
  ls.hideSheet();

  // Form
  const f = ss.insertSheet(FORM_SHEET, 0);
  f.setHiddenGridlines(true);
  f.setColumnWidth(1, 20); f.setColumnWidth(2, 200); f.setColumnWidth(3, 230); f.setColumnWidth(4, 340);
  f.getRange('A:D').setFontFamily('Times New Roman');
  f.getRange('B1').setValue('New Trunks 2026 May - Data Entry Form').setFontSize(16).setFontWeight('bold');
  f.getRange('B2:D2').merge().setValue('Fill the light-yellow cells (* = required), then use menu Data Entry > Submit Entry. Grey cells calculate automatically.')
    .setFontStyle('italic').setFontSize(10).setFontColor('#595959');

  const S = "'" + DATA_SHEET + "'";
  const rows = [
    [4, 'Sr No (next)', 'auto', '=MAX(' + S + '!A:A)+1', 'Assigned automatically on submit'],
    [5, 'Branch Code *', 'input', '', 'Whole number, e.g. 819'],
    [6, 'Region *', 'input', '', '=IFERROR("Previously used for this branch: "&INDEX(' + S + '!C:C,MATCH(C5,' + S + '!B:B,0)),"")'],
    [7, 'Date *', 'input', '', 'Date, dd/mm/yyyy'],
    [8, 'Trunks Type *', 'input', 'New', 'Pick from list'],
    [9, 'Trunks Received *', 'input', '', 'Whole number'],
    [10, 'Stand Received', 'input', '', 'Whole number'],
    [11, 'Invoice Status', 'input', '', '=IF(AND(C11<>"",COUNTIF(' + S + '!H:H,C11)>0),"WARNING: this invoice is already in the sheet","e.g. 819/I-960/18/9/2026")'],
    [12, 'Invoice Amount *', 'input', '', 'Amount in Rs'],
    [13, 'Payment Received', 'auto', '=IF(C12="","",C12-(C12*5.5%))', 'Invoice Amount less 5.5% (same as main sheet)'],
    [14, 'Payment Transfar Date', 'input', '', 'Date, dd/mm/yyyy (leave blank if not paid yet)'],
    [15, 'Remarks', 'input', 'Pending', 'Clear / Pending'],
  ];
  rows.forEach(([r, label, kind, val, hint]) => {
    f.getRange(r, 2).setValue(label).setFontWeight('bold').setBackground('#ffff00');
    f.getRange(r, 3).setValue(val).setBackground(kind === 'input' ? '#fff2cc' : '#e7e6e6').setHorizontalAlignment('center');
    f.getRange(r, 4).setValue(hint).setFontSize(10).setFontColor('#595959');
    f.setRowHeight(r, 26);
  });
  f.getRange('B4:C15').setBorder(true, true, true, true, true, true, '#808080', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');
  f.getRange('D11').setFontColor('#c00000');
  f.getRange('C7').setNumberFormat('dd/mm/yyyy'); f.getRange('C14').setNumberFormat('dd/mm/yyyy');
  f.getRange('C12:C13').setNumberFormat('#,##0');
  f.getRange('B17').setValue('Status').setFontWeight('bold');
  f.getRange('C17:D17').merge().setFormula('=IF(COUNTA(C5,C6,C7,C8,C9,C12)<6,"Fill all required (*) fields","Ready to submit")')
    .setFontWeight('bold').setFontColor('#1f4e79');

  const dv = SpreadsheetApp.newDataValidation;
  f.getRange('C5').setDataValidation(dv().requireNumberGreaterThan(0).setAllowInvalid(false).setHelpText('Whole number').build());
  f.getRange('C6').setDataValidation(dv().requireValueInRange(ls.getRange(2, 1, regions.length, 1), true).setAllowInvalid(true).build());
  [ 'C7', 'C14' ].forEach(a => f.getRange(a).setDataValidation(dv().requireDate().setAllowInvalid(false).setHelpText('Enter a valid date').build()));
  f.getRange('C8').setDataValidation(dv().requireValueInRange(ls.getRange('B2:B3'), true).setAllowInvalid(false).build());
  ['C9', 'C10'].forEach(a => f.getRange(a).setDataValidation(dv().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).setHelpText('Whole number').build()));
  f.getRange('C12').setDataValidation(dv().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).setHelpText('Amount').build());
  f.getRange('C15').setDataValidation(dv().requireValueInRange(ls.getRange('C2:C3'), true).setAllowInvalid(true).build());
  f.activate(); f.getRange('C5').activate();
}

function clearForm() {
  const f = SpreadsheetApp.getActive().getSheetByName(FORM_SHEET);
  INPUTS.forEach(a => f.getRange(a).clearContent());
  f.getRange('C8').setValue('New');
  f.getRange('C15').setValue('Pending');
  f.getRange('C5').activate();
}

function submitEntry() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActive();
  const form = ss.getSheetByName(FORM_SHEET);
  const data = ss.getSheetByName(DATA_SHEET);

  const missing = Object.keys(REQUIRED).filter(a => form.getRange(a).getValue() === '');
  if (missing.length) { ui.alert('Please fill: ' + missing.map(a => REQUIRED[a]).join(', ')); return; }
  const invoice = form.getRange('C11').getValue();
  if (invoice !== '') {
    const found = data.getRange('H2:H').getValues().flat().some(v => String(v).trim() === String(invoice).trim());
    if (found && ui.alert('Invoice "' + invoice + '" already exists. Add anyway?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  }

  const colB = data.getRange('B1:B' + data.getLastRow()).getValues();
  let last = colB.length;
  while (last > 1 && colB[last - 1][0] === '') last--;
  const row = last + 1;

  const srNos = data.getRange('A2:A' + Math.max(last, 2)).getValues().flat().filter(v => typeof v === 'number');
  const values = MAP.map(a => (a ? form.getRange(a).getValue() : ''));
  values[0] = (srNos.length ? Math.max(...srNos) : 0) + 1;
  values[9] = '=I' + row + '-(I' + row + '*5.5%)';

  data.getRange(last, 1, 1, 12).copyTo(data.getRange(row, 1, 1, 12), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  data.getRange(row, 1, 1, 12).setValues([values]);
  data.getRange(row, 4).setNumberFormat('dd/mm/yyyy');
  if (values[10] !== '') data.getRange(row, 11).setNumberFormat('dd/mm/yyyy');

  clearForm();
  ss.toast('Saved as Sr No ' + values[0] + ' (row ' + row + ')', 'Data Entry', 5);
}
