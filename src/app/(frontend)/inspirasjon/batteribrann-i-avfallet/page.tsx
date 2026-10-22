import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'batteribrann-i-avfallet',
    // Root layout template appends " | aBoks".
    title: 'Batteribrann i avfallet: Hvorfor batterier tar fyr',
    description:
      'Batteribrann i avfallet skjer hver uke i Norge. Se tallene, de dokumenterte brannene og hvordan du sorterer brukte batterier trygt hjemme og på jobb.',
    ogDescription:
      'Feilsorterte batterier er den største kjente årsaken til branner i norske gjenvinningsanlegg. Les om fakta, dokumenterte hendelser, forskjellen på batterityper og konkrete råd om trygg batterisortering.',
  }),
  keywords: [
    'batteribrann', 'batterier i restavfall', 'brann i avfallsanlegg', 'brukte batterier',
    'batterisortering', 'batterier gjenvinning', 'litiumbatteri brann', 'batteri kortslutning',
    'batteriboks',
  ],
}

/* ── Style tokens ── */
const pStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: 'clamp(15px,1.1vw,17px)',
  lineHeight: 1.8,
  color: '#4a4e41',
  margin: '0 0 22px',
}

const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant)',
  fontWeight: 600,
  fontSize: 'clamp(26px,2.4vw,34px)',
  letterSpacing: '-0.015em',
  lineHeight: 1.15,
  color: '#1a1d17',
  margin: '56px 0 18px',
}

const h3Style: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontWeight: 700,
  fontSize: 'clamp(16px,1.3vw,19px)',
  color: '#1a1d17',
  margin: '36px 0 14px',
}

const emStyle: React.CSSProperties = { fontStyle: 'italic', color: '#5e6a48' }

const extLink: React.CSSProperties = {
  color: '#39402c',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

const EXT = { target: '_blank', rel: 'noopener noreferrer nofollow' } as const

/* ── Components ── */
function Ref({ n }: { n: number[] }) {
  return (
    <sup style={{ fontFamily: 'var(--font-manrope)', fontSize: '11px', fontWeight: 700, lineHeight: 0 }}>
      {n.map((k, i) => (
        <span key={k}>
          {i > 0 ? ',' : null}
          <a href={`#kilde-${k}`} style={{ color: '#5e6a48', textDecoration: 'none', padding: '0 1px' }}>
            {k}
          </a>
        </span>
      ))}
    </sup>
  )
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '5px 0' }}>
      <span style={{
        flexShrink: 0, width: '7px', height: '7px', borderRadius: '50%',
        background: '#5e6a48', marginTop: '9px',
      }} />
      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)', lineHeight: 1.75, color: '#4a4e41' }}>
        {children}
      </span>
    </li>
  )
}

function NumberedItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '6px 0' }}>
      <span style={{
        flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%',
        background: '#39402c', color: '#faf6ee',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-manrope)', fontSize: '13px', fontWeight: 700, marginTop: '2px',
      }}>{n}</span>
      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)', lineHeight: 1.75, color: '#4a4e41' }}>
        {children}
      </span>
    </li>
  )
}

function Callout({ label, title, dark, children }: { label: string; title?: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      margin: '36px 0', padding: '24px 30px',
      background: dark ? '#eee9de' : '#fff', border: '1px solid #ddd8ce',
      borderLeft: dark ? '3px solid #39402c' : '1px solid #ddd8ce', borderRadius: '16px',
    }}>
      <span style={{
        display: 'inline-block', fontFamily: 'var(--font-manrope)', fontSize: '10px',
        letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
        color: dark ? '#faf6ee' : '#5e6a48', background: dark ? '#39402c' : '#eee9de',
        padding: '5px 12px', borderRadius: '999px', marginBottom: '14px',
      }}>{label}</span>
      {title ? (
        <h3 style={{ ...h3Style, margin: '0 0 10px' }}>{title}</h3>
      ) : null}
      <div style={{ ...pStyle, margin: 0 }}>{children}</div>
    </div>
  )
}

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details style={{ borderBottom: '1px solid #ddd8ce' }}>
      <summary style={{
        cursor: 'pointer', padding: '18px 4px',
        fontFamily: 'var(--font-manrope)', fontWeight: 700,
        fontSize: 'clamp(15px,1.1vw,16px)', color: '#1a1d17', listStyle: 'none',
      }}>
        {question}
      </summary>
      <div style={{ padding: '0 4px 20px', ...pStyle, margin: 0 }}>{children}</div>
    </details>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', background: '#eee9de', border: '1px solid #d8d2c7',
      borderRadius: '999px', padding: '5px 14px', margin: '4px 6px 4px 0',
      fontFamily: 'var(--font-manrope)', fontSize: '12px', color: '#4a4e41',
    }}>{label}</span>
  )
}

function Stat({ num, unit, label, children }: { num: string; unit?: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ddd8ce', borderRadius: '16px', padding: '22px 22px 20px' }}>
      <div style={{
        fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(40px,4vw,52px)',
        lineHeight: 1, letterSpacing: '-0.02em', color: '#39402c',
      }}>
        {num}
        {unit ? <span style={{ fontSize: '22px', marginLeft: '4px', color: '#5e6a48' }}>{unit}</span> : null}
      </div>
      <p style={{
        fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '15px', lineHeight: 1.4,
        color: '#1a1d17', margin: '12px 0 6px',
      }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', lineHeight: 1.55, color: '#6b6f63', margin: 0 }}>
        {children}
      </p>
    </div>
  )
}

function TimelineEvent({
  when, title, tag, confirmed, sources, children,
}: {
  when: string
  title: string
  tag: string
  confirmed: boolean
  sources: { label: string; url: string }[]
  children: React.ReactNode
}) {
  return (
    <li style={{ position: 'relative', marginBottom: '16px' }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: '-29px', top: '26px', width: '14px', height: '14px',
        borderRadius: '50%', background: '#faf6ee', border: '3px solid #5e6a48',
      }} />
      <div style={{ background: '#fff', border: '1px solid #ddd8ce', borderRadius: '16px', padding: '20px 22px' }}>
        <span style={{
          fontFamily: 'var(--font-manrope)', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5e6a48',
        }}>{when}</span>
        <h3 style={{ ...h3Style, margin: '6px 0 8px' }}>{title}</h3>
        <p style={{ ...pStyle, fontSize: 'clamp(14px,1vw,16px)', lineHeight: 1.7, margin: '0 0 12px' }}>{children}</p>
        <span style={{
          display: 'inline-block', fontFamily: 'var(--font-manrope)', fontSize: '12px', fontWeight: 600,
          borderRadius: '999px', padding: '3px 11px',
          background: confirmed ? 'rgba(94,106,72,0.14)' : '#f5f1e8',
          color: confirmed ? '#39402c' : '#4a4e41',
          border: confirmed ? '1px solid transparent' : '1px solid #ddd8ce',
        }}>{tag}</span>
        <p style={{
          fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', lineHeight: 1.6,
          margin: '12px 0 0', paddingTop: '10px', borderTop: '1px solid #ece8e1',
        }}>
          Les saken:{' '}
          {sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 ? ' · ' : null}
              <a href={s.url} {...EXT} style={{ ...extLink, fontWeight: 600 }}>{s.label}</a>
            </span>
          ))}
        </p>
      </div>
    </li>
  )
}

