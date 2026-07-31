# TikTok Ads — import av annonsekostnader

Denne integrasjonen henter **daglig annonseforbruk** fra TikTok Marketing API og lagrer én rad
per dag i `marketing-expenses`, akkurat som Meta Ads, Google Ads og Pinterest Ads. Beløpene
inngår automatisk i Analyse (total markedsføringskostnad, CAC, kostnad per ordre, ROAS,
kanalfordeling og CSV-eksport) — ingen egne TikTok-beregninger finnes.

> **Dette er ikke TikTok Pixel / Events API.** Sporing er en separat sak, se
> [`gtm/TIKTOK-PIXEL-SETUP.md`](../gtm/TIKTOK-PIXEL-SETUP.md). Integrasjonen her er
> **kun lesing av rapportdata** — den oppretter eller endrer aldri kampanjer, annonsegrupper,
> annonser, målgrupper eller budsjetter.

---

## 1. TikTok-appen

I TikTok for Business developer-portalen, på appen med ID `7668564716072534017`:

| Innstilling | Verdi |
| --- | --- |
| App-type | TikTok API for Business (Marketing API) |
| Nødvendige tillatelser | **Reporting (lesing)** er alt integrasjonen trenger. **Ad Account Management (lesing)** er valgfri — se under. Ingen skrive-tillatelser trengs. |
| Redirect URI | Se punkt 2 |

Tillatelsene bindes til **appen**, ikke til den enkelte autoriserings-URL-en: TikTok viser den
faste listen på samtykkeskjermen. Derfor sender integrasjonen ingen `scope`-parameter.

Appen må være **godkjent** før produksjonskontoer kan autorisere den.

### Reporting alene er nok — men da må valutaen oppgis

Kostnadsimporten bruker bare `report/integrated/get`, som dekkes av **Reporting**.

`GET /advertiser/info/` krever den separate tillatelsen **Ad Account Management**. Den er
*valgfri*: mangler den, avvises kallet med kode 40001, integrasjonen logger det og fortsetter.
Konsekvensen er kun at fire opplysninger ikke kan leses fra TikTok:

| Opplysning | Uten Ad Account Management |
| --- | --- |
| Valuta | **Må oppgis via `TIKTOK_ADVERTISER_CURRENCY`** — ellers stopper importen |
| Tidssone | Faller tilbake til UTC (14-dagers overlapp fanger opp en eventuell døgnforskyvning) |
| Opprettelsesdato | Faller tilbake til `TIKTOK_HISTORY_START` |
| Kontonavn | Hentes fra `oauth2/advertiser/get` i stedet |

Valuta er det eneste som ikke har en trygg automatisk erstatning: TikTok oppgir den **kun** via
`/advertiser/info/`. Verken `oauth2/advertiser/get` (id + navn) eller `report/integrated/get`
(metrikker + dimensjoner) returnerer valuta. Derfor må den oppgis eksplisitt — den gjettes
aldri, og utledes aldri fra land eller språk.

Vil du slippe `TIKTOK_ADVERTISER_CURRENCY`, be om **Ad Account Management (lesing)** på appen i
TikTok for Business developer-portalen (Permissions/Scopes på appens side) og koble til på nytt.

---

## 2. Redirect URI

Denne URL-en må registreres på TikTok-appen og settes i `TIKTOK_REDIRECT_URI`. TikTok
sammenlikner strengen **tegn for tegn** — skråstrek på slutten, protokoll og port må stemme.

| Miljø | URL |
| --- | --- |
| Produksjon | `https://aboks.no/api/admin/integrations/tiktok/callback` |
| Lokalt | `http://localhost:3000/api/admin/integrations/tiktok/callback` |

Registrer begge på appen dersom du vil kunne koble til lokalt.

---

## 3. Miljøvariabler

Settes i `.env.local` lokalt og i Vercel sine environment variables i produksjon. Aldri i Git,
aldri med `NEXT_PUBLIC_`-prefiks.

| Variabel | Påkrevd | Beskrivelse |
| --- | --- | --- |
| `TIKTOK_APP_ID` | ✔ | App-ID fra developer-portalen. Ikke hemmelig: `7668564716072534017`. |
| `TIKTOK_APP_SECRET` | ✔ | Appens secret. **Hemmelig.** |
| `TIKTOK_REDIRECT_URI` | ✔ | Nøyaktig samme URL som registrert på appen (punkt 2). |
| `TIKTOK_ADVERTISER_ID` | — | Annonsekontoen kostnadene hentes fra (kun siffer). Kan stå tom når autoriseringen bare omfatter én konto. |
| `TIKTOK_ADVERTISER_CURRENCY` | (✔) | ISO 4217-koden kontoen rapporterer i, f.eks. `NOK`. **Påkrevd når appen kun har Reporting** — se punkt 1. Er en erklæring, ikke en omregning: oppgir du noe annet enn NOK, stoppes importen. |
| `TIKTOK_ACCESS_TOKEN` | — | Nødluke for et token utstedt utenfor appen. Normalt tom. |
| `TIKTOK_API_VERSION` | — | Standard `v1.3`. |
| `TIKTOK_HISTORY_START` | — | Gulv for full import, standard `2020-01-01`. |

