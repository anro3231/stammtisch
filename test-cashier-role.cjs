const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const admin = read('app.js');
const reader = read('lesen.js');
const sql = read('supabase/kassier-role.sql');

assert.equal(admin.includes('Aktives Mitglied'), false, 'Admin UI must not show active-member label');
assert.equal(admin.includes('Archiviertes Mitglied'), false, 'Admin UI must not show archived-member label');
assert.equal(reader.includes('Aktives Mitglied'), false, 'Reader UI must not show active-member label');
assert.equal(reader.includes('Archiviertes Mitglied'), false, 'Reader UI must not show archived-member label');

assert.match(admin, /function memberRoleBadgesHTML/);
assert.match(admin, /memberRoleBadgesHTML\(m\)/);
assert.match(admin, /name="cashier-/);
assert.match(admin, /is_cashier:!p\.is_admin&&fd\.has/);
assert.match(admin, /roles=readerProfiles\.filter/);

assert.match(reader, /function memberRoleBadgesHTML/);
assert.match(reader, /profile\?\.is_cashier===true/);
assert.match(reader, /fantastix_cashier_read/);
assert.match(reader, /fantastix_cashier_update/);
assert.match(reader, /data-cashier-form="fine"/);
assert.match(reader, /data-cashier-form="payment"/);
assert.match(reader, /data-cashier-form="cash-expense"/);
assert.match(reader, /data-cashier-form="cash-balance"/);

assert.match(sql, /ADD COLUMN IF NOT EXISTS is_cashier boolean/);
assert.match(sql, /private\.is_fantastix_cashier\(\)/);
assert.match(sql, /public\.fantastix_cashier_read/);
assert.match(sql, /public\.fantastix_cashier_update/);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.fantastix_cashier_update/);
assert.match(sql, /v_amount IS NULL/);
assert.match(sql, /v_target IS NULL/);

console.log('Cashier role static checks passed.');
