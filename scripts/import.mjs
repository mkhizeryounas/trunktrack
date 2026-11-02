// Loads the MIS workbook into Supabase.
//   npm run import -- data.xlsx           shows what would be imported (nothing is written)
//   npm run import -- data.xlsx --yes     replaces ALL app data with the workbook (one transaction)
import fs from 'node:fs'
import { parseWorkbook } from '../lib/importer.js'
import { db, check } from '../lib/db.js'

const file = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!file) { console.error('Usage: npm run import -- <workbook.xlsx> [--yes]'); process.exit(1) }

const { branches, deliveries, summary, warnings } = await parseWorkbook(fs.readFileSync(file))
const { count } = await db().from('trunk_deliveries').select('id', { count: 'exact', head: true })
console.log(`Workbook: ${summary.deliveries} deliveries, ${summary.branches} branches, ${summary.trunks} trunks, ${summary.billed} on the billing list, Rs ${summary.invoiced.toLocaleString()} invoiced`)
console.log(`Matched ${summary.matched} May rows to Trunks Status; region lookups from: ${summary.lookupSheets.join(', ') || 'none'}`)
for (const w of warnings) console.log('  ! ' + w)
console.log(`The app currently holds ${count ?? 0} deliveries.`)

if (!process.argv.includes('--yes')) {
  console.log('\nDry run only. Add --yes to replace all app data with this workbook.')
  process.exit(0)
}
check(await db().rpc('trunk_replace_all', { p_branches: branches, p_deliveries: deliveries }), 'Importing')
console.log(`\nImported ${deliveries.length} deliveries for ${branches.length} branches.`)