`PAYLOAD_SECRET` må være satt: den brukes både til å signere OAuth-state og til å utlede
krypteringsnøkkelen for det lagrede tokenet.

Kortet under **Markedsføringskanaler** viser «Ikke konfigurert» og navngir nøyaktig hvilke av
de tre påkrevde variablene som mangler — aldri noen verdi.

---

## 4. Kjør migrasjonen

```bash
npm run migrate           # bruker .env / .env.local
```

Migrasjonen `20260731_120000` legger til tre kolonner på `tiktok_connection`
(`connection_version`, `metadata_available`, `reporting_ok`). Rent additiv.

Migrasjonen `20260731_090000`:

* legger `'tiktok-ads'` til enum-typen `enum_marketing_expenses_source` (`ADD VALUE IF NOT EXISTS`);
* oppretter tabellen `tiktok_connection` for det lagrede tokenet.

Den er additiv og idempotent: ingen `DROP`/`DELETE`/`TRUNCATE`, ingen kolonne­endringer på
eksisterende tabeller, ingen eksisterende rad røres. `'tiktok'` finnes allerede i
`enum_marketing_expenses_channel` fra `20260718_150000`.

I produksjon kjøres migrasjoner automatisk av `npm run build:vercel`.

---

## 5. Koble til fra Payload admin

1. Gå til **Økonomi → Markedsføringskostnader**.
2. TikTok Ads-kortet viser «Ikke tilkoblet» når oppsettet er på plass, men autoriseringen
   mangler. Klikk **Koble til** (eller åpne kortet og bruk **Koble til TikTok**).
3. Du sendes til TikToks samtykkeskjerm. Godkjenn tilgangen for riktig annonsekonto.
4. TikTok sender deg tilbake til admin. Kortet viser nå «Tilkoblet» med kontonavn, maskert
   konto-ID, valuta og tidssone.

### Hvordan callback-et autentiseres

Bare en innlogget **administrator** kan starte flyten: `connect`-endepunktet krever
`req.user.role === 'admin'`.

Selve callback-et kan derimot **ikke** stole på øktinformasjonskapselen. Payload nekter å
autentisere en cookie på en forespørsel som kommer fra et annet nettsted: `extractJWT`
returnerer `null` når `Origin`-headeren mangler, `config.csrf` ikke er tom og
`Sec-Fetch-Site` er `cross-site`. En omdirigering tilbake fra TikTok treffer alltid akkurat
den kombinasjonen — headeren beregnes over hele omdirigeringskjeden, så selv et klikk som
startet inne i admin ankommer som `cross-site`. Informasjonskapselen *sendes* (Payload bruker
`SameSite=Lax`), men Payload velger å ikke bruke den. `req.user` er derfor alltid `null` her.

Autoriteten bæres i stedet av den signerte `state`-verdien, som gir en sterkere garanti:

* bare `connect` kan lage en gyldig `state`, og `connect` krever en innlogget administrator;
* verdien er HMAC-SHA256-signert med en nøkkel utledet fra `PAYLOAD_SECRET`, og sammenliknes
  i konstant tid;
* den navngir hvilken administrator som startet flyten, og utløper etter 10 minutter.

I tillegg leses administratoren som `state` navngir **opp fra databasen på nytt** ved callback,
og må fortsatt ha rollen `admin` — en bruker som er degradert eller slettet underveis kan ikke
fullføre. Skulle en økt likevel overleve omdirigeringen, må den også være administrator og
tilhøre samme bruker som `state` navngir.

Autorisasjonskoden forbrukes på serveren og havner aldri i adressefeltet etterpå.

### Finne riktig annonsekonto-ID

* **Én autorisert konto** → den velges automatisk, ingenting mer å gjøre.
* **Flere autoriserte kontoer** → tilkoblingen stopper med «Velg annonsekonto». Klikk
  **Vis tilgjengelige kontoer** på TikTok-siden: du får navn og ID for hver autoriserte konto.
  Sett riktig ID i `TIKTOK_ADVERTISER_ID` og last siden på nytt — du trenger **ikke** å
  autorisere på nytt, tokenet er allerede lagret.
