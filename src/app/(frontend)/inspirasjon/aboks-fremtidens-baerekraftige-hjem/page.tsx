import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'aBoks og fremtidens bærekraftige hjem – orden, trygghet og sirkulær hverdag',
  description:
    'aBoks og fremtidens bærekraftige hjem handler om orden i batteriene, tryggere oppbevaring og riktig gjenvinning. Praktiske råd, fakta og inspirasjon til et mer bærekraftig hjem.',
  alternates: {
    canonical: '/inspirasjon/aboks-fremtidens-baerekraftige-hjem',
  },
  openGraph: {
    title: 'aBoks og fremtidens bærekraftige hjem – orden, trygghet og sirkulær hverdag',
    description:
      'aBoks og fremtidens bærekraftige hjem handler om orden i batteriene, tryggere oppbevaring og riktig gjenvinning. Praktiske råd, fakta og inspirasjon til et mer bærekraftig hjem.',
  },
}

const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant)',
  fontWeight: 500,
  fontSize: 'clamp(26px,3vw,36px)',
  letterSpacing: '-0.015em',
  lineHeight: 1.2,
  color: '#1a1d17',
  margin: '52px 0 18px',
}

const h3Style: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant)',
  fontWeight: 600,
  fontSize: 'clamp(19px,1.8vw,22px)',
  letterSpacing: '-0.01em',
  lineHeight: 1.25,
  color: '#1a1d17',
  margin: '32px 0 10px',
}

const pStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: 'clamp(14px,1vw,16px)',
  lineHeight: 1.75,
  color: '#4a4e41',
  margin: '0 0 20px',
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '12px' }}>
      <span
        style={{
          flexShrink: 0,
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#5e6a48',
          marginTop: '8px',
        }}
      />
      <p style={{ ...pStyle, margin: 0 }}>{children}</p>
    </div>
  )
}

function StepItem({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start',
        padding: '22px 0',
        borderBottom: '1px solid #ddd8ce',
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: '#5e6a48',
          color: '#faf6ee',
          fontFamily: 'var(--font-manrope)',
          fontSize: '16px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n}
      </span>
      <div>
        <p style={{ ...h3Style, margin: '6px 0 6px' }}>{title}</p>
        <p style={{ ...pStyle, margin: 0 }}>{children}</p>
      </div>
    </div>
  )
}

function Callout({ label, title, children }: { label?: string; title?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#eee9de',
        borderLeft: '4px solid #5e6a48',
        borderRadius: '14px',
        padding: '24px 28px',
        margin: '34px 0',
      }}
    >
      {label && (
        <p
          style={{
            fontFamily: 'var(--font-manrope)',
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#5e6a48',
            margin: '0 0 8px',
          }}
        >
          {label}
        </p>
      )}
      {title && <p style={{ ...h3Style, margin: '0 0 10px' }}>{title}</p>}
      <div style={{ ...pStyle, margin: 0 }}>{children}</div>
    </div>
  )
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details
      style={{
        background: '#f3ede2',
        borderRadius: '14px',
        marginBottom: '10px',
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          listStyle: 'none',
          padding: '20px 52px 20px 22px',
          fontFamily: 'var(--font-manrope)',
          fontWeight: 700,
          fontSize: 'clamp(14px,1vw,16px)',
          color: '#1a1d17',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        {q}
        <span
          style={{
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: 'var(--font-manrope)',
            fontSize: '22px',
            fontWeight: 300,
            color: '#5e6a48',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          +
        </span>
      </summary>
      <div style={{ padding: '0 22px 22px' }}>
        <p style={{ ...pStyle, margin: 0 }}>{children}</p>
      </div>
    </details>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-manrope)',
        fontWeight: 600,
        fontSize: '11px',
        letterSpacing: '0.06em',
        color: '#5e6a48',
        background: '#eee9de',
        borderRadius: '100px',
        padding: '5px 14px',
        marginRight: '8px',
        marginBottom: '8px',
      }}
    >
      {children}
    </span>
  )
}

