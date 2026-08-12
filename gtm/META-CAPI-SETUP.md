# Meta Conversions API + дедупликация с Pixel

**GTM-контейнер:** GTM-NZ6VFSN9
**Серверная часть:** реализована в коде — `src/lib/meta/capi/*`

| Событие | Кто отправляет серверную половину |
|---|---|
| `Purchase` | `src/app/api/kustom/webhook/route.ts` (push-вебхук Kustom) |
| `AddToCart` | `src/app/api/meta/event/route.ts` (браузер → наш сервер → Meta) |
| `InitiateCheckout` | `src/app/api/meta/event/route.ts` (то же) |

> Меняются только теги Meta. GA4, Google Ads, TikTok и Pinterest читают тот же самый
> `ecommerce`-объект из dataLayer и не затрагиваются.

---

## 1. Что уже делает код

Событие `Purchase` теперь отправляется **дважды одно и то же**, и Meta склеивает эти два в одну
конверсию по общему `event_id`:

| | Браузер (Pixel через GTM) | Сервер (Conversions API) |
|---|---|---|
| Когда | страница `/kasse/bekreftelse` отрисовалась | Kustom подтвердил `status === 'checkout_complete'` |
| Зависит от | согласия на куки, отсутствия блокировщика, возврата покупателя на сайт | ничего из этого |
| `event_id` | `purchase_<kustomOrderId>` | `purchase_<kustomOrderId>` |

Именно поэтому серверное событие и нужно: после оплаты через Vipps покупатель часто не
возвращается в ту же вкладку, и браузерное событие не срабатывает вовсе. Push-вебхук Kustom
приходит независимо от браузера.

`event_id` строится из **Kustom order ID**, а не из `AB-xxxxxx`: номер заказа записывает вебхук,
и на момент первого рендера страницы подтверждения его может ещё не быть. Kustom ID есть в URL
подтверждения с первой миллисекунды и совпадает с тем, с которым вызывается вебхук.

Клиентский код кладёт его в dataLayer рядом с `event`:

```js
dataLayer.push({ ecommerce: null })
dataLayer.push({
  event: 'purchase',
  event_id: 'purchase_7f3c1a90-…',   // ← новое поле, верхний уровень
  ecommerce: { transaction_id: 'AB-000123', value: 748, currency: 'NOK', items: [ … ] },
})
```

`transaction_id` для GA4 остался прежним. Email и телефон в dataLayer **не передаются** — они
попадают в Meta только с сервера, и только в виде SHA-256.

---

## 2. Что нужно сделать руками в GTM

Пока эти два шага не выполнены, **дедупликация не работает**: Meta будет считать браузерное и
серверное событие двумя разными конверсиями и завысит их количество примерно вдвое.

### Шаг 1 — Data Layer Variable

**Variables → User-Defined Variables → New**

| Поле | Значение |
|---|---|
| Variable Name | `DLV - event_id` |
| Variable Type | Data Layer Variable |
| Data Layer Variable Name | `event_id` |
| Data Layer Version | Version 2 |
| Default Value | *(оставить пустым)* |

Имя переменной в dataLayer — ровно `event_id`, без префикса `ecommerce.`: поле лежит на верхнем
уровне push'а, рядом с `event`.

### Шаг 2 — передать её в Meta Pixel Purchase

Дальше зависит от того, как у вас сейчас настроен тег Purchase.

**Вариант А — шаблон «Facebook Pixel» из Community Template Gallery**

В теге Purchase раскрыть **More Settings → Event ID** (в части шаблонов поле называется
`Event ID` в разделе `Advanced Settings`) и подставить `{{DLV - event_id}}`.

**Вариант Б — Custom HTML тег**

```html
<script>
  (function () {
    var eventId = {{DLV - event_id}};
    fbq('track', 'Purchase', {
      value: {{DLV - ecommerce.value}},
      currency: 'NOK',
      contents: {{DLV - meta contents}},   // если используете
      content_type: 'product'
    }, eventId ? { eventID: eventId } : undefined);
  })();
</script>
```

Ключ называется `eventID` — именно в таком регистре. `event_id`, `eventId` или `event-id` Meta
проигнорирует, и дедупликации не будет.

Триггер тега — Custom Event `purchase` (тот же, что у GA4-тега покупки). Consent-условие
оставить прежним.

### Шаг 3 — проверка перед публикацией

1. GTM → **Preview**, пройти тестовый заказ до страницы подтверждения.
2. В Tag Assistant на событии `purchase` открыть тег Meta Purchase → вкладка **Variables** →
   у `{{DLV - event_id}}` должно быть значение вида `purchase_7f3c1a90-…`, а не `undefined`.