* ID-en finnes også i TikTok Ads Manager under kontoinnstillinger, eller i URL-en som
  `aadvid`.

Er `TIKTOK_ADVERTISER_ID` satt til en konto som *ikke* er autorisert, stopper tilkoblingen med
en tydelig feil. Integrasjonen faller aldri tilbake til en annen konto.

---

## 6. Synkronisering

| Modus | Knapp | Vindu |
| --- | --- | --- |
| Inkrementell | «Oppdater» (kortet og detaljsiden) | siste importerte dag − 13 dager … i dag |
| Full | «Full synkronisering» (detaljsiden) | annonsekontoens opprettelsesdato … i dag |

* **Første gang**: en inkrementell forespørsel eskaleres automatisk til full import når det
  ikke finnes TikTok-rader fra før. Resultatet rapporteres som `initialSync: true`.
* **Oppdelt henting**: TikTok tillater maks **30 dager** per rapportspørring med
  `stat_time_day`. Perioden deles derfor alltid i sammenhengende ≤30-dagers biter, i
  kronologisk rekkefølge, med sidevis paginering innenfor hver bit.
* **Feiler én bit, feiler hele kjøringen.** Ingenting skrives, og synkroniseringen rapporterer
  aldri suksess etter en delvis henting.

### Rapporteringsforsinkelse og overlapp

TikToks rapport-API har omtrent **11 timers** forsinkelse, og forbruket justeres i etterkant
(sen attribusjon, kreditering av ugyldig trafikk). Derfor hentes alltid de siste 14 dagene på
nytt ved en inkrementell kjøring — samme overlapp som Meta, Google Ads og Pinterest Ads.

Importen er **idempotent**: hver dag får en deterministisk nøkkel
`tiktok:{advertiserId}:{ÅÅÅÅ-MM-DD}` i `external_key`, som har en UNIQUE-indeks. Gjentatte
kjøringer oppretter aldri duplikater; et endret beløp oppdaterer eksisterende rad, et uendret
beløp gjør ingenting.

### Det som ikke importeres

Kun `spend` lagres. Visninger, klikk, konverteringsverdi og kontosaldo er ikke kostnader og
hentes ikke. Rapporten kjøres på annonsekontonivå (`AUCTION_ADVERTISER`), så kampanjerader kan
ikke bli dobbelttalt.

### MVA

Importerte rader lagres med **MVA-sats 0**, som Google Ads og Pinterest Ads. TikTok fakturerer
norske bedrifter fra sin irske enhet under omvendt avgiftsplikt, så det rapporterte beløpet
*er* nettokostnaden og telles i sin helhet i Analyse. Det finnes ingen TikTok-MVA-innstilling —
en sats på 25 ville dele hver kostnad på 1,25 og underrapportere markedsføring med 20 %.

### Manuelle kostnader

Finnes det **manuelle** TikTok-kostnader som overlapper perioden, stoppes synkroniseringen før
noe skrives, og de motstridende radene listes opp. Fjern eller korriger dem først, så unngås
dobbelttelling.

---

## 7. Valuta og tidssone

* **Valuta**: kun `NOK` godtas, og den avgjøres i denne rekkefølgen:
  1. `advertiser/info` — TikToks eget svar, når **Ad Account Management** er innvilget;
  2. `TIKTOK_ADVERTISER_CURRENCY` — operatørens erklæring;
  3. verdien som ble lagret da tilkoblingen ble opprettet.

  Er ingen av dem tilgjengelig, **stopper importen** med en tydelig feil. Valuta gjettes aldri,
  utledes aldri fra land eller språk, og en annen valuta enn NOK behandles aldri stilltiende
  som kroner. TikToks eget svar vinner alltid over en erklæring — erklærer du NOK mens TikTok
  sier USD, stoppes importen.
* **Tidssone**: dagen lagres nøyaktig slik TikTok merker den (`stat_time_day`), uten å gå veien
  om et tidspunkt. «I dag» for en inkrementell kjøring beregnes i **annonsekontoens**
  rapporteringssone (f.eks. `Europe/Oslo`), aldri i Vercel-serverens sone — så det kan ikke
  oppstå en dags forskyvning rundt midnatt.

---

## 8. Token: levetid og ny tilkobling

Et access token fra TikToks *advertiser*-autorisering **utløper ikke**. Det gjelder til
annonsøren trekker tilbake appens tilgang, eller til tokenet tilbakekalles. Derfor finnes det
ingen refresh-token-rotasjon i denne integrasjonen.

