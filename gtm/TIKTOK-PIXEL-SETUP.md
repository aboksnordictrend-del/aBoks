# TikTok Pixel — GTM Setup / аудит

**Контейнер:** GTM-NZ6VFSN9
**TikTok Pixel ID:** `<TTQ_PIXEL_ID>` — подставить из TikTok Ads Manager → Assets → Events → Web Events
**Магазин:** aboks.no, валюта **NOK**

> Этот документ описывает только теги TikTok. Теги GA4 (`GA4 Event - Ecommerce`, `GA4 Admin`),
> Google Ads и Meta Pixel не затрагиваются — они читают тот же самый `ecommerce`-объект из
> dataLayer и продолжают работать без изменений.

---

## 1. Диагноз: откуда `value=0` и `currency=USD`

Сайт (`src/lib/analytics.ts`) пушит **все** ecommerce-события с `currency: 'NOK'` и реальным
`value`. Проверено по коду:

| dataLayer event | `ecommerce.value` | `ecommerce.currency` |
|---|---|---|
| `view_item` | `price` | `NOK` |
| `add_to_cart` | `price × quantity` | `NOK` |
| `view_cart` | `total` | `NOK` |
| `begin_checkout` | `total` | `NOK` |
| `add_shipping_info` | `total` | `NOK` |
| `add_payment_info` | `total` | `NOK` |
| `purchase` | `totalKr` (+ `transaction_id`) | `NOK` |

`purchase.value` = `kustomOrder.order_amount / 100` — фактическая сумма заказа из Kustom
(`src/app/(frontend)/kasse/actions.ts`, `getOrderConfirmation`).

Значит, `value=0` / `currency=USD` **не приходят с сайта**. Источников ровно два:

1. **Currency не замаплена.** В шаблоне TikTok Pixel поле `currency` — дропдаун со
   значением по умолчанию `USD`. Если его не переопределить переменной, TikTok получает USD
   независимо от того, что лежит в dataLayer.
2. **Тег висит на «All Pages» / «All Custom Events».** Тогда он срабатывает и на служебных
   пушах — `gtm.js`, `gtm.dom`, `gtm.load`, `gtm.historyChange`, а также на
   `cookie_consent_update` и прочих событиях CookieYes. В этих пушах нет объекта `ecommerce`,
   поэтому Value резолвится в `undefined` → TikTok подставляет `0`.

Оба лечатся конфигурацией контейнера. Код сайта менять не нужно.

---

## 2. Что вообще можно отправлять в TikTok

TikTok принимает закрытый список стандартных событий. Всё остальное попадает в отчёты как
«custom event» и **не участвует в оптимизации и атрибуции конверсий**.

Поддерживаемая e-commerce воронка и маппинг с dataLayer сайта:

| dataLayer event | TikTok event | Отправлять? |
|---|---|---|
| `view_item` | `ViewContent` | ✅ |
| `add_to_cart` | `AddToCart` | ✅ |
| `begin_checkout` | `InitiateCheckout` | ✅ |
| `add_payment_info` | `AddPaymentInfo` | ✅ |
| `purchase` | `CompletePayment` | ✅ основная конверсия |
| `view_cart` | — нет аналога | ❌ не отправлять |
| `add_shipping_info` | — нет аналога | ❌ не отправлять |
| `gtm.js`, `gtm.dom`, `gtm.load`, `gtm.historyChange` | — служебные | ❌ не отправлять |
| `cookie_consent_update` и прочие пуши CookieYes | — служебные | ❌ не отправлять |

> **`Purchase` в TikTok не существует.** Событие покупки называется **`CompletePayment`**
> (оплата прошла) либо `PlaceAnOrder` (заказ размещён). У aboks.no страница
> `/kasse/bekreftelse` открывается уже после успешной оплаты через Kustom, поэтому правильный
> вариант — `CompletePayment`. Если в теге сейчас стоит `Purchase` или режим «Automatic»
> (который прокидывает имя события из dataLayer как есть, т.е. `purchase`), TikTok не
> засчитывает это как конверсию.

---

## 3. Переменные

**GTM → Variables → User-Defined → New**

| Имя | Тип | Настройка |
|---|---|---|
| `DLV - ecommerce.value` | Data Layer Variable | Name: `ecommerce.value`, Version 2 |
| `DLV - ecommerce.currency` | Data Layer Variable | Name: `ecommerce.currency`, Version 2 |
| `DLV - ecommerce.transaction_id` | Data Layer Variable | Name: `ecommerce.transaction_id`, Version 2 |
| `DLV - ecommerce.items` | Data Layer Variable | Name: `ecommerce.items`, Version 2 |

### `LT - TikTok Event Name` (Lookup Table)