3. Meta Pixel Helper → у события Purchase должен присутствовать `eventID` с тем же значением.
4. GTM → **Submit**, версия, например `Meta Pixel — event_id для дедупликации с CAPI`.

---

## 2.1. AddToCart и InitiateCheckout

Работают по той же схеме, что и Purchase, с одним отличием: **event ID генерирует браузер**.
У покупки есть естественный ключ (Kustom order ID), из которого обе стороны вычисляют один и
тот же `event_id`, ни разу его друг другу не передавая. У «добавил в корзину» такого ключа нет —
это разовое действие в обработчике клика. Поэтому id создаётся один раз на клик и передаётся
обоим получателям:

```
клик «Legg i handlekurv»
      │
      ├─ dataLayer.push({ event: 'add_to_cart', event_id: 'addtocart_9f2c…', ecommerce: {…} })
      │        └─► GTM → Meta Pixel AddToCart, eventID = addtocart_9f2c…
      │
      └─ POST /api/meta/event  { eventName: 'AddToCart', eventId: 'addtocart_9f2c…', … }
               └─► сервер добавляет _fbp/_fbc/IP/User-Agent → Meta CAPI, event_id = addtocart_9f2c…
```

`InitiateCheckout` — то же самое на клик по «Gå til kassen» (обе кнопки: страница `/handlekurv`
и выдвижная корзина), с префиксом `initiatecheckout_`.

**Что нужно сделать в GTM:** в тегах Meta Pixel `AddToCart` и `InitiateCheckout` подставить
**Event ID** = `{{DLV - event_id}}` — ровно так же, как в шаге 2 для Purchase. Переменная
`DLV - event_id` уже создана, новые переменные не нужны.

Пока это не сделано, серверные события уже отправляются, но Meta считает их отдельными
конверсиями от браузерных.

### Про `value` и `contents`

Оба поля берутся из **того же самого числа**, что уходит в dataLayer, — в `src/lib/analytics.ts`
браузерная и серверная половины строятся из одних и тех же аргументов, второго расчёта доставки
или скидки в этом пути просто нет. Поэтому расхождение вида «browser 898 / server 967»
структурно невозможно.

* `AddToCart` → `value = price × quantity`, одна позиция в `contents`;
* `InitiateCheckout` → `value = orderTotal()` корзины (та же сумма, что видит GA4),
  `contents` — все строки с реальным количеством, плюс `num_items`.

`content_ids` сервер выводит из `contents`, а не принимает отдельно, — так они не могут
разойтись. Идентификатор строки тот же, что у Pixel в `item_id`: голый id варианта или
`product-<id>` для товара без вариантов.

### Что клиент отправить НЕ может

`/api/meta/event` — не прокси для произвольных событий Meta:

| | |
|---|---|
| Имя события | только `AddToCart` и `InitiateCheckout`, сверка по списку. `Purchase` через этот маршрут отправить нельзя |
| `event_id` | обязан начинаться с префикса своего события (`addtocart_` / `initiatecheckout_`) |
| Access token / Pixel ID | только server-side, из env. Из тела запроса не читаются никогда |
| `event_time` | часы сервера, не клиента |
| `currency` | всегда `NOK` |
| `event_source_url` | принимается, только если origin — наш; query-строка и фрагмент отбрасываются |
| Email / телефон | не собираются вообще: на этом шаге покупатель их ещё не вводил |
| Частота | 60 запросов на IP за 5 минут |

Ошибка Meta (400/401/429/500/таймаут) не влияет ни на что: маршрут отвечает `202`, браузер
ответ не читает, товар кладётся в корзину и переход в кассу происходит как обычно. В логах
появляется строка `{"scope":"meta-capi-browser","event":"send_failed",…}` без PII и без токена.

---

## 3. Переменные окружения (Vercel)

Все — **server-only**, без префикса `NEXT_PUBLIC_`.

| Переменная | Где взять | Окружения |
|---|---|---|
| `META_PIXEL_ID` | Events Manager → Data Sources → ваш пиксель → ID | Production, Preview |
| `META_CAPI_ACCESS_TOKEN` | Events Manager → пиксель → Settings → Conversions API → **Generate access token** | Production, Preview |
| `META_GRAPH_API_VERSION` | уже задана (`v24.0`), общая с Marketing API | — |
| `META_TEST_EVENT_CODE` | Events Manager → пиксель → **Test Events** → строка вида `TEST12345` | **только** Preview/локально |

Токен Conversions API — отдельный от `META_ACCESS_TOKEN`, который используется для импорта
расходов на рекламу. Смешивать их не нужно: у них разные права.

