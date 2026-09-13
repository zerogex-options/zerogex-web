import Link from 'next/link';
import { Link2 } from 'lucide-react';
import { integrationById, type IntegrationId } from '@/core/integrations';
import {
  BROKER_CONNECTIONS,
  brokersFor,
  platformNames,
  type BrokerConnection,
  type BrokerConnectionPath,
} from '@/core/brokerConnections';

// "Does this work with my broker?" — answered on the two Pro landings and on
// the hub, from core/brokerConnections.ts.
//
// The question is asked about IBKR almost exclusively, and it used to have no
// answer anywhere on the site, which made it a support email and sometimes a
// lost trial: the honest answer is that IBKR cannot host an indicator of its
// own AND that both auto-updating studies already run behind an IBKR account.
// Leaving that unsaid reads as "no".
//
// Two modes, because the two surfaces are answering slightly different
// questions. Given an `integration`, the visitor is already on that platform's
// page and only its own route to the broker is relevant. Given none — the hub
// — every route is listed, because choosing between the platforms is what that
// page is for.
//
// Deliberately a server component with no interactivity, same as
// IntegrationsStrip: it renders on public, crawlable, force-static pages and
// there is nothing here worth shipping JS for.

const CARD_STYLE = {
  border: '1px solid var(--border-default)',
  borderRadius: 18,
  padding: '28px',
  marginBottom: 48,
  background: 'var(--color-surface)',
} as const;

const BODY_STYLE = {
  margin: '0 0 16px 0',
  fontSize: 14,
  lineHeight: 1.7,
  color: 'var(--color-text-secondary)',
  maxWidth: 720,
} as const;

const STRONG = { color: 'var(--color-text-primary)' } as const;

function PathLine({ path }: { path: BrokerConnectionPath }) {
  const entry = integrationById(path.integration);
  return (
    <li style={{ marginBottom: 8 }}>
      <Link href={entry.href} style={{ color: 'var(--color-brand-accent)', fontWeight: 700 }}>
        {entry.platform}
      </Link>
      {' — '}
      {path.how}
    </li>
  );
}

function BrokerBlock({
  broker,
  paths,
  /** True on the hub, where no single platform is the subject of the page. */
  showAllPlatforms,
  /** Everything but the first block gets a rule above it. */
  divided,
}: {
  broker: BrokerConnection;
  paths: readonly BrokerConnectionPath[];
  showAllPlatforms: boolean;
  divided: boolean;
}) {
  return (
    <div
      style={
        divided
          ? { marginTop: 26, paddingTop: 26, borderTop: '1px solid var(--border-subtle)' }
          : undefined
      }
    >
      <h2
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          margin: '0 0 10px 0',
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '-0.3px',
        }}
      >
        <Link2 size={18} style={{ color: 'var(--color-brand-accent)' }} />
        Trading through {broker.broker}?
      </h2>

      <p style={BODY_STYLE}>
        <strong style={STRONG}>Yes — through {platformNames(paths)}</strong>, and there is nothing extra to
        buy: {showAllPlatforms ? 'those studies draw' : 'the study on this page draws'} the same levels
        whatever your charts are connected to. What we do <em>not</em> have is an indicator for{' '}
        {broker.short} itself: {broker.whyNoDirect}
      </p>

      <ul
        style={{
          margin: '0 0 16px 0',
          paddingLeft: 20,
          fontSize: 13.5,
          lineHeight: 1.7,
          color: 'var(--color-text-secondary)',
          maxWidth: 720,
        }}
      >
        {paths.map((path) => (
          <PathLine key={path.integration} path={path} />
        ))}
      </ul>

      <p style={BODY_STYLE}>{broker.requirement}</p>

      <p style={{ ...BODY_STYLE, marginBottom: 0, fontSize: 13, opacity: 0.85 }}>{broker.caveat}</p>
    </div>
  );
}

export default function BrokerConnectionNote({
  integration,
}: {
  /** The platform whose page this is. Omit on the hub to list every route. */
  integration?: IntegrationId;
}) {
  // Annotated rather than inferred: without it the two branches give the
  // ternary a union of two array types, and calling .map() on that is the
  // "no signatures are compatible" error rather than anything about brokers.
  const blocks: { broker: BrokerConnection; paths: readonly BrokerConnectionPath[] }[] = integration
    ? brokersFor(integration).map(({ broker, path }) => ({ broker, paths: [path] }))
    : BROKER_CONNECTIONS.map((broker) => ({ broker, paths: broker.paths }));

  // Nothing to say is a valid state: a manual-entry landing renders this and
  // gets no blocks, because typing four numbers in does not care what the
  // chart is connected to.
  if (blocks.length === 0) return null;

  return (
    <section style={CARD_STYLE}>
      {blocks.map(({ broker, paths }, index) => (
        <BrokerBlock
          key={broker.id}
          broker={broker}
          paths={paths}
          showAllPlatforms={integration === undefined}
          divided={index > 0}
        />
      ))}
    </section>
  );
}