const TABLE_HEADERS = ['Batteritype', 'Typisk bruk', 'Risiko i avfallet', 'Hvordan levere']

const TABLE_ROWS: { type: string; note: string; cells: string[] }[] = [
  {
    type: 'Alkaliske AA/AAA', note: '(engangs)',
    cells: [
      'Fjernkontroller, leker, klokker',
      'Lavere energitetthet, men kan bli varme ved kortslutning. Mange i samme pose øker risikoen.',
      'Teip polene, samle og lever i butikk eller på gjenvinningsstasjon',
    ],
  },
  {
    type: 'NiMH', note: '(oppladbare AA/AAA)',
    cells: [
      'Spillkontrollere, lommelykter, trådløse mus',
      'Kan ha mer restenergi enn mange tror og gi kraftig varmeutvikling ved kortslutning.',
      'Som over – teipede poler',
    ],
  },
  {
    type: '9V og knappceller', note: '(inkl. litium-knappceller)',
    cells: [
      'Røykvarslere, vekter, bilnøkler',
      '9V har begge polene på samme side og kortslutter lett. Knappceller er dessuten farlige for barn å svelge.',
      'Teip alltid, oppbevar utilgjengelig for barn',
    ],
  },
  {
    type: 'Litium-ion', note: '(innebygde og batteripakker)',
    cells: [
      'Mobil, nettbrett, verktøy, elsykkel, elsparkesykkel',
      'Høyest risiko. Skader kan gi termisk rusling, kraftig brann og giftig røyk.',
      'Lever separat på gjenvinningsstasjon eller hos forhandler. Skadde batterier skal til mottak for farlig avfall.',
    ],
  },
]

const PRODUCTS = [
  { name: 'aBoks', href: '/produkter/aboks', desc: 'For hjemmet: egne rom for nye AA, nye AAA og brukte batterier.' },
  { name: 'aBoks Office', href: '/produkter/aboks-office', desc: 'For skrivebordet: nye AA-batterier, eget rom for brukte, pluss plass til mobil og kontorutstyr.' },
  { name: 'aBoks XL', href: '/produkter/aboks-xl', desc: 'For bedrifter, skoler og kommunale bygg: veggmontert, felles innsamlingspunkt for brukte batterier.' },
]

