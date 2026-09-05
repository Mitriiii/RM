import { render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiagnosticReport } from '@/lib/diagnostic/report';
import { ReportView } from './ReportView';

/**
 * A hand-computed fixture, not the output of buildDiagnosticReport — report.test.ts already
 * covers that pipeline. This is the regression test kickoff Session 6.6 asked for: a known
 * report, rendered, checked against known expected screen text — so a change that breaks the
 * report screen's actual rendering (the exact failure mode the "make Freyo market-ready"
 * companion kickoff started from: a working pipeline behind a screen that didn't show it)
 * gets caught here, not just in a data-layer test that never touches the DOM.
 */
const FIXTURE_REPORT: DiagnosticReport = {
  lanes: [
    {
      cityA: 'madrid',
      cityB: 'zaragoza',
      tripsAtoB: 3,
      tripsBtoA: 0,
      movementsObserved: 3,
      emptyDirection: 'BtoA',
      probableEmptyTrips: 3,
      distanceKm: 300,
      assumedVehicleCategory: 'articulated',
      emptyKm: 900,
      emptyDieselCostEur: 450,
      wellToTankGrams: 200_000,
      tankToWheelGrams: 800_000,
      wellToWheelGrams: 1_000_000,
      confidenceGrade: 'default',
    },
  ],
  insufficientDataLanes: [{ cityA: 'valencia', cityB: 'barcelona', movementsObserved: 1 }],
  totalEmptyKm: 900,
  totalEmptyDieselCostEur: 450,
  totalWellToTankGrams: 200_000 as DiagnosticReport['totalWellToTankGrams'],
  totalTankToWheelGrams: 800_000 as DiagnosticReport['totalTankToWheelGrams'],
  totalWellToWheelGrams: 1_000_000 as DiagnosticReport['totalWellToWheelGrams'],
  issues: [
    { rowNumber: 5, message: 'Unknown origin city "Atlantis" — not in the supported city list.' },
  ],
  routingEngineVersion: 'osrm-test-fixture-TEST_ONLY',
};

function renderReport(report: DiagnosticReport = FIXTURE_REPORT) {
  return render(
    <ReportView
      report={report}
      carbonPrices={[0, 45, 50, 63]}
      onCarbonPricesChange={() => {}}
      onStartOver={() => {}}
    />,
  );
}

describe('ReportView', () => {
  it('renders the routing engine and the summary totals', () => {
    renderReport();
    expect(screen.getByText(/osrm-test-fixture-TEST_ONLY/)).toBeInTheDocument();
    expect(screen.getAllByText('900 km').length).toBeGreaterThan(0);
    expect(screen.getAllByText('€450').length).toBeGreaterThan(0);
    expect(screen.getByText('1.000 t')).toBeInTheDocument();
  });

  it('cites the ETS2 price-containment anchor and the correct 2028 date', () => {
    renderReport();
    // 1.0 t CO2e x €45/t = €45 exactly — a round number chosen so this assertion isn't
    // sensitive to locale rounding behaviour.
    expect(screen.getAllByText(/€45\/tCO2e/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 January 2028/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/2027/)).not.toBeInTheDocument();
  });

  it('renders the lane row with movements observed, distance, empty km, and WTT/TTW/WTW', () => {
    renderReport();
    expect(screen.getByText(/madrid ↔ zaragoza/)).toBeInTheDocument();
    expect(screen.getByText('300 km')).toBeInTheDocument();
    expect(screen.getByText('200.0 kg')).toBeInTheDocument(); // WTT
    expect(screen.getByText('800.0 kg')).toBeInTheDocument(); // TTW
    expect(screen.getByText('1,000.0 kg')).toBeInTheDocument(); // WTW
    expect(screen.getByText('Default')).toBeInTheDocument(); // confidence badge
  });

  it('expands a lane row to show its derivation when clicked', () => {
    renderReport();
    expect(screen.queryByText(/WTT \+ TTW/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/madrid ↔ zaragoza/));

    expect(screen.getByText('WTT + TTW')).toBeInTheDocument();
    expect(screen.getByText(/majority equipment type on this lane/)).toBeInTheDocument();
  });

  it('reports the insufficient-data lane distinctly from both the main table and the issues list', () => {
    renderReport();
    expect(screen.getByText(/valencia ↔ barcelona: 1 movement observed/)).toBeInTheDocument();
  });

  it('reports excluded rows with their reason', () => {
    renderReport();
    expect(screen.getByText(/1 row excluded/)).toBeInTheDocument();
    expect(screen.getByText(/Row 5: Unknown origin city "Atlantis"/)).toBeInTheDocument();
  });

  it('shows a plain "no empty legs" message rather than an empty table when there are no lanes', () => {
    renderReport({ ...FIXTURE_REPORT, lanes: [] });
    expect(
      screen.getByText(
        /No probable empty legs found — every lane in this file is directionally balanced\./,
      ),
    ).toBeInTheDocument();
  });

  it('sorts the lane table by a clicked column', () => {
    const secondLane: DiagnosticReport['lanes'][number] = {
      ...FIXTURE_REPORT.lanes[0]!,
      cityA: 'barcelona',
      cityB: 'valencia',
      movementsObserved: 10,
      emptyKm: 100, // smaller than the fixture's 900 km lane
      wellToWheelGrams: 50_000,
    };
    renderReport({ ...FIXTURE_REPORT, lanes: [FIXTURE_REPORT.lanes[0]!, secondLane] });

    const rows = screen.getAllByRole('row');
    // Default sort is emptyKm descending: the 900km lane (madrid) should be first.
    expect(within(rows[1]!).getByText(/madrid ↔ zaragoza/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /empty km/i }));
    const rowsAfterSort = screen.getAllByRole('row');
    // Same column clicked again reverses to ascending: the 100km lane should now be first.
    expect(within(rowsAfterSort[1]!).getByText(/barcelona ↔ valencia/)).toBeInTheDocument();
  });

  it('calls onStartOver when the "Start over" button is clicked', () => {
    const onStartOver = vi.fn();
    render(
      <ReportView
        report={FIXTURE_REPORT}
        carbonPrices={[0, 45, 50, 63]}
        onCarbonPricesChange={() => {}}
        onStartOver={onStartOver}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(onStartOver).toHaveBeenCalledOnce();
  });
});
