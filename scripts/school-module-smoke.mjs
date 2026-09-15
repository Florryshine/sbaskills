import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCsv, rowsToCsv } from '../lib/school/csv.js';
import { koboFromNaira, nairaFromKobo } from '../lib/school/paystack.js';

const parsed = parseCsv('full_name,email,student_level\n"Okafor, Chidera Jr.",chidera@example.com,SS1\nAmina Bello,amina@example.com,SS2');
assert.equal(parsed.length, 2);
assert.equal(parsed[0].full_name, 'Okafor, Chidera Jr.');
assert.equal(parsed[1].student_level, 'SS2');
const roundTrip = rowsToCsv(['full_name', 'email'], [{ full_name: 'Okafor, Chidera Jr.', email: 'x@example.com' }]);
assert.match(roundTrip, /"Okafor, Chidera Jr\."/);
assert.equal(koboFromNaira(100), 10000);
assert.equal(nairaFromKobo(10000), 100);
console.log('school-module-smoke: PASS');
