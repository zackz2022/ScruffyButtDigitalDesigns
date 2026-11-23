

js
// worker.js — Scruffy Butt storefront backend (single file)
// PayPal checkout + affiliate tracking in one module. No imports.
//
// Bindings required:
// PAYPAL_CLIENT_ID secret
// PAYPAL_CLIENT_SECRET secret
// PAYPAL_ENVIRONMENT plain text "sandbox" | "live"
// STORE_ORIGIN plain text https://zackz2022.github.io
// AFFILIATE_ADMIN_TOKEN secret
// AFFILIATES_DB D1 database

const BOOK_PRICE = 29;
const BOOK_COUNT = 56;
const MAX_QUANTITY = 20;
const PAYPAL_API = {
live: "https://api-m.paypal.com",
sandbox: "https://api-m.sandbox.paypal.com"
};
const BOOK_ORDER_MARKER = "SBDD_DIGITAL_BOOK_ORDER";

// ---------------------------------------------------------------------------
// Affiliate commission tiers
// ---------------------------------------------------------------------------
// An affiliate reaches a tier when they hit EITHER the sales count OR the click
// count for it. The rate is locked onto each order the moment it is credited,
// so a later tier change never rewrites past commissions.
const TIERS = [
{ name: "Starter", minSales: 0, minClicks: 0, rate: 0.08 },
{ name: "Bronze", minSales: 15, minClicks: 1000, rate: 0.1 },
{ name: "Silver", minSales: 40, minClicks: 3000, rate: 0.12 },
{ name: "Gold", minSales: 75, minClicks: 8000, rate: 0.15 }
];

const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;
const MIN_PASSWORD_LENGTH = 8;

function tierFor(sales, clicks) {
let current = TIERS[0];
for (const tier of TIERS) {
if (sales >= tier.minSales || clicks >= tier.minClicks) current = tier;
}
return current;
}

function nextTierFor(sales, clicks) {
const current = tierFor(sales, clicks);
const index = TIERS.findIndex(t => t.name === current.name);
return TIERS[index + 1] || null;
}