Тип: **Lookup Table**, Input Variable: `{{Event}}`.
Галочку «Set Default Value» **не ставить** — тогда на любом непредусмотренном событии
переменная вернёт `undefined`, что даёт второй уровень защиты от служебных пушей.

| Input | Output |
|---|---|
| `view_item` | `ViewContent` |
| `add_to_cart` | `AddToCart` |
| `begin_checkout` | `InitiateCheckout` |
| `add_payment_info` | `AddPaymentInfo` |
| `purchase` | `CompletePayment` |

### `JS - TikTok Contents` (Custom JavaScript)

GA4-формат `items` не совпадает с TikTok-форматом `contents` — нужна конвертация.
Одна переменная покрывает все события, включая многотоварные корзины.

```js
function () {
  var items = {{DLV - ecommerce.items}};
  if (!items || !items.length) return undefined;
  return items.map(function (i) {
    return {
      content_id: String(i.item_id),
      content_type: 'product',
      content_name: i.item_variant ? i.item_name + ' ' + i.item_variant : i.item_name,
      quantity: Number(i.quantity) || 1,
      price: Number(i.price) || 0
    };
  });
}
```

---

## 4. Триггеры

### `CE - TikTok Ecommerce` (основной)

**Trigger Type:** Custom Event

| Поле | Значение |
|---|---|
| Event Name | `^(view_item\|add_to_cart\|begin_checkout\|add_payment_info\|purchase)$` |
| Use regex matching | ✅ включить |
| This trigger fires on | Some Custom Events → `{{LT - TikTok Event Name}}` → **does not equal** → `undefined` |

Якоря `^…$` обязательны: без них regex `purchase` совпал бы и с гипотетическим
`purchase_failed`. Такой allow-list **по построению** не пропускает ни `gtm.*`, ни
`cookie_consent_update`, ни любое будущее служебное событие CookieYes — добавлять их в
исключения по одному не нужно и не требуется поддерживать список запрещённого.

> Обратите внимание: `view_cart` и `add_shipping_info` намеренно отсутствуют — у TikTok нет
> соответствующих стандартных событий, а как custom-события они только зашумляют отчёты.

### `BLK - Non-Ecommerce` (Blocking Trigger, страховка)

На случай, если кто-то позже повесит на тег дополнительный триггер:

**Trigger Type:** Custom Event, Event Name `.*` (regex), fires on **Some Custom Events**:

| Условие |
|---|
| `{{Event}}` — matches RegEx — `^(gtm\.\|cookie_consent\|cookieyes\|cky)` |

Добавить в теги TikTok как **Exception**.

---

## 5. Теги

### Тег 1 — `TikTok - Base Pixel` (загрузка пикселя)

| Поле | Значение |
|---|---|
| Tag Type | TikTok Pixel (шаблон из Community Template Gallery) |
| Pixel ID | `<TTQ_PIXEL_ID>` |
| Event | `Page View` (только базовая загрузка `ttq.load` + `ttq.page`) |
| Firing Trigger | All Pages |
| Tag firing priority | `10` (чтобы пиксель загрузился раньше event-тега) |

Никаких value/currency здесь быть не должно — это не конверсионное событие.

### Тег 2 — `TikTok - Ecommerce Events`

Шаблон TikTok Pixel в разных версиях по-разному называет поля, и дропдаун Currency в нём
жёстко ограничен списком. Надёжнее и прозрачнее — **Custom HTML**, где value и currency
задаются явно:

| Поле | Значение |
|---|---|
| Tag Type | Custom HTML |
| Firing Trigger | `CE - TikTok Ecommerce` |
| Exception | `BLK - Non-Ecommerce` |
| Tag firing option | **Once per event** |

```html
<script>
  (function () {
    var name = {{LT - TikTok Event Name}};
    if (!name || typeof window.ttq === 'undefined') return;

    var props = {
      value: Number({{DLV - ecommerce.value}}) || 0,
      currency: {{DLV - ecommerce.currency}} || 'NOK'
    };

    var contents = {{JS - TikTok Contents}};
    if (contents) props.contents = contents;

    var txn = {{DLV - ecommerce.transaction_id}};
    if (txn) {
      // event_id -> дедупликация между Pixel и Events API, если позже подключите серверный поток
      window.ttq.track(name, props, { event_id: String(txn) });
    } else {
      window.ttq.track(name, props);
    }
  })();
</script>
```

Фолбэк `|| 'NOK'` — только страховка: dataLayer всегда отдаёт `NOK`. Если в TikTok когда-либо
снова появится USD, значит тег сработал вне allow-list триггера.

