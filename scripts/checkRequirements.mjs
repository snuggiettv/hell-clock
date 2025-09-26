import fs from 'node:fs';

const file = process.argv[2];
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const zero = Object.entries(data)
  .filter(([id, v]) => {
    const r = v?.requirements || {};
    return (r.Red|0)===0 && (r.Green|0)===0 && (r.Blue|0)===0;
  })
  .map(([id, v]) => ({ id, name: v.name }));

console.log('Zeroed entries:', zero);
if (zero.length === 1 && zero[0].id === '1') {
  console.log('✅ Only ID "1" is zeroed. Looks good.');
} else {
  console.log('⚠️ Expected only ID "1" to be zeroed.');
}
