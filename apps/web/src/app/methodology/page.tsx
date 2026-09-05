import Link from 'next/link';
import { Caption, PageTitle, Prose, SectionTitle } from '@/components/ui/Typography';

export const metadata = {
  title: 'Methodology — Freyo',
  description: "How Freyo calculates freight emissions, and what is and isn't audit-grade yet.",
};

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <PageTitle>Methodology</PageTitle>
      <Prose className="mt-3">
        How Freyo calculates transport emissions, and — just as importantly — an honest account of
        what is and isn&apos;t audit-grade in the product today.
      </Prose>

      <section className="mt-10">
        <SectionTitle>The model</SectionTitle>
        <Prose className="mt-3">
          Freyo&apos;s engine follows the structure of EN ISO 14083:2023. A shipment&apos;s journey
          — a <em>transport chain</em> — decomposes into individual vehicle movements, or{' '}
          <em>legs</em>. Each leg belongs to a <em>transport operation category</em>: a grouping by
          vehicle type, fuel, load profile, and region, which carries its own{' '}
          <em>emission intensity</em> — grams of CO2e per tonne-kilometre.
        </Prose>
        <Prose className="mt-3">
          A leg&apos;s emissions are its transport activity — mass carried times routed road
          distance, never a straight-line estimate — multiplied by that intensity. We report three
          figures for every calculation: well-to-tank (fuel production and distribution),
          tank-to-wheel (combustion), and well-to-wheel, their sum and the headline number.
        </Prose>
      </section>

      <section className="mt-10">
        <SectionTitle>Data quality, always labelled</SectionTitle>
        <Prose className="mt-3">
          Every figure Freyo produces carries a grade: <strong>primary</strong> (metered fuel or
          telematics data), <strong>modelled</strong> (estimated from a model, not directly
          metered), or <strong>default</strong> (a registry default value, the least certain grade).
          The grade travels with the number everywhere it appears — a figure is never shown without
          knowing how sure we are of it.
        </Prose>
      </section>

      <section className="mt-10">
        <SectionTitle>Reproducible, permanently</SectionTitle>
        <Prose className="mt-3">
          Every calculation stores the inputs that produced it, the exact version of the
          emission-factor set used, and the version of the calculation engine itself. Re-running a
          stored calculation years later returns the same answer, byte for byte — a calculation is
          never edited in place; a correction is a new record that references the one it supersedes.
        </Prose>
      </section>

      <section className="mt-10 border border-amber-400 bg-amber-50 p-4">
        <SectionTitle>Where we are today</SectionTitle>
        <Prose className="mt-3 text-amber-900">
          Freyo is early. The calculation engine above is built and tested, but the versioned
          emission-factor registry it depends on is not yet populated with verified figures from
          official sources (the GLEC Framework, EU default values, ISO 14083&apos;s own Annex
          defaults) — and Freyo does not hold any third-party certification against ISO 14083 today.
          We will not claim one until an accredited body has actually assessed us. Every number the
          product shows right now is either a placeholder clearly marked as such, or a diagnostic
          estimate explicitly labelled as one — never presented as an audited figure it isn&apos;t.
        </Prose>
      </section>

      <Caption className="mt-10">
        <Link href="/diagnostic" className="underline">
          ← Back to the diagnostic
        </Link>
      </Caption>
    </main>
  );
}
