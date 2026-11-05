const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'localCommands.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const temp = path.join(os.tmpdir(), `suki-local-commands-${process.pid}.cjs`);
fs.writeFileSync(temp, compiled);
const { parseExpenseCommand, parseNoteCommand } = require(temp);
fs.rmSync(temp, { force: true });

const expenseCases = [
  ['Save this amount - 500 - cafe', 500, 'cafe'],
  ['Save the amount - 100 - restaurant', 100, 'restaurant'],
  ['Save the amount 100 Restaurant', 100, 'Restaurant'],
  ['save 100 for restaurant', 100, 'restaurant'],
  ['I spent ₹1,250 on groceries', 1250, 'groceries'],
  ['Add an expense of 500 for petrol', 500, 'petrol'],
  ['record expense 750 coffee', 750, 'coffee'],
  ['paid 90 at tea shop', 90, 'tea shop'],
  ['250 coffee', 250, 'coffee'],
  ['save 500 - cafe', 500, 'cafe'],
];
for (const [input, amount, category] of expenseCases) {
  assert.deepEqual(parseExpenseCommand(input), { amount, category }, `expense parse: ${input}`);
}
assert.equal(parseExpenseCommand('save zero for coffee'), null);
assert.equal(parseExpenseCommand('hello there'), null);
assert.equal(parseExpenseCommand('save 0 - cafe'), null);
assert.equal(parseNoteCommand('Note: call the dentist tomorrow'), 'call the dentist tomorrow');
assert.equal(parseNoteCommand('Remember to buy milk'), 'to buy milk');
assert.equal(parseNoteCommand('Save a note - pay electricity bill'), 'pay electricity bill');
assert.equal(parseNoteCommand('hello there'), null);
console.log(`Suki local command tests passed: ${expenseCases.length + 7}/${expenseCases.length + 7}`);