const SOURCES: { pub: string; text: string; url: string; host: string; extra?: React.ReactNode }[] = [
  { pub: 'Oslo kommune, Renovasjons- og gjenvinningsetaten', text: '«Små batterier, store branner», 09.04.2024.', url: 'https://aktuelt.oslo.kommune.no/sma-batterier-store-branner', host: 'aktuelt.oslo.kommune.no' },
  { pub: 'SINTEF', text: '«Brannen ved avfallsanlegget på Forus avdekket hull ved sikkerheten», 2023.', url: 'https://www.sintef.no/siste-nytt/2023/brannen-ved-avfallsanlegget-pa-forus-avdekket-hull-ved-sikkerheten/', host: 'sintef.no' },
  { pub: 'Haugaland Brann og Redning IKS', text: '«Ikke kast batterier i restavfallet», publisert 15.01.2025.', url: 'https://www.hbre.no/arkiv/ikke-kast-batterier-i-restavfallet-article547-933.html', host: 'hbre.no' },
  { pub: 'Ragn-Sells', text: '«Ett batteri på avveie kan være nok», 19.06.2026.', url: 'https://www.ragnsells.no/om-oss/nyheter-og-presse/artikler/ett-batteri-pa-avveie-kan-vare-nok/', host: 'ragnsells.no' },
  { pub: 'P4 / Lyden av Radio', text: '«Rekordmange branner hos gjenvinningsanlegg», 18.01.2026.', url: 'https://www.lydenavradio.no/p4/nyheter/rekordmange-branner-hos-gjenvinningsanlegg/artikkel/986360', host: 'lydenavradio.no' },
  {
    pub: 'Norsk Industri', text: '«Brannstatistikk gjenvinningsbransjen 2025» (PDF).',
    url: 'https://www.norskindustri.no/siteassets/dokumenter/bransjer/gjenvinning/brannstatistikk-gjenvinningsbransjen-2025.pdf', host: 'norskindustri.no',
    extra: (
      <>
        . Se også{' '}
        <a href="https://norskindustri.no/siteassets/dokumenter/bransjer/gjenvinning/brannstatistikk-gjenvinningsbransjen-2023.pdf" {...EXT} style={extLink}>
          statistikken for 2023
        </a>
        .
      </>
    ),
  },
  { pub: 'Avfall Sør', text: '«Batterier i restavfallet startet brann i renovasjonsbiler», 13.10.2026.', url: 'https://avfallsor.no/batterier-i-restavfallet/', host: 'avfallsor.no' },
  { pub: 'Avfall Sør', text: '«Små batterier kan få store konsekvenser», 07.11.2025.', url: 'https://avfallsor.no/sma-batterier-kan-fa-store-konsekvenser/', host: 'avfallsor.no' },
  { pub: 'LOOP Stiftelsen for kildesortering og gjenvinning', text: '«Små batterier, store branner: Nå går avfallsbransjen ut med en viktig påminnelse», pressemelding 04.05.2026.', url: 'https://kommunikasjon.ntb.no/pressemelding/18884798/sma-batterier-store-branner-na-gar-avfallsbransjen-ut-med-en-viktig-paminnelse', host: 'kommunikasjon.ntb.no' },
  { pub: 'Follo Ren IKS', text: '«Brann i renovasjonsbil», 22.04.2025.', url: 'https://folloren.no/nyheter/brann-i-renovasjonsbil-2/', host: 'folloren.no' },
  { pub: 'Statsforvaltaren i Vestland', text: '«Auka fokus på brannførebygging i avfallsanlegg».', url: 'https://www.statsforvalteren.no/vestland/miljo-og-klima/avfall-og-gjenvinning/auka-fokus-pa-brannforebygging-i-avfallsanlegg/', host: 'statsforvalteren.no' },
  { pub: 'Massachusetts Department of Fire Services', text: '«Recycling Truck Fire Started with Lithium-Ion Batteries», 05.05.2025.', url: 'https://www.mass.gov/news/recycling-truck-fire-started-with-lithium-ion-batteries', host: 'mass.gov' },
  { pub: 'letsrecycle.com', text: '«Material Focus reports 71% increase in battery fires since 2022».', url: 'https://www.letsrecycle.com/news/material-focus-reports-71-increase-in-battery-fires-since-2022', host: 'letsrecycle.com' },
  { pub: 'ABC News (Australia), 7.30', text: '«Lithium-ion battery fires causing havoc in the waste and recycling sectors», 20.06.2024.', url: 'https://www.abc.net.au/news/2024-06-20/lithium-ion-battery-fires-causing-havoc-in-waste-and-recycling/104004626', host: 'abc.net.au' },
  { pub: 'DSB', text: '«Avgassing fra litium-ion-batterier i hjemmet» (rapport).', url: 'https://www.dsb.no/rapporter-og-evalueringer/avgassing-fra-litium-ion-batterier-i-hjemmet/', host: 'dsb.no' },
  { pub: 'Sortere.no (LOOP)', text: 'Nasjonal kildesorteringsguide for batterier.', url: 'https://sortere.no/', host: 'sortere.no' },
  { pub: 'NRK Rogaland', text: '«Batterier og engangskameraer kan ha satt fyr på søppelanlegg til 650 millioner».', url: 'https://www.nrk.no/rogaland/batterier-og-engangskameraer-kan-ha-satt-fyr-pa-soppelanlegg-til-650-millioner-1.16165025', host: 'nrk.no' },
  { pub: 'Trondheim Renholdsverk / Råstoff', text: '«Kenneth holdt hodet kaldt da det begynte å brenne i bilen», 14.06.2022.', url: 'https://trv.no/rastoff/kenneth-holdt-hodet-kaldt-da-det-begynte-a-brenne-i-bilen/', host: 'trv.no' },
  { pub: 'NRK Innlandet', text: '«Her tar elsykkelbatteriet fyr på avfallsplassen til GLØR i Lillehammer».', url: 'https://www.nrk.no/innlandet/her-tar-elsykkelbatteriet-fyr-pa-avfallsplassen-til-glor-i-lillehammer-1.16117366', host: 'nrk.no' },
  { pub: 'Avisa Oslo', text: '«6000 batterier havner i feil søppeldunk daglig: – Tar fyr og tenner på avfall», 2023.', url: 'https://www.ao.no/6000-batterier-havner-i-feil-soppeldunk-daglig-tar-fyr-og-tenner-pa-avfall/s/5-128-514376', host: 'ao.no', extra: ' (abonnement kan kreves)' },
  { pub: 'Østlandets Blad', text: '«Brann i renovasjonsbil – politiet med klar oppfordring», 22.04.2025.', url: 'https://www.oblad.no/brann-i-renovasjonsbil/s/5-68-1662952', host: 'oblad.no', extra: ' (abonnement kan kreves)' },
  { pub: 'RIR (Romsdal)', text: '«Det brenner i norske avfallsanlegg».', url: 'https://www.rir.no/aktuelt/det-brenne-i-norske-avfallsanlegg', host: 'rir.no' },
]

const RELATED = [
  { category: 'Sikkerhet', title: 'Hvordan oppbevare batterier trygt hjemme?', href: '/inspirasjon/oppbevare-batterier-trygt-hjemme' },
  { category: 'Kunnskap', title: 'Hvordan fungerer batterier? Slik blir kjemi til strøm', href: '/inspirasjon/hvordan-fungerer-batterier' },
  { category: 'Hjem', title: 'De beste løsningene for batterioppbevaring hjemme', href: '/inspirasjon/beste-losninger-batterioppbevaring-hjemme' },
]