export default function AaBoksOgFremtidensBaerekraftigeHjemPage() {
  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: 'clamp(28px,4vw,56px) clamp(20px,5vw,48px) clamp(80px,10vw,120px)',
        }}
      >

        {/* Breadcrumb */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-manrope)',
            fontSize: '13px',
            color: '#6b6f63',
            marginBottom: '40px',
          }}
        >
          <Link href="/" style={{ color: '#6b6f63', textDecoration: 'none' }}>Hjem</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <Link href="/inspirasjon" style={{ color: '#6b6f63', textDecoration: 'none' }}>Inspirasjon</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Bærekraftig hjem</span>
        </div>

        {/* Header */}
        <p
          style={{
            fontFamily: 'var(--font-manrope)',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#5e6a48',
            margin: '0 0 16px',
            textAlign: 'center',
          }}
        >
          Bærekraftig hjem · Guide
        </p>

        <h1
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            fontSize: 'clamp(32px,5vw,56px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            color: '#1a1d17',
            margin: '0 0 22px',
            textAlign: 'center',
          }}
        >
          aBoks og fremtidens bærekraftige hjem
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-manrope)',
            fontSize: 'clamp(16px,1.3vw,18px)',
            lineHeight: 1.65,
            color: '#4a4e41',
            margin: '0 0 28px',
            textAlign: 'center',
          }}
        >
          aBoks og fremtidens bærekraftige hjem henger tettere sammen enn de fleste tenker over. For når noe
          så lite som et batteri får sin faste plass, blir hverdagen ikke bare ryddigere – den blir tryggere
          og mer sirkulær. Her ser vi nærmere på hvordan smart oppbevaring av batterier er et av de enkleste
          stegene mot et hjem som tåler framtiden.
        </p>

        {/* Meta */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px 24px',
            fontFamily: 'var(--font-manrope)',
            fontSize: '13px',
            color: '#6b6f63',
            paddingBottom: '28px',
            borderBottom: '1px solid #ddd8ce',
            marginBottom: '36px',
          }}
        >
          <span>Av <strong style={{ color: '#1a1d17', fontWeight: 600 }}>Redaksjonen</strong></span>
          <span>Oppdatert <strong style={{ color: '#1a1d17', fontWeight: 600 }}>juni 2026</strong></span>
          <span>Lesetid <strong style={{ color: '#1a1d17', fontWeight: 600 }}>7 min</strong></span>
        </div>

        {/* Intro */}
        <p style={pStyle}>
          Vi snakker gjerne om bærekraft i de store ordene: solceller, elbiler og energieffektive hus. Men
          det meste av forandringen skjer i det små, i de daglige rutinene de fleste av oss knapt legger
          merke til. En skuff full av løse batterier er et godt eksempel. Den ser uskyldig ut, men den
          forteller en historie om kasting av fullt brukbare ressurser, om brukte celler som aldri når
          gjenvinningen, og om en liten, men reell brannrisiko. Skal vi bygge fremtidens bærekraftige hjem,
          må vi tørre å ta tak i akkurat disse hverdagsdetaljene.
        </p>

        <p style={pStyle}>
          Tall fra bransjen viser hvor stort omfanget er. En gjennomsnittlig norsk husholdning har til
          enhver tid <strong>over 70 batterier</strong> i hjemmet, fordelt på alt fra fjernkontroller og
          leker til røykvarslere og elektriske tannbørster. Samtidig kjøper vi mer enn 2 000 tonn
          husholdningsbatterier hvert år. Når en stor andel av disse havner feil – i restavfallet, i
          naturen eller bare glemt i en skuff – går både verdifulle materialer og sikkerhet tapt. Det er
          her tanken bak aBoks treffer noe vesentlig: orden er ikke bare estetikk, det er bærekraft i praksis.
        </p>

        {/* H2: Hvorfor batterier er en bærekraftssak */}
        <h2 style={h2Style}>Hvorfor batterier er en bærekraftssak</h2>

        <p style={pStyle}>
          Et brukt batteri er ikke søppel. Det er et lite lager av metaller som sink, litium, nikkel og
          kobolt – råvarer verden trenger stadig mer av, og som i dag ofte hentes fra gruver på andre
          kontinenter med store klimautslipp og naturinngrep. Når batteriene leveres til gjenvinning, kan
          disse stoffene utvinnes og brukes om igjen i nye produkter. Bly i blybatterier kan for eksempel
          gjenvinnes et nærmest ubegrenset antall ganger.
        </p>

        <p style={pStyle}>
          Norge er allerede et foregangsland. Ifølge{' '}
          <a
            href="https://www.regjeringen.no/contentassets/a894b5594dbf4eccbec0d65f491e4809/batteristrategien_web2.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#5e6a48', textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            regjeringens batteristrategi
          </a>{' '}
          har vi et godt utbygd innsamlingssystem og en industri som satser tungt på sirkulære løsninger.
          EUs nye batteriforordning skjerper kravene ytterligere, med blant annet et eget «batteripass»
          som dokumenterer hvor materialene kommer fra og hvilket klimafotavtrykk de har. Men selv det
          beste systemet er avhengig av at hver enkelt av oss leverer inn det vi bruker. Og det er nettopp
          det siste leddet – fra skuffen din til innsamlingspunktet – som ofte svikter.
        </p>

        {/* Blockquote */}
        <blockquote
          style={{
            borderLeft: '4px solid #5e6a48',
            margin: '40px 0',
            padding: '20px 28px',
            background: '#eee9de',
            borderRadius: '0 12px 12px 0',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              fontSize: 'clamp(20px,2.2vw,26px)',
              lineHeight: 1.4,
              color: '#1a1d17',
              margin: '0 0 12px',
              fontStyle: 'italic',
            }}
          >
            Bærekraft i hjemmet handler sjelden om store ofre. Det handler om å gjøre det enkle valget
            enkelt – slik at det riktige også blir det naturlige.
          </p>
          <footer
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: '13px',
              color: '#6b6f63',
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            Redaksjonens betraktning
          </footer>
        </blockquote>

        {/* H2: Sikkerheten du sannsynligvis overser */}
        <h2 style={h2Style}>Sikkerheten du sannsynligvis overser</h2>

        <p style={pStyle}>
          Det mange ikke vet, er at løse, brukte batterier kan utgjøre en brannrisiko. Det er nesten
          alltid litt restenergi igjen i et brukt batteri, og dersom polene kommer i kontakt med metall –
          mynter, nøkler, andre batterier – kan det oppstå kortslutning. En enkelt gnist kan være nok.{' '}
          <a
            href="https://www.dsb.no/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#5e6a48', textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            Direktoratet for samfunnssikkerhet og beredskap (DSB)
          </a>{' '}
          og brannvesen over hele landet advarer mot dette, og tallene er tydelige: de siste årene har det
          oppstått godt over 200 branner ved norske avfallsanlegg, mange av dem knyttet til batterier på
          avveie.
        </p>

        <p style={pStyle}>Brannvesenets råd er enkle, og verdt å gjenta:</p>

        <div style={{ margin: '4px 0 24px' }}>
          <BulletItem>
            <strong>Teip polene</strong> på brukte batterier med vanlig, gjerne gjennomsiktig tape for å hindre kortslutning.
          </BulletItem>
          <BulletItem>
            <strong>Samle dem i en egen beholder</strong> med lokk, atskilt fra metallgjenstander og andre batterier.
          </BulletItem>
          <BulletItem>
            <strong>Lever jevnlig</strong> til butikk eller miljøstasjon – ikke la dem hope seg opp i årevis.
          </BulletItem>
          <BulletItem>
            <strong>Aldri i restavfallet</strong>, og selvsagt ikke i naturen.
          </BulletItem>
        </div>

        <Callout label="Visste du at" title="Halvparten av oss bommer på sorteringen">
          Plukkanalyser tyder på at det kastes millionvis av batterier i restavfallet i Norge hvert eneste
          år. Et eget, fast rom for brukte batterier hjemme er kanskje den mest undervurderte oppgraderingen
          du kan gjøre for både sikkerhet og miljø.
        </Callout>

        {/* H2: Fra kaos til system */}
        <h2 style={h2Style}>Fra kaos til system: slik kommer du i gang</h2>

        <p style={pStyle}>
          Det fine med batterirot er at det er overraskende lett å løse. Det krever ingen renovering og
          ingen ny app – bare et lite system du faktisk bruker. Slik bygger du det:
        </p>

        <div style={{ margin: '8px 0 24px', borderTop: '1px solid #ddd8ce' }}>
          <StepItem n={1} title="Samle alt på ett sted.">
            Gå gjennom skuffer, sekker, garasje og bod, og finn fram alle løse batterier du har liggende.
          </StepItem>
          <StepItem n={2} title="Skill nytt fra brukt.">
            Test de du er usikker på, og hold de fulle adskilt fra de tomme – ellers ender du med å kaste gode batterier.
          </StepItem>
          <StepItem n={3} title="Gi hver type sin faste plass.">
            AA for seg, AAA for seg, og et eget, tydelig rom for de brukte som skal til gjenvinning.
          </StepItem>
          <StepItem n={4} title="Plasser systemet der du faktisk er.">
            Ved TV-en, på kjøkkenet eller på hjemmekontoret – tilgjengelighet er det som gjør at rutinen varer.
          </StepItem>
          <StepItem n={5} title="Tøm det brukte rommet jevnlig">
            ved å levere til nærmeste butikk eller miljøstasjon.
          </StepItem>
        </div>

        <p style={pStyle}>
          Det er i punkt tre og fire mange tradisjonelle løsninger faller igjennom. Et syltetøyglass på
          loftet er trygt, men det er lite sannsynlig at du holder orden på hva som er fullt og tomt – og
          enda mindre sannsynlig at de brukte faktisk blir levert inn. Et gjennomtenkt system løser begge
          deler samtidig.
        </p>

        {/* Product block */}
        <div
          style={{
            background: '#39402c',
            borderRadius: '20px',
            padding: 'clamp(28px,4vw,44px)',
            margin: '44px 0',
            color: '#faf6ee',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontWeight: 700,
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(250,246,238,0.6)',
              margin: '0 0 14px',
            }}
          >
            Praktisk løsning
          </p>
          <h3
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              fontSize: 'clamp(22px,2.5vw,30px)',
              letterSpacing: '-0.01em',
              lineHeight: 1.15,
              color: '#faf6ee',
              margin: '0 0 16px',
            }}
          >
            Slik gjør aBoks det enkelt
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: 'clamp(14px,1vw,15px)',
              lineHeight: 1.7,
              color: 'rgba(250,246,238,0.85)',
              margin: '0 0 14px',
            }}
          >
            aBoks er en norskdesignet batteriorganisator med tre adskilte rom: ett for nye AA, ett for nye
            AAA og ett eget rom for brukte batterier som skal til gjenvinning. Du ser på et blikk hva du
            har, og hva som skal leveres inn. Det egne rommet for brukte celler er nettopp det leddet de
            fleste mangler – og det som gjør at batteriene faktisk når innsamlingen i stedet for å bli
            liggende.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: 'clamp(14px,1vw,15px)',
              lineHeight: 1.7,
              color: 'rgba(250,246,238,0.85)',
              margin: '0 0 22px',
            }}
          >
            Med plass til 20 AA og 36 AAA, en matt og slitesterk finish som passer i ethvert rom, og et
            format laget for både hverdagen og hytteturen, er den laget for å bli stående framme – der den
            faktisk blir brukt.
          </p>
          <Link
            href="/produkter"
            data-btn
            style={{
              display: 'inline-block',
              background: '#faf6ee',
              color: '#39402c',
              fontFamily: 'var(--font-manrope)',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.03em',
              textDecoration: 'none',
              padding: '14px 28px',
              borderRadius: '100px',
            }}
          >
            Se aBoks og fargene →
          </Link>
        </div>

        {/* H2: Bærekraft du kan se og kjenne */}
        <h2 style={h2Style}>Bærekraft du kan se og kjenne</h2>

        <p style={pStyle}>
          En av Skandinavias styrker innen design er troen på at det funksjonelle og det vakre ikke trenger
          å stå i motsetning. Et bærekraftig hjem skal ikke føles som et kompromiss. Det skal føles rolig,
          oversiktlig og gjennomtenkt. Når oppbevaringsløsningene dine er laget for å vare, i materialer
          og farger som tåler å stå framme i årevis, slipper du å erstatte dem – og du får en daglig
          påminnelse om at de små systemene faktisk fungerer.
        </p>

        <p style={pStyle}>
          Her møtes tre prinsipper som definerer det skandinaviske hjemmet:{' '}
          <strong>enkelhet</strong> (alt har sin plass),{' '}
          <strong>funksjon</strong> (systemet løser et reelt problem) og{' '}
          <strong>kvalitet</strong> (det er laget for å vare, ikke for å kastes). Det er den samme
          tankegangen som ligger bak alt fra møblene vi arver til hvordan vi sorterer avfallet vårt.
        </p>

        {/* Comparison table */}
        <p
          style={{
            fontFamily: 'var(--font-manrope)',
            fontSize: '13px',
            color: '#6b6f63',
            margin: '28px 0 8px',
            fontStyle: 'italic',
          }}
        >
          Tre vanlige løsninger for brukte batterier – sammenliknet
        </p>
        <div style={{ overflowX: 'auto', margin: '0 0 32px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--font-manrope)',
              fontSize: 'clamp(13px,0.9vw,15px)',
              background: '#f3ede2',
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          >
            <thead>
              <tr>
                {['Løsning', 'Oversikt', 'Trygghet', 'Sjanse for levering'].map((h) => (
                  <th
                    key={h}
                    style={{
                      background: '#39402c',
                      color: '#faf6ee',
                      fontWeight: 700,
                      fontSize: '12px',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '13px 18px',
                      textAlign: 'left',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Løse i skuffen', 'Dårlig', 'Lav', 'Liten'],
                ['Syltetøyglass på loftet', 'Middels', 'God', 'Middels'],
                ['Dedikert organisator med eget rom', 'Svært god', 'God', 'Høy'],
              ].map((row, i) => (
                <tr key={row[0]} style={{ background: i % 2 === 1 ? '#faf6ee' : '#f3ede2' }}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      style={{
                        padding: '13px 18px',
                        color: j === 0 ? '#1a1d17' : '#4a4e41',
                        fontWeight: j === 0 ? 600 : 400,
                        borderBottom: i < 2 ? '1px solid #ddd8ce' : 'none',
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* H2: Et lite steg med stor effekt */}
        <h2 style={h2Style}>Et lite steg med stor effekt</h2>

        <p style={pStyle}>
          Det er lett å føle at egne valg drukner i de store tallene. Men sirkulær økonomi fungerer nettopp
          fordi den er summen av millioner små handlinger. Når du leverer batteriene dine, sender du
          verdifulle metaller tilbake i kretsløpet i stedet for ned i en gruve. Når du oppbevarer dem
          trygt, fjerner du en brannrisiko fra hjemmet ditt. Og når du gir dem en fast plass, gjør du det
          riktige valget til det enkleste.
        </p>

        <p style={pStyle}>
          Fremtidens bærekraftige hjem bygges ikke på én stor beslutning, men på mange små, gode vaner
          som henger sammen. Batteriene er et godt sted å begynne – fordi de er konkrete, fordi de er
          trygge å ta tak i, og fordi resultatet er synlig allerede fra dag én.
        </p>

        {/* FAQ */}
        <h2 style={{ ...h2Style, margin: '52px 0 24px' }}>Ofte stilte spørsmål</h2>

        <FaqItem q="Hvorfor kan jeg ikke bare kaste batterier i restavfallet?">
          Batterier regnes som farlig avfall og skal alltid leveres til gjenvinning. Havner de i
          restavfallet, kan de utgjøre brannfare i avfallsbeholderen, i renovasjonsbilen og på
          gjenvinningsanlegget. I tillegg går verdifulle metaller tapt. Alt innholdet i et batteri kan i
          prinsippet gjenvinnes til nye produkter.
        </FaqItem>

        <FaqItem q="Hvor leverer jeg brukte batterier?">
          Du kan levere dem gratis til de fleste dagligvarebutikker og elektronikkbutikker som selger
          tilsvarende batterier – de er pliktige til å ta imot. Du kan også levere til kommunens
          miljøstasjon. Det finnes over 20 000 innsamlingssteder for batterier i Norge, så det er sjelden
          langt til nærmeste mottak.
        </FaqItem>

        <FaqItem q="Må jeg virkelig teipe batteripolene?">
          For litiumbatterier anbefales det sterkt, og for andre typer er det et godt sikkerhetstiltak.
          Teiping hindrer at polene kortslutter mot metall eller andre batterier, noe som i verste fall kan
          starte en brann. Et eget, lukket rom for brukte batterier reduserer kontakten med
          metallgjenstander og gjør oppbevaringen tryggere.
        </FaqItem>

        <FaqItem q="Hvor mange batterier har egentlig en vanlig husholdning?">
          Bransjetall anslår at en norsk husholdning til enhver tid har over 70 batterier i bruk eller på
          lager – fordelt på fjernkontroller, leker, klokker, røykvarslere, tannbørster og mye mer. Det
          forklarer hvorfor et fast system raskt gir merkbar effekt.
        </FaqItem>

        <FaqItem q="Hva er det viktigste jeg kan gjøre for et mer bærekraftig hjem?">
          Begynn med vanene du gjentar daglig. Riktig sortering og oppbevaring av batterier, faste plasser
          for ting, og innkjøp av kvalitetsløsninger som varer, gir mer effekt over tid enn enkeltinnkjøp.
          Poenget er å gjøre det riktige valget til det enkleste valget.
        </FaqItem>

        {/* CTA block */}
        <div
          style={{
            background: '#5e6a48',
            borderRadius: '20px',
            padding: 'clamp(32px,4vw,52px)',
            margin: '56px 0 0',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              fontSize: 'clamp(24px,3vw,36px)',
              letterSpacing: '-0.015em',
              lineHeight: 1.15,
              color: '#faf6ee',
              margin: '0 0 14px',
            }}
          >
            Klar for litt mer orden – og litt mer bærekraft?
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: 'clamp(14px,1vw,16px)',
              lineHeight: 1.65,
              color: 'rgba(250,246,238,0.85)',
              margin: '0 0 24px',
              maxWidth: '440px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Samle batteriene på ett sted, gjør gjenvinning til en vane, og la hjemmet ditt jobbe litt
            smartere for deg.
          </p>
          <Link
            href="/produkter"
            data-btn
            style={{
              display: 'inline-block',
              background: '#faf6ee',
              color: '#39402c',
              fontFamily: 'var(--font-manrope)',
              fontWeight: 700,
              fontSize: '15px',
              letterSpacing: '0.03em',
              textDecoration: 'none',
              padding: '15px 34px',
              borderRadius: '100px',
            }}
          >
            Utforsk aBoks
          </Link>
        </div>

        {/* Tags */}
        <div style={{ marginTop: '48px' }}>
          {[
            'bærekraftig hjem',
            'batteriorganisering',
            'batterigjenvinning',
            'hjemmeorganisering',
            'brannsikkerhet',
            'sirkulær økonomi',
            'skandinavisk design',
            'aBoks',
          ].map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>

        {/* Sources */}
        <div
          style={{
            marginTop: '44px',
            paddingTop: '28px',
            borderTop: '1px solid #ddd8ce',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#6b6f63',
              margin: '0 0 14px',
            }}
          >
            Kilder og videre lesning
          </p>
          {[
            {
              label: 'Statistisk sentralbyrå (SSB) – Avfall og gjenvinning',
              href: 'https://www.ssb.no/natur-og-miljo/avfall',
            },
            {
              label: 'Miljødirektoratet – Avfall og farlig avfall',
              href: 'https://www.miljodirektoratet.no/',
            },
            {
              label: 'Regjeringen – Norges batteristrategi',
              href: 'https://www.regjeringen.no/contentassets/a894b5594dbf4eccbec0d65f491e4809/batteristrategien_web2.pdf',
            },
            {
              label: 'DSB – Brannsikkerhet og batterier',
              href: 'https://www.dsb.no/',
            },
          ].map((s) => (
            <p key={s.href} style={{ ...pStyle, fontSize: '13px', margin: '0 0 8px' }}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#5e6a48', textDecoration: 'underline', textUnderlineOffset: '3px' }}
              >
                {s.label}
              </a>
            </p>
          ))}
        </div>

      </div>
    </main>
  )
}