function tierProgress(sales, clicks) {
const current = tierFor(sales, clicks);
const next = nextTierFor(sales, clicks);
if (!next) {
return { current, next: null, salesToNext: 0, clicksToNext: 0 };
}
return {
current,
next,
salesToNext: Math.max(0, next.minSales - sales),
clicksToNext: Math.max(0, next.minClicks - clicks)
};
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function corsHeaders(origin, storeOrigin) {
return {
...(origin === storeOrigin
? { "Access-Control-Allow-Origin": origin }
: {}),
"Access-Control-Allow-Methods": "POST, OPTIONS",
"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
"Access-Control-Max-Age": "86400",
Vary: "Origin"
};
}

function json(data, status, origin, storeOrigin) {
return new Response(JSON.stringify(data), {
status,
headers: {
"Content-Type": "application/json",
"Cache-Control": "no-store",
...corsHeaders(origin, storeOrigin)
}
});
}

async function readJson(request) {
try {
return await request.json();
} catch {
return null;
}
}

// ---------------------------------------------------------------------------
// PayPal
// ---------------------------------------------------------------------------

async function getAccessToken(env, apiBase) {
const credentials = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
const response = await fetch(`${apiBase}/v1/oauth2/token`, {
method: "POST",
headers: {
Authorization: `Basic ${credentials}`,
"Content-Type": "application/x-www-form-urlencoded"
},
body: "grant_type=client_credentials"
});

if (!response.ok) {
throw new Error(`PayPal authentication failed (${response.status})`);
}

const data = await response.json();
if (typeof data.access_token !== "string") {
throw new Error("PayPal authentication response did not include a token");
}
return data.access_token;
}

async function paypalRequest(apiBase, path, method, token, body) {
const response = await fetch(`${apiBase}${path}`, {
method,
headers: {
Authorization: `Bearer ${token}`,
"Content-Type": "application/json"
},
...(body ? { body: JSON.stringify(body) } : {})
});
const data = await response.json();

if (!response.ok) {
throw new Error(`PayPal API request failed (${response.status})`);
}
return data;
}

function validateCart(cart) {
if (!Array.isArray(cart) || cart.length === 0 || cart.length > BOOK_COUNT) {
throw new Error("Your cart is empty or invalid.");
}

const seen = new Set();
let totalItems = 0;
const items = cart.map(item => {
const id = Number(item?.id);
const quantity = Number(item?.quantity);
const name = typeof item?.name === "string" ? item.name.trim() : "";

if (
!Number.isInteger(id) ||
id < 1 ||
id > BOOK_COUNT ||
!Number.isInteger(quantity) ||
quantity < 1 ||
quantity > MAX_QUANTITY ||
seen.has(id) ||
name.length === 0 ||
name.length > 127
) {
throw new Error("Your cart contains an invalid book or quantity.");
}

seen.add(id);
totalItems += quantity;
return { id, quantity, name };
});

return {
items,
total: totalItems * BOOK_PRICE
};
}

function isVerifiedCapture(order, capture) {
const payment = capture.purchase_units?.[0]?.payments?.captures?.[0];
const expected = order.purchase_units?.[0]?.amount;

return order.purchase_units?.[0]?.custom_id === BOOK_ORDER_MARKER &&
capture.status === "COMPLETED" &&
payment?.status === "COMPLETED" &&
payment?.amount?.currency_code === "USD" &&
payment?.amount?.value === expected?.value &&
expected?.currency_code === "USD";
}
js
// ---------------------------------------------------------------------------
// Affiliate helpers
// ---------------------------------------------------------------------------

function normalizeCode(value) {
if (typeof value !== "string") return "";
let raw = value.trim();
if (!raw) return "";
try {
if (/^https?:\/\//i.test(raw)) {
const url = new URL(raw);
raw = url.searchParams.get("ref") || url.pathname.split("/").filter(Boolean).pop() || "";
}
} catch {
/* treat as a bare code */
}
return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
}

function toCents(amount) {
const value = typeof amount === "number" ? amount : Number.parseFloat(String(amount));
if (!Number.isFinite(value) || value < 0) return 0;
return Math.round(value * 100);
}

function isValidEmail(email) {
return typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function hex(buffer) {
return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
const encoder = new TextEncoder();
const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits(
{ name: "PBKDF2", salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
key,
256
);
return hex(bits);
}

function constantTimeEqual(a, b) {
if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
let diff = 0;
for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
return diff === 0;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(length = 8) {
const bytes = crypto.getRandomValues(new Uint8Array(length));
return [...bytes].map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function generateToken() {
return hex(crypto.getRandomValues(new Uint8Array(32)));
}

function trackingLink(env, code) {
const base = (env.STORE_ORIGIN || "").split(",")[0].trim().replace(/\/+$/, "");
return `${base}/?ref=${encodeURIComponent(code)}`;
}

async function authenticate(request, db) {
const header = request.headers.get("Authorization") || "";
const match = header.match(/^Bearer\s+(.+)$/i);
if (!match) return null;

return db
.prepare(
`SELECT a.id, a.email, a.code, a.status
FROM sessions s
JOIN affiliates a ON a.id = s.affiliate_id
WHERE s.token = ?1 AND s.expires_at > datetime('now') AND a.status = 'active'`
)
.bind(match[1].trim())
.first();
}

async function createSession(db, affiliateId) {
const token = generateToken();
await db
.prepare(
`INSERT INTO sessions (token, affiliate_id, expires_at)
VALUES (?1, ?2, datetime('now', '+${SESSION_DAYS} days'))`
)
.bind(token, affiliateId)
.run();
return token;
}

async function affiliateTotals(db, affiliateId) {
const clicks = await db
.prepare("SELECT COUNT(*) AS n FROM clicks WHERE affiliate_id = ?1")
.bind(affiliateId)
.first();

const sales = await db
.prepare(
`SELECT COUNT(*) AS sales,
COALESCE(SUM(amount_cents), 0) AS revenue_cents,
COALESCE(SUM(commission_cents), 0) AS commission_cents
FROM affiliate_orders
WHERE affiliate_id = ?1 AND status = 'credited'`
)
.bind(affiliateId)
.first();

const paid = await db
.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS paid_cents FROM payouts WHERE affiliate_id = ?1")
.bind(affiliateId)
.first();

const clickCount = clicks?.n ?? 0;
const saleCount = sales?.sales ?? 0;
const commissionCents = sales?.commission_cents ?? 0;
const paidCents = paid?.paid_cents ?? 0;

return {
clicks: clickCount,
sales: saleCount,
revenue_cents: sales?.revenue_cents ?? 0,
commission_cents: commissionCents,
paid_cents: paidCents,
balance_cents: commissionCents - paidCents,
conversion_rate: clickCount > 0 ? Number(((saleCount / clickCount) * 100).toFixed(2)) : 0,
...tierProgress(saleCount, clickCount)
};
}
js
// ---------------------------------------------------------------------------
// Affiliate endpoints
// ---------------------------------------------------------------------------

async function recordClick(request, db, json) {
const body = await readJson(request);
const code = normalizeCode(body?.code);
if (!code) return json({ error: "A referral code is required." }, 400);

const affiliate = await db
.prepare("SELECT id FROM affiliates WHERE code = ?1 AND status = 'active'")
.bind(code)
.first();
if (!affiliate) return json({ error: "Unknown referral code." }, 404);

await db
.prepare("INSERT INTO clicks (code, affiliate_id, path, referrer, country) VALUES (?1, ?2, ?3, ?4, ?5)")
.bind(
code,
affiliate.id,
typeof body?.path === "string" ? body.path.slice(0, 512) : null,
typeof body?.referrer === "string" ? body.referrer.slice(0, 512) : null,
request.headers.get("CF-IPCountry") || null
)
.run();

return json({ ok: true }, 200);
}

async function signup(request, env, db, json) {
const body = await readJson(request);
const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
const password = typeof body?.password === "string" ? body.password : "";

if (!isValidEmail(email)) return json({ error: "Enter a valid email address." }, 400);
if (password.length < MIN_PASSWORD_LENGTH) {
return json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, 400);
}

const existing = await db.prepare("SELECT id FROM affiliates WHERE email = ?1").bind(email).first();
if (existing) return json({ error: "An affiliate account already exists for that email." }, 409);

const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
const passwordHash = await hashPassword(password, salt);

let code = "";
for (let attempt = 0; attempt < 6; attempt++) {
const candidate = generateCode();
const taken = await db.prepare("SELECT id FROM affiliates WHERE code = ?1").bind(candidate).first();
if (!taken) {
code = candidate;
break;
}
}
if (!code) return json({ error: "Could not allocate a referral code. Try again." }, 503);

const inserted = await db
.prepare("INSERT INTO affiliates (email, code, password_hash, salt) VALUES (?1, ?2, ?3, ?4)")
.bind(email, code, passwordHash, salt)
.run();

const affiliateId = inserted?.meta?.last_row_id;
const token = await createSession(db, affiliateId);

return json(
{
token,
affiliate: { id: affiliateId, email, code },
link: trackingLink(env, code)
},
201
);
}

async function login(request, db, json) {
const body = await readJson(request);
const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
const password = typeof body?.password === "string" ? body.password : "";
if (!email || !password) return json({ error: "Email and password are required." }, 400);

const affiliate = await db
.prepare("SELECT id, email, code, password_hash, salt, status FROM affiliates WHERE email = ?1")
.bind(email)
.first();

if (!affiliate || affiliate.status !== "active") {
return json({ error: "Invalid email or password." }, 401);
}

const candidate = await hashPassword(password, affiliate.salt);
if (!constantTimeEqual(candidate, affiliate.password_hash)) {
return json({ error: "Invalid email or password." }, 401);
}

const token = await createSession(db, affiliate.id);
return json({
token,
affiliate: { id: affiliate.id, email: affiliate.email, code: affiliate.code }
}, 200);
}

async function affiliateMe(env, db, affiliate, json) {
const totals = await affiliateTotals(db, affiliate.id);
return json(
{
affiliate: { id: affiliate.id, email: affiliate.email, code: affiliate.code },
link: trackingLink(env, affiliate.code),
totals
},
200
);
}

async function affiliateOrders(db, affiliate, json) {
const rows = await db
.prepare(
`SELECT order_id, amount_cents, commission_cents, rate, tier, status, created_at, credited_at
FROM affiliate_orders
WHERE affiliate_id = ?1
ORDER BY created_at DESC
LIMIT 200`
)
.bind(affiliate.id)
.all();
return json({ orders: rows?.results ?? [] }, 200);
}

async function affiliatePayouts(db, affiliate, json) {
const rows = await db
.prepare(
`SELECT id, amount_cents, note, created_at
FROM payouts
WHERE affiliate_id = ?1
ORDER BY created_at DESC
LIMIT 200`
)
.bind(affiliate.id)
.all();
return json({ payouts: rows?.results ?? [] }, 200);
}

async function adminOverview(db, json) {
const totals = await db
.prepare(
`SELECT COUNT(*) AS orders,
COALESCE(SUM(amount_cents), 0) AS revenue_cents,
COALESCE(SUM(commission_cents), 0) AS commission_cents
FROM affiliate_orders
WHERE status = 'credited'`
)
.first();

const clicks = await db.prepare("SELECT COUNT(*) AS n FROM clicks").first();
const affiliates = await db.prepare("SELECT COUNT(*) AS n FROM affiliates").first();
const paid = await db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS n FROM payouts").first();

const revenueCents = totals?.revenue_cents ?? 0;
const commissionCents = totals?.commission_cents ?? 0;

return json(
{
totals: {
affiliates: affiliates?.n ?? 0,
clicks: clicks?.n ?? 0,
attributed_orders: totals?.orders ?? 0,
revenue_cents: revenueCents,
commission_cents: commissionCents,
net_cents: revenueCents - commissionCents,
paid_out_cents: paid?.n ?? 0,
unpaid_cents: commissionCents - (paid?.n ?? 0)
}
},
200
);
}

async function adminAffiliates(db, json) {
const rows = await db
.prepare(
`SELECT a.id, a.email, a.code, a.status, a.created_at,
(SELECT COUNT(*) FROM clicks c WHERE c.affiliate_id = a.id) AS clicks,
(SELECT COUNT(*) FROM affiliate_orders o WHERE o.affiliate_id = a.id AND o.status = 'credited') AS sales,
(SELECT COALESCE(SUM(o.amount_cents), 0) FROM affiliate_orders o WHERE o.affiliate_id = a.id AND o.status = 'credited') AS revenue_cents,
(SELECT COALESCE(SUM(o.commission_cents), 0) FROM affiliate_orders o WHERE o.affiliate_id = a.id AND o.status = 'credited') AS commission_cents,
(SELECT COALESCE(SUM(p.amount_cents), 0) FROM payouts p WHERE p.affiliate_id = a.id) AS paid_cents
FROM affiliates a
ORDER BY commission_cents DESC
LIMIT 500`
)
.all();

const affiliates = (rows?.results ?? []).map(row => {
const tier = tierFor(row.sales ?? 0, row.clicks ?? 0);
return {
...row,
tier: tier.name,
rate: tier.rate,
balance_cents: (row.commission_cents ?? 0) - (row.paid_cents ?? 0)
};
});

return json({ affiliates }, 200);
}

async function adminOrders(db, json) {
const rows = await db
.prepare(
`SELECT o.order_id, o.code, o.amount_cents, o.commission_cents, o.rate, o.tier,
o.status, o.created_at, o.credited_at, a.email
FROM affiliate_orders o
LEFT JOIN affiliates a ON a.id = o.affiliate_id
ORDER BY o.created_at DESC
LIMIT 500`
)
.all();
return json({ orders: rows?.results ?? [] }, 200);
}

async function adminPayout(request, db, json) {
const body = await readJson(request);
const affiliateId = Number(body?.affiliateId);
const amountCents = toCents(body?.amount);

if (!Number.isInteger(affiliateId) || affiliateId < 1) {
return json({ error: "A valid affiliateId is required." }, 400);
}
if (amountCents < 1) return json({ error: "A positive payout amount is required." }, 400);

const affiliate = await db.prepare("SELECT id FROM affiliates WHERE id = ?1").bind(affiliateId).first();
if (!affiliate) return json({ error: "Affiliate not found." }, 404);

await db
.prepare("INSERT INTO payouts (affiliate_id, amount_cents, note) VALUES (?1, ?2, ?3)")
.bind(affiliateId, amountCents, typeof body?.note === "string" ? body.note.slice(0, 500) : null)
.run();

const totals = await affiliateTotals(db, affiliateId);
return json({ ok: true, balance_cents: totals.balance_cents }, 201);
}
js
async function affiliateApi(request, env, pathname, json) {
const db = env.AFFILIATES_DB;
if (!db) return json({ error: "Affiliate database is not configured." }, 503);

const route = pathname.replace(/^\/api\/affiliate/, "").replace(/\/+$/, "") || "/";
const method = request.method;

if (route === "/click" && method === "POST") return recordClick(request, db, json);
if (route === "/signup" && method === "POST") return signup(request, env, db, json);
if (route === "/login" && method === "POST") return login(request, db, json);

if (route.startsWith("/admin")) {
const expected = env.AFFILIATE_ADMIN_TOKEN;
const provided = request.headers.get("X-Admin-Token") || "";
if (!expected || !constantTimeEqual(provided, expected)) {
return json({ error: "Not authorized." }, 401);
}
if (route === "/admin/overview" && method === "GET") return adminOverview(db, json);
if (route === "/admin/affiliates" && method === "GET") return adminAffiliates(db, json);
if (route === "/admin/orders" && method === "GET") return adminOrders(db, json);
if (route === "/admin/payout" && method === "POST") return adminPayout(request, db, json);
return json({ error: "Endpoint not found." }, 404);
}

const affiliate = await authenticate(request, db);
if (!affiliate) return json({ error: "Not authorized." }, 401);

if (route === "/me" && method === "GET") return affiliateMe(env, db, affiliate, json);
if (route === "/link" && method === "GET") {
return json({ link: trackingLink(env, affiliate.code), code: affiliate.code }, 200);
}
if (route === "/orders" && method === "GET") return affiliateOrders(db, affiliate, json);
if (route === "/payouts" && method === "GET") return affiliatePayouts(db, affiliate, json);

return json({ error: "Endpoint not found." }, 404);
}

// ---------------------------------------------------------------------------
// Hooks called by the payment flow
// ---------------------------------------------------------------------------

async function rememberAffiliateOrder(db, orderId, referral) {
if (!db || typeof orderId !== "string") return;

const code = normalizeCode(referral);
if (!code) return;

const affiliate = await db
.prepare("SELECT id FROM affiliates WHERE code = ?1 AND status = 'active'")
.bind(code)
.first();
if (!affiliate) return;

await db
.prepare(
`INSERT OR IGNORE INTO affiliate_orders (order_id, affiliate_id, code, status)
VALUES (?1, ?2, ?3, 'pending')`
)
.bind(orderId, affiliate.id, code)
.run();
}

async function creditAffiliateOrder(db, orderId, amount) {
if (!db || typeof orderId !== "string") return;

const order = await db
.prepare("SELECT order_id, affiliate_id FROM affiliate_orders WHERE order_id = ?1 AND status = 'pending'")
.bind(orderId)
.first();
if (!order) return;

const amountCents = toCents(amount);
if (amountCents < 1) return;

const totals = await affiliateTotals(db, order.affiliate_id);
const tier = tierFor(totals.sales, totals.clicks);
const commissionCents = Math.round(amountCents * tier.rate);

await db
.prepare(
`UPDATE affiliate_orders
SET amount_cents = ?2,
commission_cents = ?3,
rate = ?4,
tier = ?5,
status = 'credited',
credited_at = datetime('now')
WHERE order_id = ?1 AND status = 'pending'`
)
.bind(orderId, amountCents, commissionCents, tier.rate, tier.name)
.run();
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default {
async fetch(request, env) {
const origin = request.headers.get("Origin") || "";
const storeOrigin = env.STORE_ORIGIN || "";
const url = new URL(request.url);

if (request.method === "OPTIONS") {
if (!storeOrigin || origin !== storeOrigin) {
return new Response(null, { status: 403 });
}
return new Response(null, {
status: 204,
headers: corsHeaders(origin, storeOrigin)
});
}

if (!storeOrigin || origin !== storeOrigin) {
return json({ error: "Origin not allowed." }, 403, origin, storeOrigin);
}

// Affiliate routes accept GET as well as POST, so they are dispatched
// before the POST-only guard below.
if (url.pathname.startsWith("/api/affiliate/")) {
try {
return await affiliateApi(request, env, url.pathname, (data, status) => json(data, status, origin, storeOrigin));
} catch {
return json({ error: "Affiliate service is unavailable." }, 503, origin, storeOrigin);
}
}

if (request.method !== "POST") {
return json({ error: "Method not allowed." }, 405, origin, storeOrigin);
}
if (!Object.hasOwn(PAYPAL_API, env.PAYPAL_ENVIRONMENT)) {
return json({ error: "PayPal environment is not configured." }, 503, origin, storeOrigin);
}
if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
return json({ error: "PayPal credentials are not configured." }, 503, origin, storeOrigin);
}

const apiBase = PAYPAL_API[env.PAYPAL_ENVIRONMENT];

try {
const token = await getAccessToken(env, apiBase);

if (url.pathname === "/api/orders") {
const body = await readJson(request);
if (!body) {
return json({ error: "Invalid request body." }, 400, origin, storeOrigin);
}

let cart;
try {
cart = validateCart(body?.cart);
} catch (error) {
return json({ error: error.message }, 400, origin, storeOrigin);
}

const order = await paypalRequest(apiBase, "/v2/checkout/orders", "POST", token, {
intent: "CAPTURE",
purchase_units: [{
custom_id: BOOK_ORDER_MARKER,
description: "Scruffy Butt Digital Books",
items: cart.items.map(item => ({
name: item.name,
sku: `BOOK-${item.id}`,
quantity: String(item.quantity),
category: "DIGITAL_GOODS",
unit_amount: {
currency_code: "USD",
value: BOOK_PRICE.toFixed(2)
}
})),
amount: {
currency_code: "USD",
value: cart.total.toFixed(2),
breakdown: {
item_total: {
currency_code: "USD",
value: cart.total.toFixed(2)
}
}
}
}]
});

if (typeof order.id !== "string") {
throw new Error("PayPal did not return an order ID");
}
await rememberAffiliateOrder(env.AFFILIATES_DB, order.id, body.referral);
return json({
id: order.id,
total: cart.total.toFixed(2)
}, 200, origin, storeOrigin);
}

const match = url.pathname.match(/^\/api\/orders\/([A-Za-z0-9-]+)\/capture$/);
if (!match) {
return json({ error: "Endpoint not found." }, 404, origin, storeOrigin);
}

const orderId = match[1];
const order = await paypalRequest(
apiBase,
`/v2/checkout/orders/${orderId}`,
"GET",
token
);
if (order.purchase_units?.[0]?.custom_id !== BOOK_ORDER_MARKER) {
return json({ error: "This is not a bookstore order." }, 400, origin, storeOrigin);
}

let capture;
if (order.status === "COMPLETED") {
capture = order;
} else if (order.status === "APPROVED") {
capture = await paypalRequest(
apiBase,
`/v2/checkout/orders/${orderId}/capture`,
"POST",
token
);
} else {
return json({ error: "Order is not approved for payment." }, 409, origin, storeOrigin);
}

if (!isVerifiedCapture(order, capture)) {
return json({
verified: false,
error: "PayPal could not verify the completed payment."
}, 409, origin, storeOrigin);
}

const amount = capture.purchase_units[0].payments.captures[0].amount.value;
try {
await creditAffiliateOrder(env.AFFILIATES_DB, orderId, amount);
} catch {
console.error("Affiliate commission needs reconciliation for order", orderId);
}
return json({
verified: true,
orderId,
status: "COMPLETED",
amount
}, 200, origin, storeOrigin);
} catch (error) {
console.error("Payment backend error:", error);
return json({ error: "Unable to process the PayPal request." }, 500, origin, storeOrigin);
}
}
};


