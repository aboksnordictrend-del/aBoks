# GA4 Enhanced Ecommerce — GTM Setup Guide

**Container:** GTM-NZ6VFSN9  
**GA4 Measurement ID:** G-5HH9N0J6BD (existing tag named "GA4 Admin")  
**Events pushed by the site:** `view_item`, `add_to_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`

---

## 1. Create Variable: DLV - ecommerce

**GTM → Variables → User-Defined Variables → New**

| Field | Value |
|---|---|
| Variable Name | `DLV - ecommerce` |
| Variable Type | Data Layer Variable |
| Data Layer Variable Name | `ecommerce` |
| Data Layer Version | Version 2 |
| Set Default Value | off |

Save.

---

## 2. Create Triggers (7 total)

**GTM → Triggers → New** — repeat for each row below.

| Trigger Name | Trigger Type | Event Name |
|---|---|---|
| `CE - view_item` | Custom Event | `view_item` |
| `CE - add_to_cart` | Custom Event | `add_to_cart` |
| `CE - view_cart` | Custom Event | `view_cart` |
| `CE - begin_checkout` | Custom Event | `begin_checkout` |
| `CE - add_shipping_info` | Custom Event | `add_shipping_info` |
| `CE - add_payment_info` | Custom Event | `add_payment_info` |
| `CE - purchase` | Custom Event | `purchase` |

Settings for each:
- **Use regex matching:** off
- **This trigger fires on:** All Custom Events

Save after each.

---

## 3. Create Tags (7 total)

**GTM → Tags → New** — repeat for each event below.

### Tag template (same for all 7):

| Field | Value |
|---|---|
| Tag Type | Google Analytics: GA4 Event |
| Measurement ID | `G-5HH9N0J6BD` |
| Event Name | *(see table below)* |
| Event Parameters → Add Row | Name: `ecommerce` / Value: `{{DLV - ecommerce}}` |
| Firing Trigger | *(see table below)* |

> **About Measurement ID:** If GTM shows a dropdown "Send event using settings from", select the existing **GA4 Admin** Google Tag instead of entering the ID manually — both work.

### Tags:

| Tag Name | Event Name | Firing Trigger |
|---|---|---|
| `GA4 Event - view_item` | `view_item` | `CE - view_item` |
| `GA4 Event - add_to_cart` | `add_to_cart` | `CE - add_to_cart` |
| `GA4 Event - view_cart` | `view_cart` | `CE - view_cart` |
| `GA4 Event - begin_checkout` | `begin_checkout` | `CE - begin_checkout` |
| `GA4 Event - add_shipping_info` | `add_shipping_info` | `CE - add_shipping_info` |
| `GA4 Event - add_payment_info` | `add_payment_info` | `CE - add_payment_info` |
| `GA4 Event - purchase` | `purchase` | `CE - purchase` |

Save after each.

---

## 4. Verify in GTM Preview

1. GTM → **Preview** → enter `https://aboks.no`
2. Navigate to a product page → **Tags Fired** should show `GA4 Event - view_item`
3. Add to cart → `GA4 Event - add_to_cart`
4. Go to `/handlekurv` → `GA4 Event - view_cart`
5. Click "Gå til kassen" → `GA4 Event - begin_checkout`
6. Wait for Kustom checkout widget to load → `GA4 Event - add_shipping_info` + `GA4 Event - add_payment_info`
7. After test purchase → `/kasse/bekreftelse` → `GA4 Event - purchase`

Click any fired tag → **Variables** tab → confirm `DLV - ecommerce` has an object with `currency`, `value`, `items`.

---

## 5. Verify in GA4 DebugView

1. Open **GA4 → Admin → DebugView**
2. Open the site in the same browser (GTM Preview must be active)
3. Trigger any event — it appears in DebugView within seconds
4. Click the event → confirm `ecommerce` parameter is present with correct data

---

## 6. Publish

GTM → **Submit** → add version name (e.g. "GA4 Ecommerce events") → **Publish**.

---

## dataLayer format reference

The site pushes events in this format (see `src/lib/analytics.ts`):

```js
// Clear previous ecommerce data first (always)
window.dataLayer.push({ ecommerce: null })

// Then push the event
window.dataLayer.push({
  event: 'view_item',           // matches the Custom Event trigger
  ecommerce: {
    currency: 'NOK',
    value: 399,
    items: [
      {
        item_id: 'variant-id',
        item_name: 'aBoks',
        item_variant: 'Olivengrønn',
        item_category: 'Battery Organizer',
        price: 399,
        quantity: 1,
      }
    ]
  }
})
```

`purchase` additionally includes `transaction_id`, `shipping`, `tax` inside `ecommerce`.  
`DLV - ecommerce` (Data Layer Variable) reads the `ecommerce` key from this push.
