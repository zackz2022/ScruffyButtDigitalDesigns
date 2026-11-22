// SCRUFFY BUTT DIGITAL DESIGNS
// PAYPAL SANDBOX PAYMENT BACKEND

const BOOK_PRICE = 29;
const MAX_QUANTITY = 20;

const STORE_URL =
"https://zackz2022.github.io";

const BOOK_COUNT = 17;

function corsHeaders(origin) {
const allowed =
origin === STORE_URL ? origin : "null";

return {
"Access-Control-Allow-Origin": allowed,
"Access-Control-Allow-Methods": "POST, OPTIONS",
"Access-Control-Allow-Headers": "Content-Type",
"Vary": "Origin"
};
}

function json(data, status = 200, origin = "") {
return new Response(JSON.stringify(data), {
status,
headers: {
"Content-Type": "application/json",
...corsHeaders(origin)
}
});
}

async function getAccessToken(env) {
const credentials = btoa(
env.PAYPAL_CLIENT_ID +
":" +
env.PAYPAL_CLIENT_SECRET
);

const response = await fetch(
"https://api-m.sandbox.paypal.com/v1/oauth2/token",
{
method: "POST",
headers: {
Authorization: "Basic " + credentials,
"Content-Type":
"application/x-www-form-urlencoded"
},
body: "grant_type=client_credentials"
}
);

if (!response.ok) {
throw new Error("PayPal authentication failed");
}

const data = await response.json();

return data.access_token;
}

async function paypalRequest(path, method, token, body) {
const response = await fetch(
"https://api-m.sandbox.paypal.com" + path,
{
method,
headers: {
Authorization: "Bearer " + token,
"Content-Type": "application/json"
},
...(body ? { body: JSON.stringify(body) } : {})
}
);

const data = await response.json();

if (!response.ok) {
throw new Error(
"PayPal API request failed: " + response.status
);
}

return data;
}

function validateCart(cart) {
if (!Array.isArray(cart) ||
cart.length === 0 ||
cart.length > BOOK_COUNT) {
throw new Error("Invalid shopping cart");
}

const seen = new Set();
let totalItems = 0;

const items = cart.map(item => {
const id = Number(item.id);
const quantity = Number(item.quantity);

if (
!Number.isInteger(id) ||
id < 1 ||
id > BOOK_COUNT ||
!Number.isInteger(quantity) ||
quantity < 1 ||
quantity > MAX_QUANTITY ||
seen.has(id)
) {
throw new Error("Invalid book or quantity");
}

seen.add(id);
totalItems += quantity;

return { id, quantity };
});

return {
items,
totalItems,
total: totalItems * BOOK_PRICE
};
}

export default {
async fetch(request, env) {
const origin = request.headers.get("Origin") || "";
const url = new URL(request.url);

if (request.method === "OPTIONS") {
if (origin !== STORE_URL) {
return new Response(null, { status: 403 });
}

return new Response(null, {
headers: corsHeaders(origin)
});
}

if (origin !== STORE_URL) {
return json(
{ error: "Origin not allowed" },
403,
origin
);
}

if (request.method !== "POST") {
return json(
{ error: "Method not allowed" },
405,
origin
);
}

if (
!env.PAYPAL_CLIENT_ID ||
!env.PAYPAL_CLIENT_SECRET ||
env.PAYPAL_ENVIRONMENT !== "sandbox"
) {
return json(
{ error: "Sandbox configuration missing" },
503,
origin
);
}

try {
const token = await getAccessToken(env);

// CREATE PAYPAL ORDER

if (url.pathname === "/api/orders") {
const body = await request.json();
const cart = validateCart(body.cart);

const order = await paypalRequest(
"/v2/checkout/orders",
"POST",
token,
{
intent: "CAPTURE",
purchase_units: [{
amount: {
currency_code: "USD",
value: cart.total.toFixed(2)
},
description:
"Scruffy Butt Digital Books"
}]
}
);

return json({
id: order.id,
total: cart.total.toFixed(2)
}, 200, origin);
}

// CAPTURE PAYPAL PAYMENT

const match = url.pathname.match(
/^\/api\/orders\/([A-Za-z0-9-]+)\/capture$/
);

if (match) {
const orderId = match[1];

const existing = await paypalRequest(
"/v2/checkout/orders/" + orderId,
"GET",
token
);

if (existing.status !== "APPROVED") {
return json({
error: "Order is not approved"
}, 409, origin);
}

const capture = await paypalRequest(
"/v2/checkout/orders/" +
orderId +
"/capture",
"POST",
token
);

const payment =
capture.purchase_units?.[0]
?.payments?.captures?.[0];

const expected =
existing.purchase_units?.[0]
?.amount;

const verified =
capture.status === "COMPLETED" &&
payment?.status === "COMPLETED" &&
payment?.amount?.currency_code === "USD" &&
payment?.amount?.value === expected?.value &&
expected?.currency_code === "USD";

return json({
verified,

orderId: capture.id,
status: capture.status,
amount: payment?.amount?.value || null
}, 200, origin);
}

return json(
{ error: "Endpoint not found" },
404,
origin
);

} catch (error) {
console.error("Payment backend error:", error);

return json({
error: "Unable to process payment request"
}, 500, origin);
}
}
};

