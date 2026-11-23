const BOOK_PRICE = 29;
const BOOK_COUNT = 56;
const MAX_QUANTITY = 20;
const PAYPAL_API = {
  live: "https://api-m.paypal.com",
  sandbox: "https://api-m.sandbox.paypal.com"
};
const BOOK_ORDER_MARKER = "SBDD_DIGITAL_BOOK_ORDER";

function corsHeaders(origin, storeOrigin) {
  return {
    ...(origin === storeOrigin
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(data, status, origin, storeOrigin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin, storeOrigin)
    }
  });
}

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
        let body;
        try {
          body = await request.json();
        } catch {
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

      return json({
        verified: true,
        orderId,
        status: "COMPLETED",
        amount: capture.purchase_units[0].payments.captures[0].amount.value
      }, 200, origin, storeOrigin);
    } catch (error) {
      console.error("Payment backend error:", error);
      return json({ error: "Unable to process the PayPal request." }, 500, origin, storeOrigin);
    }
  }
};
