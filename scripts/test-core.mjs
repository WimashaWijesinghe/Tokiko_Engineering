// Writes fixture data. Run ONLY against a disposable imported copy.
import assert from 'node:assert/strict';
if(process.env.POS_TEST_CONFIRM !== 'DISPOSABLE_DB') throw new Error('Set POS_TEST_CONFIRM=DISPOSABLE_DB and use an isolated test database; this test writes records.');
const base=process.env.POS_TEST_URL || 'http://127.0.0.1:4500';
const tag='TEST-'+Date.now();
async function request(route,body) {const res=await fetch(base+'/api/'+route,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:res.status,body:await res.json()};}
async function ok(route,body){const r=await request(route,body);assert.equal(r.status,200,JSON.stringify(r));return r.body;}
const boot=()=>ok('bootstrap');
const initial=await boot();assert.equal(typeof initial.stats.totalRevenue,'number');
await ok('settings',{test_transaction:tag});
assert.equal((await boot()).settings.test_transaction,tag);
const name=tag+' Item';const serial=tag+'-SN1';
await ok('items',{name,stock_qty:0,buying_price:50,selling_price:100,warranty_months:12});
const grn=await ok('grns',{supplier_name:tag+' Supplier',items:[{item_name:name,qty:5,buying_price:50,selling_price:100,warranty_months:12,serial_numbers:[serial,tag+'-SN2']}]});
assert.ok(grn.grn_no);
let state=await boot();assert.equal(state.items.find(x=>x.name===name).stock_qty,5);
const line={item_name:name,item_description:'Unicode පරීක්ෂණ / quotation',qty:1,unit_price:100,item_discount:10,vat_rate:18,warranty_months:12,serial_numbers:[serial]};
const quote=await ok('quotations',{customer_name:tag+' Customer',customer_phone:tag,items:[line]});
await ok('quotations',{id:quote.id,customer_name:tag+' Customer',customer_phone:tag,subject:'Edited',items:[line]});
state=await boot();assert.equal(state.items.find(x=>x.name===name).stock_qty,5);
const invoice=await ok('invoices',{quotation_id:quote.id,customer_name:tag+' Customer',customer_phone:tag,paid_amount:20,payment_method:'Cheque',cheque_no:'123',cheque_bank:'Test',cheque_date:'2026-11-12',items:[line]});
state=await boot();let inv=state.invoices.find(x=>x.id===invoice.id);assert.equal(inv.grand_total,106.2);assert.equal(inv.balance_due,86.2);assert.equal(inv.tax_amount,16.2);assert.equal(state.items.find(x=>x.name===name).stock_qty,4);assert.equal(state.quotations.find(x=>x.id===quote.id).status,'INVOICED');
assert.notEqual((await request('quotations',{id:quote.id,items:[line]})).status,200);
assert.notEqual((await request('invoices',{quotation_id:quote.id,items:[{...line,serial_numbers:[]}]})).status,200);
const warranty=await ok('warranty-search?q='+encodeURIComponent(serial));assert.equal(warranty.results[0].invoice_id,invoice.id);assert.equal(warranty.results[0].status,'SOLD');assert.ok(warranty.results[0].warranty_expiry);
await Promise.all([ok('invoices/pay',{invoice_id:invoice.id,amount:10}),ok('invoices/pay',{invoice_id:invoice.id,amount:15})]);
inv=(await boot()).invoices.find(x=>x.id===invoice.id);assert.equal(inv.paid_amount,45);assert.equal(inv.balance_due,61.2);
await ok('invoices/pay',{invoice_id:invoice.id,amount:61.2});assert.equal((await boot()).invoices.find(x=>x.id===invoice.id).payment_status,'PAID');
assert.equal((await request('invoices/pay',{invoice_id:invoice.id,amount:-1})).status,400);assert.equal((await request('invoices/pay',{invoice_id:invoice.id,amount:1})).status,400);
// A late serial failure must undo header, lines, customer creation and stock.
const before=await boot();const fail=await request('invoices',{customer_name:tag+' ROLLBACK',items:[{...line,serial_numbers:[]},{...line,serial_numbers:[serial]}]});assert.notEqual(fail.status,200);
let after=await boot();assert.equal(after.invoices.length,before.invoices.length);assert.equal(after.customers.length,before.customers.length);assert.equal(after.items.find(x=>x.name===name).stock_qty,4);
assert.notEqual((await request('grns',{supplier_name:tag+' rollback supplier',items:[{item_name:name,qty:1,buying_price:999,serial_numbers:[serial]}]})).status,200);
after=await boot();assert.equal(after.grns.length,before.grns.length);assert.equal(after.suppliers.length,before.suppliers.length);assert.equal(after.items.find(x=>x.name===name).buying_price,50);
const concurrent=await Promise.all([request('invoices',{items:[{...line,serial_numbers:[tag+'-SN2']}]}),request('invoices',{items:[{...line,serial_numbers:[tag+'-SN2']}]})]);assert.equal(concurrent.filter(x=>x.status===200).length,1);assert.equal((await boot()).items.find(x=>x.name===name).stock_qty,3);
const concurrentCodes=await Promise.all([ok('invoices',{items:[{...line,serial_numbers:[]}]}),ok('invoices',{items:[{...line,serial_numbers:[]}]})]);assert.notEqual(concurrentCodes[0].invoice_no,concurrentCodes[1].invoice_no);
assert.equal((await request('invoices',{items:[{...line,qty:-1}]})).status,400);
const badSettings=await request('settings',{test_transaction:'must roll back',['x'.repeat(500)]: 'too long'});assert.notEqual(badSettings.status,200);assert.equal((await boot()).settings.test_transaction,tag);
// Preserve manual items/serials, multi-quotation conversion, and editing paths.
const editable=(await boot()).items.find(x=>x.name===name);
await ok('items',{id:editable.id,name,description:'Edited master',stock_qty:10,buying_price:50,selling_price:100,warranty_months:12});
assert.equal((await boot()).items.find(x=>x.id===editable.id).stock_qty,10);
const q1=await ok('quotations',{items:[{...line,serial_numbers:[]}]});
const q2=await ok('quotations',{items:[{...line,serial_numbers:[]}]});
const merged=await ok('invoices',{quotation_ids:[q1.id,q2.id],paid_amount:0,payment_method:'Credit',items:[{...line,qty:2,serial_numbers:[]}]});
const mergedState=await boot();assert.equal(mergedState.invoices.find(x=>x.id===merged.id).payment_status,'UNPAID');
assert.ok(mergedState.invoices.find(x=>x.id===merged.id).quote_no.includes(q1.quote_no));
assert.ok(mergedState.invoices.find(x=>x.id===merged.id).quote_no.includes(q2.quote_no));
assert.equal(mergedState.quotations.find(x=>x.id===q2.id).status,'INVOICED');
const manual=await ok('invoices',{payment_method:'Card',items:[{...line,item_name:tag+" O'Brien manual",serial_numbers:[tag+'-MANUAL']}]});
assert.equal((await boot()).invoices.find(x=>x.id===manual.id).payment_status,'PAID');
assert.equal((await ok('warranty-search?q='+encodeURIComponent(tag+'-MANUAL'))).results[0].invoice_id,manual.id);
console.log('PASS: bootstrap, Unicode settings, items, GRN/stock, quotation edit/conversion, VAT, cheque fields, partial/full/concurrent payments, warranty, rollback, duplicate serial protection, concurrent document numbering invalid inputs, item editing, merged quotations, credit/card and manual serials.');