> **Если предпочитаете остаться на шаблоне TikTok Pixel** вместо Custom HTML: в поле Currency
> нужно переключиться с дропдауна на **переменную** и подставить `{{DLV - ecommerce.currency}}`,
> в Value — `{{DLV - ecommerce.value}}`, в Event — `{{LT - TikTok Event Name}}`, в Contents —
> `{{JS - TikTok Contents}}`. Оставленный по умолчанию дропдаун Currency = USD и есть причина
> текущей проблемы.

---

## 6. Дедупликация purchase

На стороне сайта `trackPurchase` уже защищён от повторной отправки при перезагрузке страницы:
ключ `ga4_purchase_sent_<transaction_id>` в `localStorage` (`src/lib/analytics.ts`). Пуш в
dataLayer один на заказ, поэтому TikTok, GA4, Google Ads и Meta получают его ровно по разу —
отдельная защита для TikTok не нужна.

`event_id` в `ttq.track` пригодится, только если позже будет подключён TikTok Events API
(server-side): тогда браузерное и серверное событие схлопнутся по `transaction_id`.

---

## 7. Consent (CookieYes)

Баннер CookieYes (`src/app/(frontend)/layout.tsx`) управляет маркетинговыми тегами. Оба тега
TikTok должны быть под тем же consent-условием, что Meta Pixel — обычно
**Additional Consent Checks → Require additional consent for tag to fire → `ad_storage`**,
либо блокирующий триггер по состоянию CookieYes, если контейнер настроен так.

Важно: consent-механика CookieYes сама по себе пушит события в dataLayer
(`cookie_consent_update` и т.п.) — именно они и приводили к срабатываниям TikTok с
`value=0 / USD`. После перехода на allow-list триггер из §4 это исключено.

---

## 8. Проверка

### GTM Preview

1. GTM → **Preview** → `https://aboks.no`, принять cookies.
2. В левой колонке Summary пройти по служебным событиям — `Consent Initialization`,
   `Initialization`, `gtm.js`, `gtm.dom`, `gtm.load`, `cookie_consent_update`:
   в **Tags Fired** не должно быть `TikTok - Ecommerce Events`. Только `TikTok - Base Pixel`
   на `All Pages`.
3. Открыть карточку товара → событие `view_item` → тег сработал → вкладка **Variables**:

   | Переменная | Ожидаемое значение |
   |---|---|
   | `LT - TikTok Event Name` | `ViewContent` |
   | `DLV - ecommerce.currency` | `NOK` |
   | `DLV - ecommerce.value` | цена товара, не `0` и не `undefined` |
   | `JS - TikTok Contents` | массив с `content_id`, `content_type: "product"` |

4. Пройти воронку: добавить в корзину (`AddToCart`) → `/handlekurv` (**тег НЕ должен
   сработать** на `view_cart`) → «Gå til kassen» (`InitiateCheckout`) → Kustom checkout
   (`AddPaymentInfo`; на `add_shipping_info` тег **не срабатывает**) → `/kasse/bekreftelse`
   (`CompletePayment`).

### TikTok Pixel Helper (Chrome-расширение)

На странице `/kasse/bekreftelse` событие `CompletePayment` должно показывать:

```
value:    <фактическая сумма заказа>
currency: NOK
contents: [{ content_id: "<variantId>", content_type: "product", quantity: n, price: p }]
```

Сумма обязана совпадать с «Totalbeløp» на самой странице подтверждения и с `order_amount`
заказа в Kustom.

### TikTok Events Manager

**Assets → Events → Web Events → Test Event** — события приходят в реальном времени.
Через 24 ч проверить в обзоре, что колонка Revenue считается в NOK, а не в USD, и что в
списке событий нет `cookie_consent_update`, `gtm.js` и прочего мусора.

### Регрессия по остальным каналам

После публикации убедиться, что ничего не сломалось у соседей (менялись только теги TikTok,
но проверка дешёвая):

- **GA4 DebugView** — все 7 событий на месте, `purchase` с `transaction_id`, `value`, `items`.
- **Google Ads** — конверсия покупки регистрируется.
- **Meta Events Manager / Pixel Helper** — `Purchase` с NOK и корректной суммой.

---

## 9. Publish

GTM → **Submit** → версия, например `TikTok Pixel — ecommerce allow-list + NOK value` →
**Publish**.

---

## Источники

- [TikTok Pixel — Standard events](https://business-api.tiktok.com/portal/docs?id=1739585702922241) — закрытый список поддерживаемых событий
- [TikTok Pixel — Set up with Google Tag Manager](https://ads.tiktok.com/help/article/gtm-tiktok-pixel)
- [TikTok Events API — event deduplication](https://business-api.tiktok.com/portal/docs?id=1771101150038057) — назначение `event_id`
- `gtm/GA4-ECOMMERCE-SETUP.md` — конфигурация GA4 в том же контейнере
