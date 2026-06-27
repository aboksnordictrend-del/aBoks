# GA4 Enhanced Ecommerce — GTM Setup Guide

**Container:** GTM-NZ6VFSN9  
**GA4 Measurement ID:** G-5HH9N0J6BD (existing tag named "GA4 Admin")

---

## Что правильно: вариант 1, вариант 2 или что-то другое?

**Ни вариант 1, ни вариант 2 не являются рекомендованным подходом Google.**

Официальная документация Google (developers.google.com/tag-manager/ecommerce-ga4) рекомендует:

> "Under More Settings > Ecommerce, check **Send Ecommerce data**. For Data Source select **Data Layer**."

Когда этот флаг включён — GTM **автоматически** читает весь `ecommerce`-объект из dataLayer и маппит все поля в GA4. Вручную создавать переменные `DLV - ecommerce` или отдельные DLV для `currency`/`value`/`items` **не нужно**.

Итог:
| Вариант | Статус |
|---|---|
| Вариант 1: одна DLV `ecommerce` → параметр `ecommerce = {{DLV - ecommerce}}` | ❌ Не работает для GA4 ecommerce-отчётов. GA4 получит `ecommerce` как произвольный параметр (объект), а не как структурированные поля `items`, `currency`, `value` |
| Вариант 2: отдельные DLV для каждого поля | ⚠️ Работает, но избыточно и ошибкоопасно. Google не рекомендует |
| **Send Ecommerce data → Data Layer** | ✅ Официально рекомендованный подход Google |

---

## Формат dataLayer сайта — уже правильный

Сайт (`src/lib/analytics.ts`) пушит события в точно том формате, который Google требует:

```js
// Обязательный сброс перед каждым событием
window.dataLayer.push({ ecommerce: null })

// Само событие
window.dataLayer.push({
  event: 'view_item',       // GTM читает через {{Event}}
  ecommerce: {              // GTM читает через "Send Ecommerce data"
    currency: 'NOK',
    value: 399,
    items: [{ item_id: '...', item_name: '...', ... }]
  }
})
```

**Код сайта менять не нужно.**

---

## Настройка GTM: 1 тег + 1 триггер

Вместо 7 тегов и 7 триггеров достаточно одного тега с `{{Event}}` в качестве имени события.

### Шаг 1 — Создать триггер

**GTM → Triggers → New**

| Поле | Значение |
|---|---|
| Trigger Name | `CE - GA4 Ecommerce` |
| Trigger Type | Custom Event |
| Event Name | `view_item\|add_to_cart\|view_cart\|begin_checkout\|add_shipping_info\|add_payment_info\|purchase` |
| Use regex matching | ✅ включить |
| This trigger fires on | All Custom Events |

Save.

### Шаг 2 — Создать тег

**GTM → Tags → New**

| Поле | Значение |
|---|---|
| Tag Name | `GA4 Event - Ecommerce` |
| Tag Type | Google Analytics: GA4 Event |
| Measurement ID | `G-5HH9N0J6BD` |
| Event Name | `{{Event}}` ← встроенная переменная GTM |

Дальше в том же теге:

**More Settings → Ecommerce:**
| Поле | Значение |
|---|---|
| Send Ecommerce data | ✅ включить |
| Data Source | Data Layer |

**Firing Triggers:**
| Поле | Значение |
|---|---|
| Trigger | `CE - GA4 Ecommerce` |

Save.

> **`{{Event}}`** — это встроенная переменная GTM, которая читает поле `event` из текущего dataLayer-пуша. Когда сайт пушит `{event: 'view_item', ...}`, тег отправит событие с именем `view_item` в GA4. Один тег обрабатывает все 7 событий автоматически.

---

## Проверка в GTM Preview

1. GTM → **Preview** → открой `https://aboks.no`
2. Перейди на страницу товара → в панели Tags должен появиться `GA4 Event - Ecommerce` с event name `view_item`
3. Добавь товар → событие `add_to_cart`
4. `/handlekurv` → `view_cart`
5. "Gå til kassen" → `begin_checkout`
6. Kustom checkout загрузился → `add_shipping_info` + `add_payment_info`
7. Страница `/kasse/bekreftelse` → `purchase`

Кликни на сработавший тег → **Variables** → убедись, что `{{Event}}` показывает нужное имя события.

## Проверка в GA4 DebugView

**GA4 → Admin → DebugView** (тот же браузер, GTM Preview активен):

- Каждое событие появляется в реальном времени
- Нажми на `purchase` → должны быть параметры `transaction_id`, `value`, `currency`, `items`
- Нажми на `view_item` → должны быть `currency`, `value`, `items`

---

## Publish

GTM → **Submit** → название версии, например `GA4 Ecommerce tracking` → **Publish**.

---

## Источники

- [Measure ecommerce — Google Tag Manager](https://developers.google.com/tag-manager/ecommerce-ga4) — официальная документация с описанием "Send Ecommerce data"
- [GA4 ecommerce (GTM tab)](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce?client_type=gtm) — официальная документация Google Analytics
- [GA4 Ecommerce Guide for GTM — Simo Ahava](https://www.simoahava.com/analytics/google-analytics-4-ecommerce-guide-google-tag-manager/) — детальный разбор подходов
