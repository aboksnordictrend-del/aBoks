# Meta Conversions API + дедупликация с Pixel

**GTM-контейнер:** GTM-NZ6VFSN9
**Серверная часть:** реализована в коде — `src/lib/meta/capi/*`, вызов из `src/app/api/kustom/webhook/route.ts`

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

### Что смотреть в логах Vercel

Все строки — JSON со `scope: "meta-capi"`, без PII и без токена:

```json
{"scope":"meta-capi","event":"sent","orderId":"312","kustomOrderId":"7f3c…","orderNumber":"AB-000123","eventId":"purchase_7f3c…","eventsReceived":1}
{"scope":"meta-capi","event":"skipped","reason":"already_claimed", …}
{"scope":"meta-capi","event":"send-failed","httpStatus":400,"metaCode":100,"metaMessage":"…"}
```

`send-failed` никогда не роняет вебхук: заказ остаётся `confirmed`, Kustom получает 2xx, а
попытка отправки повторится при следующей доставке push'а.

---

## 5. Что осталось за пределами дедупликации

Браузерное событие по-прежнему зависит от согласия на маркетинговые куки (CookieYes). Это
правильно и менять не нужно. Серверное событие отправляется независимо — если для вашего
юридического режима это нежелательно, гейт нужно ставить отдельно, на уровне сохранения
`_fbp`/`_fbc` в момент оформления заказа.
