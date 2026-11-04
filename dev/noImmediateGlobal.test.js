/* eslint-env jest, node */
const path = require('path');
const { RuleTester } = require('eslint');
const rule = require('./eslint-multitab/lib/rules/no-immediate-global');

const filename = path.join(process.cwd(), 'src/global/example.ts');
const tester = new RuleTester({ parserOptions: { ecmaVersion: 2021 } });
tester.run('no-immediate-global', rule, {
  valid: [
    { filename, code: 'const global = getGlobal();' },
    { filename, code: 'let global = getGlobal(); global = getGlobal();' },
    { filename: path.join(process.cwd(), 'src/util/example.ts'), code: 'getGlobal().value;' },
  ],
  invalid: [
    { filename, code: 'getGlobal().value;', errors: [{ messageId: 'noImmediateGlobal' }] },
    { filename, code: 'const value = getGlobal();', errors: [{ messageId: 'noImmediateGlobal' }] },
  ],
});