Если `META_PIXEL_ID` или `META_CAPI_ACCESS_TOKEN` не заданы, серверное событие просто не
отправляется — вебхук отрабатывает как раньше, в логах появляется
`{"scope":"meta-capi","event":"skipped","reason":"not_configured"}`.

⚠️ `META_TEST_EVENT_CODE` в Production **выключит реальные конверсии**: события с этим кодом
попадают в Test Events и не засчитываются в Ads Manager. Задавайте её только в Preview и
удаляйте после проверки.

---

## 4. Проверка через Meta Test Events

1. Events Manager → ваш пиксель → вкладка **Test Events** → скопировать код `TEST…`.
2. Задать `META_TEST_EVENT_CODE` в Preview-окружении Vercel и передеплоить ветку.
3. Оформить тестовый заказ на Preview-домене и оплатить его.
4. В Test Events должны появиться **два** события Purchase:
   * `Browser` — от пикселя;
   * `Server` — от Conversions API.
   Они схлопнутся в одну строку с пометкой **Deduplicated** / «Processed as one event», если
   `eventID` в GTM настроен. Если строки две и обе считаются — шаг 2 выше не выполнен.
5. Открыть серверное событие и проверить раздел **Parameters**:
   * `Event ID` = `purchase_<kustom order id>`;
   * в `Customer Information` присутствуют `Email`, `Phone`, `IP Address`, `User Agent`,
     `fbp`/`fbc` — те, что удалось собрать;
   * `Value` совпадает с суммой заказа, `Currency` = `NOK`.
6. **Event Match Quality** для серверного события — ориентир 6.0+; при пустых `fbp`/`fbc` он
   будет ниже, это ожидаемо для покупателей, отказавшихся от маркетинговых кук.
7. Удалить `META_TEST_EVENT_CODE` из Preview.

### AddToCart и InitiateCheckout в Test Events

1. Открыть карточку товара, нажать **«Legg i handlekurv»** — **один** раз.
2. В Test Events появляются `AddToCart` **Browser** и `AddToCart` **Server**, схлопнутые в одну
   строку с пометкой **Deduplicated**. Две отдельные считающиеся строки = в GTM не подставлен
   `{{DLV - event_id}}` (см. §2.1).
3. Открыть серверное событие → **Parameters**: `Event ID` вида `addtocart_9f2c…`, `Currency` =
   `NOK`, `Value` = цена × количество, `Contents` — одна позиция.
   В `Customer Information` — `IP Address`, `User Agent` и `fbp`/`fbc`, если куки есть.
   `Email` и `Phone` отсутствуют — это правильно, на этом шаге их ещё неоткуда взять.
4. Нажать **«Gå til kassen»** — один раз. То же самое для `InitiateCheckout`, плюс `Num Items`
   и `Value`, совпадающий с «Totalt» в корзине.
5. Убедиться, что `event_id` у Browser и Server одинаковый (Meta показывает его в обоих).

### Что смотреть в логах Vercel

Все строки — JSON, без PII и без токена. Purchase — `scope: "meta-capi"`:

```json
{"scope":"meta-capi","event":"sent","orderId":"312","kustomOrderId":"7f3c…","orderNumber":"AB-000123","eventId":"purchase_7f3c…","eventsReceived":1}
{"scope":"meta-capi","event":"skipped","reason":"already_claimed", …}
{"scope":"meta-capi","event":"send-failed","httpStatus":400,"metaCode":100,"metaMessage":"…"}
```

`send-failed` никогда не роняет вебхук: заказ остаётся `confirmed`, Kustom получает 2xx, а
попытка отправки повторится при следующей доставке push'а.

Браузерные события — `scope: "meta-capi-browser"`:

```json
{"scope":"meta-capi-browser","event":"sent","status":202,"durationMs":180,"eventName":"AddToCart","eventId":"addtocart_9f2c…","eventsReceived":1}
{"scope":"meta-capi-browser","event":"send_failed","status":202,"eventName":"InitiateCheckout","httpStatus":429,"metaCode":4,"metaMessage":"…"}
{"scope":"meta-capi-browser","event":"rejected","status":400,"reason":"unknown_event"}
```

Здесь ретраев нет и быть не должно: потерянный `AddToCart` — потерянный сигнал, а не потерянный
заказ, и повтор означал бы задвоенную конверсию.

---

## 5. Что осталось за пределами дедупликации

Браузерное событие по-прежнему зависит от согласия на маркетинговые куки (CookieYes). Это
правильно и менять не нужно. Серверное событие отправляется независимо — если для вашего
юридического режима это нежелательно, гейт нужно ставить отдельно, на уровне сохранения
`_fbp`/`_fbc` в момент оформления заказа.