Tokenet lagres kryptert (AES-256-GCM, nøkkel utledet fra `PAYLOAD_SECRET`) i globalen
`tiktok-connection`. Feltet har `read: false`, så Payload fjerner det fra **alle** API-svar og
fra admin-grensesnittet; kun serverkoden i `src/lib/tiktok/tokenStore.ts` leser det.

Tilkoblingen lagrer også hvilket *format* den ble opprettet med. Endres autoriseringsflyten,
ignoreres en eldre tilkobling automatisk — kortet viser «Ikke tilkoblet» og administratoren må
autorisere på nytt, slik at tokenet garantert samsvarer med appens gjeldende tillatelser. Et
gammelt token gjenbrukes aldri.

**Koble til på nytt** når:

* TikTok svarer at tokenet er ugyldig eller tilbakekalt (kortet viser en feil som ber om ny
  tilkobling);
* tilgangen er fjernet i TikTok Business Center;
* `PAYLOAD_SECRET` er rotert — det gamle tokenet kan da ikke dekrypteres, og integrasjonen
  regnes som ikke tilkoblet.

Bruk **Koble til på nytt** på TikTok-siden. Den nye autoriseringen erstatter den gamle;
importerte kostnader røres ikke.

---

## 9. Kontrollere importerte rader

Uten å eksponere noe hemmelig:

* **TikTok-siden** (`/admin/collections/marketing-expenses/tiktok`) viser importerte dager,
  totalsum inkl./eks. MVA, lagret historikk og tidspunkt for siste synkronisering. Filtrer på
  periode ved behov.
* **Alle kostnader** (`/admin/collections/marketing-expenses/all`) viser alle kanaler samlet;
  TikTok-rader har kilde «TikTok Ads API».
* **Analyse** (`/admin/dashboard`) skal vise TikTok som egen kanal i kanalfordelingen, og
  beløpet skal inngå i total markedsføringskostnad, CAC, kostnad per ordre og ROAS.
* En enkeltrad har `externalKey = tiktok:{advertiserId}:{dato}` og `syncMetadata` med beløp,
  valuta, tidssone og API-versjon. **`syncMetadata` inneholder aldri et token.**

Serverloggen bruker prefikset `[tiktok-ads]` og inneholder kun HTTP-status, TikToks feilkode,
`request_id`, datobiten og TikToks egen feiltekst — aldri app secret, access token,
refresh token, autorisasjonskode eller en autoriserings-URL med sensitive parametre.

---

## 10. Endepunkter (alle krever innlogget administrator)

| Metode | Sti | Formål |
| --- | --- | --- |
| GET | `/api/admin/integrations/tiktok/connect` | Starter OAuth, 302 til TikTok |
| GET | `/api/admin/integrations/tiktok/callback` | Tar imot `auth_code`, veksler inn token |
| GET | `/api/admin/integrations/tiktok/status` | Tilkoblingsstatus (ingen TikTok-kall) |
| GET | `/api/admin/integrations/tiktok/advertisers` | Autoriserte annonsekontoer |
| GET | `/api/admin/integrations/tiktok/expenses` | Importerte dagsrader |
| POST | `/api/admin/integrations/tiktok/sync` | Kjører synkronisering (`{ mode }`) |

### TikTok-endepunkter som brukes (Marketing API **v1.3**)

| Formål | Kall |
| --- | --- |
| Autorisering | `GET https://business-api.tiktok.com/portal/auth?app_id&state&redirect_uri` |
| Token | `POST /open_api/v1.3/oauth2/access_token/` — JSON `{app_id, secret, auth_code}` |
| Annonsekontoer | `GET /open_api/v1.3/oauth2/advertiser/get/?app_id&secret` + `Access-Token`-header |
| Kontoinfo | `GET /open_api/v1.3/advertiser/info/?advertiser_ids=[…]` |
| Forbruk | `GET /open_api/v1.3/report/integrated/get/` — `service_type=AUCTION`, `report_type=BASIC`, `data_level=AUCTION_ADVERTISER`, `dimensions=["advertiser_id","stat_time_day"]`, `metrics=["spend"]` |

Alle svar har konvolutten `{ code, message, request_id, data }`, der `code: 0` betyr suksess.
**TikTok svarer HTTP 200 også på applikasjonsfeil**, så klienten avgjør alltid ut fra `code`.
Paginering skjer med `page` mot `data.page_info.total_page`.

Kun forbigående feil prøves på nytt (HTTP 429, HTTP 5xx, nettverksbrudd og TikToks egen
`5xxxx`-kodefamilie), maks to ekstra forsøk med økende ventetid. Ugyldige nøkler, manglende
tillatelser, ukjent annonsekonto, feil valuta og feil oppsett prøves aldri på nytt.
