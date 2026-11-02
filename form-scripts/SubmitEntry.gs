/**
 * Google Sheets: Submit for the "Data Entry Form" sheet.
 * Adds the form values as a new row on "New Trunks 2026 May".
 *
 * Setup (one time):
 *  1. File > Save as Google Sheets (Apps Script does not run on an .xlsx file).
 *  2. Extensions > Apps Script, paste this file, then Save.
 *  3. Reload the sheet. A "Data Entry" menu appears, with "Submit Entry".
 *     Optional: Insert > Drawing (a button), then ⋮ > Assign script > submitEntry
 */
const FORM_SHEET = 'Data Entry Form';
const DATA_SHEET = 'New Trunks 2026 May';
// Form cell for each data column A..L (null = calculated here)
const MAP = [null, 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', null, 'C14', 'C15'];
const REQUIRED = { C5: 'Branch Code', C6: 'Region', C7: 'Date', C8: 'Trunks Type', C9: 'Trunks Received', C12: 'Invoice Amount' };
const INPUTS = ['C5', 'C6', 'C7', 'C9', 'C10', 'C11', 'C12', 'C14'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Data Entry').addItem('Submit Entry', 'submitEntry').addToUi();
}

function submitEntry() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActive();
  const form = ss.getSheetByName(FORM_SHEET);
  const data = ss.getSheetByName(DATA_SHEET);

  const missing = Object.keys(REQUIRED).filter(a => form.getRange(a).getValue() === '');
  if (missing.length) {
    ui.alert('Please fill: ' + missing.map(a => REQUIRED[a]).join(', '));
    return;
  }
  const invoice = form.getRange('C11').getValue();
  if (invoice !== '') {
    const found = data.getRange('H2:H').getValues().flat().some(v => String(v).trim() === String(invoice).trim());
    if (found && ui.alert('Invoice "' + invoice + '" already exists. Add anyway?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  }

  // last row that has a Branch Code
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

  INPUTS.forEach(a => form.getRange(a).clearContent());
  form.getRange('C8').setValue('New');
  form.getRange('C15').setValue('Pending');
  form.getRange('C5').activate();
  ss.toast('Saved as Sr No ' + values[0] + ' (row ' + row + ')', 'Data Entry', 5);
}