export default function ArticlePage() {
  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        {/* Breadcrumb */}
        <nav aria-label="Brødsmuler" style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
          fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63',
          paddingTop: '18px', marginBottom: 'clamp(36px,5vw,48px)',
        }}>
          <Link href="/" style={{ color: '#6b6f63', textDecoration: 'none' }}>Hjem</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <Link href="/inspirasjon" style={{ color: '#6b6f63', textDecoration: 'none' }}>Inspirasjon</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Batteribrann i avfallet</span>
        </nav>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Sikkerhet &amp; gjenvinning
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Små batterier, store konsekvenser: <em style={emStyle}>derfor øker batteribrannene</em> i avfallet
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Hver uke starter det en batteribrann et sted i den norske avfallskjeden – i en
              søppelbil, i en container eller midt inne på et sorteringsanlegg. Her er tallene,
              hendelsene og de enkle vanene som faktisk gjør en forskjell.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              aBoks redaksjon · Publisert 22. oktober 2026 · Lesetid ca. 11 min
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              Onsdag 7. februar 2024 begynte det å brenne i en søppelbil på Haugalandet. Brannen ble
              oppdaget tidlig og slukket raskt, og da mannskapene undersøkte restene etterpå, var
              synderen lett å peke ut: et batteri som hadde havnet i restavfallet.<Ref n={[3]} /> Brann
              og redning på Haugalandet påpekte at det kunne gått langt verre dersom bilen allerede
              hadde rukket fram til avfallsanlegget.
            </p>

            <p style={pStyle}>
              Historien er ikke spesiell. Det er nettopp det som gjør den viktig. En{' '}
              <strong>batteribrann</strong> i avfallet er i dag en av de vanligste brannårsakene i
              norsk avfalls- og gjenvinningsbransje, og nesten alle starter på samme måte: med et lite
              batteri som noen trodde var tomt, og som ble kastet sammen med resten av søpla.
            </p>

            <h2 style={h2Style}>Hvor stort er problemet i Norge?</h2>

            <p style={pStyle}>
              Det finnes ikke én samlet nasjonal brannstatistikk for hele avfallskjeden. Tallene under
              kommer fra ulike aktører og måler ulike ting, og de kan derfor ikke legges sammen. Men de
              peker i samme retning.
            </p>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
              gap: '14px', margin: '28px 0 16px',
            }}>
              <Stat num="66" label="branner på norske gjenvinningsanlegg i 2025">
                Tall fra DSB, gjengitt av P4. Det høyeste antallet direktoratet har registrert. Ikke
                alle brannene skyldtes batterier.<Ref n={[5]} />
              </Stat>
              <Stat num="554" label="brannhendelser rapportert av 14 gjenvinningsbedrifter i 2025">
                Norsk Industris bransjestatistikk. Omfatter også små branntilløp som bedriftene
                håndterte selv. Batterier er klart største kjente årsak.<Ref n={[6]} />
              </Stat>
              <Stat num="205" label="branntilløp og branner ved Ragn-Sells' anlegg i 2025">
                Ett enkelt selskap. Ifølge Ragn-Sells skyldtes en stor andel feilsorterte batterier,
                og bare et fåtall utviklet seg til branner.<Ref n={[4]} />
              </Stat>
              <Stat num="2" unit="mill." label="batterier i Oslos restavfall hvert år">
                Anslag fra plukkanalyser hos Renovasjons- og gjenvinningsetaten. Det tilsvarer rundt
                tre batterier per innbygger.<Ref n={[1]} />
              </Stat>
            </div>

            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '14px', lineHeight: 1.65, color: '#6b6f63',
              background: '#eee9de', borderRadius: '12px', padding: '14px 18px', margin: '0 0 28px',
            }}>
              Hvorfor er tallene så forskjellige? DSB-tallet gjelder branner registrert av brann- og
              redningsvesenet, mens bransjens egne tall også fanger opp gnister og røykutvikling som
              slukkes internt før de blir en sak for brannvesenet. I Norsk Industris statistikk for 2025
              var nesten fire av ti hendelser av ukjent årsak.<Ref n={[6]} />
            </p>

            <p style={pStyle}>
              Når årsaken faktisk lar seg fastslå, peker pilen tydelig mot batterier. I statistikken
              for 2023 sto batterier for over 85 prosent av hendelsene med kjent årsak,<Ref n={[6]} /> og
              LOOP oppgir det samme nivået i vårens nasjonale kampanje.<Ref n={[9]} /> Avfall Sør, som
              viser til Norsk Industris tall for 2025, anslår andelen til rundt 75 prosent.<Ref n={[7]} />{' '}
              Andelen varierer altså noe fra år til år og med hvordan den beregnes – men batterier er
              hvert år den største enkeltårsaken.
            </p>

            <p style={pStyle}>
              Lokalt ser bildet likt ut. I 2022 rykket brannvesenet i Oslo ut til 30 branner og
              branntilløp i renovasjonsbiler og avfallsanlegg.<Ref n={[1]} /> I dag sier brigadesjef
              Knut Halvorsen i Oslo brann- og redningsetat at de rykker ut til branner direkte
              forårsaket av batterier flere ganger i uka.<Ref n={[9]} />
            </p>

            <h2 style={h2Style}>Dokumenterte branner i Norge</h2>

            <p style={pStyle}>
              Bak statistikken finnes konkrete hendelser. Her er et utvalg fra de siste årene, med
              lenke til den opprinnelige omtalen og tydelig skille mellom det som er fastslått og det
              som er mistenkt.
            </p>

            <ol style={{
              listStyle: 'none', margin: '28px 0 32px', padding: '0 0 0 30px',
              position: 'relative', borderLeft: '2px solid #ddd8ce', marginLeft: '8px',
            }}>
              <TimelineEvent
                when="13. juni 2022 · Nardo, Trondheim"
                title="Røyk fra lasterommet på en papirbil"
                tag="Litiumbatteri mistenkt"
                confirmed={false}
                sources={[{ label: 'Trondheim Renholdsverk / Råstoff, 14.06.2022', url: 'https://trv.no/rastoff/kenneth-holdt-hodet-kaldt-da-det-begynte-a-brenne-i-bilen/' }]}
              >
                Mens en renovasjonsbil fra Trondheim Renholdsverk tømte papp og papir i et boligfelt på
                Nardo, kom det røyk fra lasterommet. Mannskapet varslet 110 og kjørte bilen til
                Heggstadmoen, der brannvesenet tømte lasset og slukket. Årsaken var ikke klarlagt da
                saken ble skrevet, men et feilkastet litiumbatteri i papirdunken ble pekt på som mulig
                årsak.<Ref n={[18]} />
              </TimelineEvent>
              <TimelineEvent
                when="22. juli 2022 · Forus, Rogaland"
                title="Storbrann i ettersorteringsanlegget til IVAR"
                tag="Batteri sannsynlig, ikke fastslått"
                confirmed={false}
                sources={[
                  { label: 'NRK Rogaland', url: 'https://www.nrk.no/rogaland/batterier-og-engangskameraer-kan-ha-satt-fyr-pa-soppelanlegg-til-650-millioner-1.16165025' },
                  { label: 'SINTEF', url: 'https://www.sintef.no/siste-nytt/2023/brannen-ved-avfallsanlegget-pa-forus-avdekket-hull-ved-sikkerheten/' },
                ]}
              >
                Brannen startet i en papirhaug i mottakshallen og spredte seg etter 29 minutter til
                sorteringshallen via et transportbånd. Anlegget, som hadde kostet rundt 650 millioner
                kroner, ble totalskadd. SINTEFs uavhengige undersøkelse kunne ikke fastslå tennkilden med
                sikkerhet, men konkluderte med at det sannsynligvis var et elektrisk produkt – et batteri
                eller lignende – i papiravfallet. Rapporten beskriver brannen som en systemulykke med
                svikt på flere nivåer i anleggets brannsikkerhet.<Ref n={[2, 17]} />
              </TimelineEvent>
              <TimelineEvent
                when="Lillehammer · GLØR"
                title="Elsykkelbatteri tok fyr i sorteringshallen"
                tag="Elsykkelbatteri bekreftet"
                confirmed
                sources={[{ label: 'NRK Innlandet', url: 'https://www.nrk.no/innlandet/her-tar-elsykkelbatteriet-fyr-pa-avfallsplassen-til-glor-i-lillehammer-1.16117366' }]}
              >
                En mandag morgen slo det opp flammer i en haug med restavfall i sorteringshallen til
                GLØR. En ansatt i hjullaster oppdaget brannen tidlig, og industrivernet slukket den
                raskt. Batteriet ble lagt i et stort vannkar for å brenne ut og kjøles ned. GLØR
                bekreftet overfor NRK at det var et elsykkelbatteri som tok fyr, og selskapet delte video
                av brannen.<Ref n={[19]} />
              </TimelineEvent>
              <TimelineEvent
                when="2023 · Sofienberg, Oslo"
                title="Åpne flammer og smell i en renovasjonsbil"
                tag="Batterier oppgitt som årsak"
                confirmed
                sources={[{ label: 'Avisa Oslo', url: 'https://www.ao.no/6000-batterier-havner-i-feil-soppeldunk-daglig-tar-fyr-og-tenner-pa-avfall/s/5-128-514376' }]}
              >
                Brannvesenet rykket ut til en renovasjonsbil på Sofienberg der det var åpne flammer og
                smell i avfallet. Etterpå fant Renovasjons- og gjenvinningsetaten utbrente batterier i
                lasset, og etaten sa til Avisa Oslo at disse etter alt å dømme var årsaken.<Ref n={[20]} />
              </TimelineEvent>
              <TimelineEvent
                when="7. februar 2024 · Haugalandet"
                title="Brann i søppelbil"
                tag="Batteri fastslått av brannvesenet"
                confirmed
                sources={[{ label: 'Haugaland Brann og Redning', url: 'https://www.hbre.no/arkiv/ikke-kast-batterier-i-restavfallet-article547-933.html' }]}
              >
                Etter slukking konstaterte Haugaland Brann og Redning at et batteri var årsaken. Brannen
                ble oppdaget tidlig og fikk ikke utvikle seg.<Ref n={[3]} />
              </TimelineEvent>
              <TimelineEvent
                when="22. april 2025 · Langhus, Follo"
                title="Brann bak i trauet på en renovasjonsbil"
                tag="Batteripakke bekreftet av politiet"
                confirmed
                sources={[
                  { label: 'Østlandets Blad', url: 'https://www.oblad.no/brann-i-renovasjonsbil/s/5-68-1662952' },
                  { label: 'Follo Ren', url: 'https://folloren.no/nyheter/brann-i-renovasjonsbil-2/' },
                ]}
              >
                Renovatørene tømte lasset på en åpen plass i Oppegårdveien og slukket med pulverapparat,
                før Follo brannvesen overtok. Dermed unngikk man full overtenning midt i et boligområde,
                og ingen ble skadet. Follo Ren skrev samme dag at politiet mistenkte et batteri fra en
                elsparkesykkel. Ifølge Østlandets Blad bekreftet politiets operasjonsleder senere at en
                batteripakke var årsaken.<Ref n={[10, 21]} />
              </TimelineEvent>
              <TimelineEvent
                when="Høsten 2025 · Områ"
                title="Driftsstans på sorteringsanlegg for plastemballasje"
                tag="Batteri oppgitt som årsak"
                confirmed
                sources={[{ label: 'LOOP via NTB', url: 'https://kommunikasjon.ntb.no/pressemelding/18884798/sma-batterier-store-branner-na-gar-avfallsbransjen-ut-med-en-viktig-paminnelse' }]}
              >
                Under et besøk fra LOOP tok det fyr på Områ, Norges første sorteringsanlegg for
                plastemballasje. Anlegget måtte stenges i en halvtime, og rundt ett tonn plastemballasje
                gikk tapt. Ifølge LOOP var årsaken helt vanlige AA-batterier kastet sammen med
                plasten.<Ref n={[9]} />
              </TimelineEvent>
              <TimelineEvent
                when="2026 · Kristiansand og Vennesla"
                title="Tre branner i renovasjonsbiler hittil i år"
                tag="Batterier oppgitt som årsak"
                confirmed
                sources={[{ label: 'Avfall Sør, 13.10.2026', url: 'https://avfallsor.no/batterier-i-restavfallet/' }]}
              >
                Avfall Sør melder om tre branner i renovasjonsbiler i 2026 fordi batterier var kastet i
                restavfallet. Alle ble slukket uten personskader. Selskapet ser særlig en økning i
                feilsorterte batterier fra elsykler og elsparkesykler.<Ref n={[7]} />
              </TimelineEvent>
            </ol>

            <h2 style={h2Style}>Hvorfor tar brukte batterier fyr?</h2>

            <p style={pStyle}>
              Et batteri du opplever som «tomt», er sjelden helt tomt. Når apparatet slutter å virke,
              er spenningen bare blitt for lav for akkurat det apparatet. Restenergien er fortsatt der,
              og det er den som kan bli farlig.<Ref n={[1]} /> Vil du forstå kjemien bak, har vi
              forklart den i guiden{' '}
              <Link href="/inspirasjon/hvordan-fungerer-batterier" style={extLink}>Hvordan fungerer batterier?</Link>
            </p>

            <h3 style={h3Style}>Kortslutning</h3>
            <p style={pStyle}>
              Når pluss- og minuspolen kobles sammen gjennom metall – en binders, aluminiumsfolie, en
              spiker eller et annet batteri – går strømmen rett gjennom uten motstand. Batteriet blir
              varmt, og i en pose full av papir og plast er det nok til å starte en glødebrann. Derfor
              anbefaler både avfallsbransjen og brannvesenet å teipe polene: teipen leder ikke strøm og
              hindrer kontakt.<Ref n={[9]} />
            </p>

            <h3 style={h3Style}>Klem, slag og komprimering</h3>
            <p style={pStyle}>
              En renovasjonsbil presser avfallet sammen for å få plass til mer. Da kan batterier gnisse
              mot hverandre, bli knust eller få indre skader.<Ref n={[1]} /> Senere i kjeden venter
              kverner, transportbånd og nye runder med komprimering. Hos RIR i Romsdal eksploderte et
              batteri inne i kverna på sorteringsanlegget for restavfall – flammedetektorene utløste
              automatisk vannslukking, og kverna stoppet av seg selv.<Ref n={[22]} /> Avfall Sør påpeker
              at et skadet batteri kan se helt normalt ut, og at brannen kan komme med en gang – eller
              timer og dager senere.<Ref n={[7]} />
            </p>

            <h3 style={h3Style}>Termisk rusling i litium-ion-batterier</h3>
            <p style={pStyle}>
              Litium-ion-batterier lagrer mye energi på liten plass. Blir en celle skadet, kan den
              varme seg selv opp i en ukontrollert kjedereaksjon, ofte kalt termisk
              rusling (<em>thermal runaway</em>). Oslo brann- og redningsetat beskriver slike branner som svært
              krevende fordi de kan antenne spontant, utvikle høy varme og gi svært giftig
              røyk.<Ref n={[1]} /> DSB har også dokumentert at skadde litium-ion-batterier kan avgi
              helseskadelige gasser.<Ref n={[15]} />
            </p>

            <h3 style={h3Style}>De skjulte batteriene</h3>
            <p style={pStyle}>
              Mange batterier ser ikke ut som batterier. De sitter i elektriske tannbørster,
              ørepropper, blinkende sko, lekesaker og bursdagskort med musikk. Statsforvalteren i
              Vestland trekker nettopp fram slike produkter, og viser til at litiumbatterier ofte er
              utløsende faktor når årsaken til en avfallsbrann blir funnet.<Ref n={[11]} /> Alt med
              batteri eller ledning skal leveres som EE-avfall – også når batteriet ikke kan tas ut.
            </p>

            <h3 style={h3Style}>Ikke alle batterier er like risikable</h3>
            <p style={pStyle}>
              Det er viktig å skille mellom batterityper. Alle kan kortslutte, men energimengden – og
              dermed konsekvensen – varierer betydelig.
            </p>

            <div style={{ overflowX: 'auto', margin: '8px 0 28px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', minWidth: '600px',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {TABLE_HEADERS.map((h) => (
                      <th key={h} scope="col" style={{
                        textAlign: 'left', padding: '13px 16px', background: '#39402c',
                        color: '#faf6ee', fontWeight: 600, letterSpacing: '0.02em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ROWS.map((row, i) => {
                    const cellStyle: React.CSSProperties = {
                      padding: '12px 16px',
                      borderBottom: i < TABLE_ROWS.length - 1 ? '1px solid #ece8e1' : 'none',
                      background: i % 2 === 1 ? '#f5f1e8' : '#fff',
                      verticalAlign: 'top', textAlign: 'left', color: '#4a4e41', lineHeight: 1.6,
                    }
                    return (
                      <tr key={row.type}>
                        <th scope="row" style={{ ...cellStyle, fontWeight: 400 }}>
                          <strong style={{ color: '#39402c' }}>{row.type}</strong> {row.note}
                        </th>
                        {row.cells.map((cell, j) => <td key={j} style={cellStyle}>{cell}</td>)}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p style={pStyle}>
              Les mer om hvordan du tar vare på oppladbare batterier i{' '}
              <Link href="/inspirasjon/langtidsoppbevaring-oppladbare-batterier" style={extLink}>
                guiden vår om langtidsoppbevaring
              </Link>
              .
            </p>

            <h2 style={h2Style}>Et internasjonalt problem</h2>

            <p style={pStyle}>
              Norge er ikke alene. I Storbritannia anslår Material Focus, i samarbeid med de britiske
              brannsjefenes organisasjon, at det oppstår over 1 200 batteribranner i søppelbiler og
              avfallsanlegg hvert år – en økning på over 70 prosent siden 2022.<Ref n={[13]} />
            </p>

            <p style={pStyle}>
              I USA undersøkte brannetterforskere i Massachusetts en brann i en gjenvinningsbil i
              Sunderland 28. april 2025. De konkluderte med at litium-ion-batterier var lagt i en
              gjenvinningsdunk, ble skadet av komprimatoren og gikk i termisk rusling. Sjåføren tømte
              det brennende lasset på et trygt sted, og ingen ble skadet – men bilen måtte tas ut av
              drift.<Ref n={[12]} />
            </p>

            <p style={pStyle}>
              Australske ABC har beskrevet hvordan litium-ion-branner skaper store problemer i avfalls-
              og gjenvinningssektoren der, med produkter som blinkende konsertarmbånd, mobiler og
              elsykler som gjengangere.<Ref n={[14]} /> Mønsteret er det samme over alt: flere batterier i
              hverdagen gir flere batterier på avveie.
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
            }}>
              <p style={{
                fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
                fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c', margin: 0,
              }}>
                Riktig håndtering av brukte batterier begynner med gode vaner – og et eget sted å
                samle dem.
              </p>
              <footer style={{
                marginTop: '14px', fontFamily: 'var(--font-manrope)', fontSize: '13px',
                letterSpacing: '0.04em', color: '#6b6f63',
              }}>
                — aBoks redaksjon
              </footer>
            </blockquote>

            <h2 style={h2Style}>Problemet starter hjemme – og på jobben</h2>

            <p style={pStyle}>
              Svært få kaster batterier i restavfallet med vilje. Det skjer fordi det ikke finnes et
              naturlig sted å legge dem. Batteriet byttes i fjernkontrollen, havner på kjøkkenbenken,
              blir med i en skuff – og forsvinner til slutt i søppelposen under en rydderunde. Avfall
              Sørs analyse av åtte tonn rest- og bioavfall høsten 2025 fant både småbatterier,
              litiumbatterier og elektronikk som mobiltelefoner og badevekter.<Ref n={[8]} />
            </p>

            <p style={pStyle}>
              Ragn-Sells tar et sorteringstillegg på 10 000 kroner per feilsortert batteri som oppdages
              i avfallet de mottar, blant annet fordi hvert funn utløser stans, manuell utsortering og
              ekstra sikring.<Ref n={[4]} /> Kostnaden rammer i første omgang næringskunder, men brannene
              påvirker alle: bransjen melder om kraftig økte forsikringspremier, og forsikring av
              avfallsanlegg er en del av det kommunale renovasjonsgebyret.<Ref n={[3, 7]} />
            </p>

            <h3 style={h3Style}>Synlige innsamlingspunkter virker</h3>
            <p style={pStyle}>
              Det som avgjør om batteriet havner riktig, er ofte rett og slett avstanden. Et fast,
              synlig og tydelig merket sted for brukte batterier gjør riktig valg til det enkleste
              valget.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>Hjemme:</strong> én fast plass, gjerne der batteriene byttes – i gangen, på
                kjøkkenet eller ved TV-en.
              </BulletItem>
              <BulletItem>
                <strong>På kontoret:</strong> en liten samleplass ved skrivebordet og ett felles
                innsamlingspunkt som tømmes jevnlig.
              </BulletItem>
              <BulletItem>
                <strong>På skoler og i barnehager:</strong> et synlig punkt som også blir en del av
                undervisningen om kildesortering.
              </BulletItem>
              <BulletItem>
                <strong>I borettslag og bedrifter:</strong> tydelig merking og en ansvarlig som leverer
                videre.
              </BulletItem>
            </ul>

            <h2 style={h2Style}>Slik sorterer du brukte batterier trygt</h2>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>
                <strong>Aldri i restavfallet.</strong> Heller ikke i papir-, plast- eller
                metallavfallet. Batterier er farlig avfall.<Ref n={[4]} />
              </NumberedItem>
              <NumberedItem n={2}>
                <strong>Teip polene.</strong> Særlig på litium-, 9V- og knappcellebatterier og
                batteripakker. En liten bit teip hindrer kortslutning.<Ref n={[4]} />
              </NumberedItem>
              <NumberedItem n={3}>
                <strong>Samle på ett fast sted.</strong> Tørt, utilgjengelig for små barn, borte fra
                varmekilder og brennbart materiale, gjerne i et rom med røykvarsler.<Ref n={[3]} />
              </NumberedItem>
              <NumberedItem n={4}>
                <strong>Lever jevnlig.</strong> Alle som selger batterier har plikt til å ta imot brukte
                batterier gratis, og de kan også leveres på kommunale gjenvinningsstasjoner.<Ref n={[9]} />{' '}
                Usikker? Sjekk{' '}
                <a href="https://sortere.no/" {...EXT} style={extLink}>Sortere.no</a>.<Ref n={[16]} />
              </NumberedItem>
              <NumberedItem n={5}>
                <strong>Lever elektronikk med batteriet i.</strong> Produkter med innebygd batteri
                leveres som EE-avfall i butikk eller på gjenvinningsstasjon.<Ref n={[3]} />
              </NumberedItem>
            </ol>

            <Callout label="Viktig sikkerhetsinformasjon" title="Skadde, oppsvulmede eller varme batterier" dark>
              Et batteri som er bulket, oppsvulmet, lekker, lukter rart eller kjennes varmt, skal ikke
              legges sammen med andre batterier – og ikke i en vanlig oppbevaringsboks av plast eller
              annet brennbart materiale. Hold det adskilt, plasser det på et ikke-brennbart underlag,
              ute av rekkevidde for barn og unna brennbare ting, og lever det så snart som mulig til
              mottak for farlig avfall på gjenvinningsstasjonen.<Ref n={[7, 4]} /> Virksomheter bør
              bruke brannsikre beholdere for skadde litiumbatterier.<Ref n={[4]} /> Ryker eller brenner
              batteriet: ring 110.
            </Callout>

            <Callout label="Godt å vite">
              Store batterier fra elsykler, elsparkesykler og verktøy hører ikke hjemme i en vanlig
              batteriboks. Lever dem separat hos forhandler eller på gjenvinningsstasjon, med polene
              beskyttet. Flere råd om trygg lagring finner du i{' '}
              <Link href="/inspirasjon/oppbevare-batterier-trygt-hjemme" style={extLink}>
                Hvordan oppbevare batterier trygt hjemme?
              </Link>
            </Callout>

            <h2 style={h2Style}>aBoks – et fast sted for de <em style={emStyle}>små batteriene</em></h2>

            <p style={pStyle}>
              Vi utviklet aBoks fordi vi kjente igjen problemet fra våre egne hjem: nye og brukte
              batterier om hverandre i en skuff, og ingen plan for de brukte. aBoks gir de vanlige
              husholdningsbatteriene en fast plass – med egne rom for nye AA og nye AAA, og et eget rom
              for de brukte som skal til gjenvinning. Du ser hva du har, og du ser når det er på tide å
              levere.
            </p>

            <p style={pStyle}>
              Det betyr ikke at boksen løser brannproblemet alene. aBoks er en organiserings- og
              innsamlingsløsning, ikke en brannsikker beholder. Den er laget for hele, vanlige
              batterier – ikke for skadde batterier eller batteripakker fra elsykler, verktøy og
              lignende. Det vi kan bidra med, er det som ofte mangler: en vane og et sted. Kombinert med
              teipede poler og jevnlig levering kan et eget rom for brukte batterier gjøre det enklere å
              holde dem unna restavfallet.
            </p>

            {/* Product CTA */}
            <aside style={{
              background: '#39402c', borderRadius: '20px',
              padding: 'clamp(28px,3vw,40px)', margin: '40px 0',
            }}>
              <h3 style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(24px,2.2vw,30px)',
                letterSpacing: '-0.01em', color: '#faf6ee', margin: '0 0 12px',
              }}>
                Velg riktig løsning for hjemmet og arbeidsplassen
              </h3>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                Alle modellene er designet og 3D-printet i Norge av biobasert PLA.
              </p>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
                gap: '12px', margin: '0 0 20px',
              }}>
                {PRODUCTS.map((p) => (
                  <Link key={p.href} href={p.href} style={{
                    display: 'block', background: 'rgba(250,246,238,0.08)',
                    border: '1px solid rgba(250,246,238,0.16)', borderRadius: '12px',
                    padding: '18px', textDecoration: 'none',
                  }}>
                    <span style={{
                      display: 'block', fontFamily: 'var(--font-cormorant)', fontWeight: 600,
                      fontSize: '21px', color: '#faf6ee', marginBottom: '6px',
                    }}>{p.name}</span>
                    <span style={{
                      display: 'block', fontFamily: 'var(--font-manrope)', fontSize: '14px',
                      lineHeight: 1.5, color: '#c8cebb',
                    }}>{p.desc}</span>
                  </Link>
                ))}
              </div>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', lineHeight: 1.6, color: '#c8cebb', margin: '0 0 20px' }}>
                Lever innholdet jevnlig til butikk eller gjenvinningsstasjon. Skadde batterier og store
                litiumbatteripakker skal ikke oppbevares i aBoks. Les mer om{' '}
                <Link href="/bedrifter" style={{ color: '#faf6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  løsninger for bedrifter
                </Link>
                .
              </p>
              <Link
                href="/produkter"
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px',
                  letterSpacing: '0.01em', padding: '13px 32px', borderRadius: '999px',
                  background: '#5e6a48', color: '#faf6ee', textDecoration: 'none',
                }}
              >
                Se alle aBoks-løsninger
              </Link>
            </aside>

            <h2 style={h2Style}>Små valg, stor forskjell</h2>

            <p style={pStyle}>
              Batteribrannene i avfallet er et problem som vokser i takt med antall batterier i
              hverdagen vår. Avfallsbransjen investerer i deteksjon og slukkeanlegg, men selv de beste
              anleggene kan bare dempe symptomene. Den virkelige løsningen ligger tidligere i kjeden –
              hos oss, i det øyeblikket vi bytter et batteri.
            </p>

            <p style={pStyle}>
              Neste gang fjernkontrollen går tom, kan du stille deg ett enkelt spørsmål: hvor skal det
              gamle batteriet nå? Har du et svar som ikke er søppelposen, har du allerede gjort jobben.
            </p>

            {/* FAQ */}
            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">
              Ofte stilte spørsmål om batteribrann
            </h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Kan et vanlig AA-batteri virkelig starte en brann?">
                Ja. LOOP oppgir at vanlige AA-batterier var årsaken til brannen på sorteringsanlegget
                Områ i 2025. Restenergi og kortslutning er nok til å gi varme, og i et miljø med papir og
                plast kan det starte en brann.<Ref n={[9]} />
              </FaqItem>
              <FaqItem question="Hvorfor skal jeg teipe polene på brukte batterier?">
                Teip leder ikke strøm. Den hindrer at polene kommer i kontakt med metall eller andre
                batterier, og dermed at batteriet kortslutter og blir varmt. Det er særlig viktig for
                litium-, 9V- og knappcellebatterier.
              </FaqItem>
              <FaqItem question="Hvor kan jeg levere brukte batterier gratis?">
                I alle butikker som selger batterier av samme type, uansett merke, og på kommunale
                gjenvinningsstasjoner. Skadde batterier leveres til mottak for farlig avfall på
                gjenvinningsstasjonen.
              </FaqItem>
              <FaqItem question="Er alle batterier like brannfarlige?">
                Nei. Litium-ion-batterier har høyest energitetthet og størst risiko ved skade. Alkaliske
                og oppladbare NiMH-batterier har lavere risiko, men kan også bli varme ved kortslutning –
                særlig mange sammen.
              </FaqItem>
              <FaqItem question="Hva gjør jeg med et oppsvulmet mobilbatteri?">
                Ikke lad det, ikke bruk det og ikke legg det sammen med andre batterier. Legg det på et
                ikke-brennbart underlag unna brennbart materiale, og lever det så snart som mulig til
                mottak for farlig avfall.
              </FaqItem>
              <FaqItem question="Kan jeg oppbevare alle typer batterier i aBoks?">
                Nei. aBoks er laget for hele, vanlige batterier som AA og AAA. Skadde batterier og store
                litiumbatteripakker fra elsykler, verktøy og lignende skal ikke oppbevares i aBoks, og
                aBoks er ikke en brannsikker beholder. Se{' '}
                <Link href="/vanlige-sporsmal" style={extLink}>vanlige spørsmål</Link> for mer.
              </FaqItem>
            </div>

            {/* Les også */}
            <div style={{ background: '#eee9de', borderRadius: '16px', padding: '28px 32px', margin: '0 0 40px' }}>
              <h2 style={{ ...h3Style, margin: '0 0 14px' }}>Les også</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {RELATED.map((r) => (
                  <BulletItem key={r.href}>
                    <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5e6a48' }}>
                      {r.category}
                    </span>{' '}
                    · <Link href={r.href} style={extLink}>{r.title}</Link>
                  </BulletItem>
                ))}
              </ul>
            </div>

            {/* Sources */}
            <div id="kilder" style={{ paddingTop: '28px', borderTop: '1px solid #ddd8ce' }}>
              <h2 style={{
                fontFamily: 'var(--font-manrope)', fontWeight: 700,
                fontSize: '13px', color: '#1a1d17', margin: '0 0 14px',
              }}>
                Kilder og videre lesning
              </h2>
              <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 28px' }}>
                {SOURCES.map((s, i) => (
                  <li
                    key={s.url}
                    id={`kilde-${i + 1}`}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px', scrollMarginTop: '140px' }}
                  >
                    <span style={{ flexShrink: 0, minWidth: '22px', fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62', fontWeight: 700 }}>
                      {i + 1}.
                    </span>
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', lineHeight: 1.6 }}>
                      <strong style={{ color: '#39402c', fontWeight: 600 }}>{s.pub}</strong> – {s.text}{' '}
                      <a href={s.url} {...EXT} style={extLink}>{s.host}</a>
                      {s.extra}
                    </span>
                  </li>
                ))}
              </ol>

              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', lineHeight: 1.6, margin: '0 0 20px' }}>
                Artikkelen er skrevet og kvalitetssikret av redaksjonen i aBoks.
              </p>

              <div style={{ marginTop: '8px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', marginRight: '8px' }}>Tags:</span>
                {[
                  'Batteribrann', 'Batterier i restavfall', 'Brann i avfallsanlegg', 'Brukte batterier',
                  'Batterisortering', 'Batterier gjenvinning', 'Litiumbatteri brann',
                  'Batteri kortslutning', 'Batteriboks',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
