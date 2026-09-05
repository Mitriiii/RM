import { render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MODELLED_MIN_MOVEMENTS_OBSERVED, type DiagnosticReport } from '@/lib/diagnostic/report';
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

function clickLane(name: string | RegExp) {
  fireEvent.click(screen.getAllByText(name)[0]!);
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
    expect(screen.getAllByText(/madrid ↔ zaragoza/).length).toBeGreaterThan(0);
    expect(screen.getByText('300 km')).toBeInTheDocument();
    expect(screen.getByText('200.0 kg')).toBeInTheDocument(); // WTT
    expect(screen.getByText('800.0 kg')).toBeInTheDocument(); // TTW
    expect(screen.getAllByText('1,000.0 kg').length).toBeGreaterThan(0); // WTW
    expect(screen.getByText('Default')).toBeInTheDocument(); // confidence badge
  });

  it('expands a lane row to show its derivation when clicked', () => {
    renderReport();
    expect(screen.queryByText(/WTT \+ TTW/)).not.toBeInTheDocument();

    clickLane(/madrid ↔ zaragoza/);

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
    expect(within(rows[1]!).getAllByText(/madrid ↔ zaragoza/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /empty km/i }));
    const rowsAfterSort = screen.getAllByRole('row');
    // Same column clicked again reverses to ascending: the 100km lane should now be first.
    expect(within(rowsAfterSort[1]!).getAllByText(/barcelona ↔ valencia/).length).toBeGreaterThan(
      0,
    );
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

  describe('plain-language layer (Session 6.7)', () => {
    it('derives the plain-language headline from the exact same totals as the technical summary row, never a second calculation', () => {
      renderReport();
      const headline = screen.getByTestId('report-headline');
      // Same figures the dense technical summary row shows for totalEmptyKm and
      // totalEmptyDieselCostEur — proving there is one source of truth, not two restatements
      // that could quietly drift apart.
      expect(within(headline).getByText('900 km')).toBeInTheDocument();
      expect(within(headline).getByText('€450')).toBeInTheDocument();
      // totalWellToWheelGrams (1_000_000 g) expressed in kg — the same total the lane row's
      // WTW column shows in kg, just a different unit than the tonnes used in the dense row.
      expect(within(headline).getByText('1,000.0 kg')).toBeInTheDocument();
    });

    it('does not render the plain-language headline when there are no lanes (the dedicated empty state covers that case)', () => {
      renderReport({ ...FIXTURE_REPORT, lanes: [] });
      expect(screen.queryByTestId('report-headline')).not.toBeInTheDocument();
    });

    it('keeps the technical WTT/TTW/WTW column terms visible alongside plain-language labels', () => {
      renderReport();
      expect(screen.getByText('Fuel production')).toBeInTheDocument();
      expect(screen.getByText('(WTT)')).toBeInTheDocument();
      expect(screen.getByText('Combustion')).toBeInTheDocument();
      expect(screen.getByText('(TTW)')).toBeInTheDocument();
      expect(screen.getByText('Total CO2e')).toBeInTheDocument();
      expect(screen.getByText('(WTW)')).toBeInTheDocument();
    });

    it('explains well-to-wheel in plain language on demand, closed by default', () => {
      renderReport();
      expect(
        screen.queryByText(/fuel production plus combustion combined/),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'What is well-to-wheel CO2e?' }));

      expect(screen.getByText(/fuel production plus combustion combined/)).toBeInTheDocument();
    });

    it("explains a lane's confidence grade using the real movements-observed count and the real threshold constant, not a separately hand-written claim", () => {
      renderReport();
      fireEvent.click(
        screen.getByRole('button', {
          name: 'What does this confidence grade mean for madrid to zaragoza?',
        }),
      );

      // The fixture lane has 3 observed movements, below MODELLED_MIN_MOVEMENTS_OBSERVED (5) —
      // both numbers must appear, sourced from the lane data and the exported threshold.
      expect(screen.getByText(/only 3 observed movements/)).toBeInTheDocument();
      expect(
        screen.getByText(new RegExp(`below the ${MODELLED_MIN_MOVEMENTS_OBSERVED}-movement`)),
      ).toBeInTheDocument();
    });

    it('shows a visible expand affordance on lane rows so the drill-down is discoverable without hovering', () => {
      renderReport();
      expect(screen.getByText(/Click a lane to see the full calculation/)).toBeInTheDocument();
    });

    it('leads an expanded derivation with a plain-language sentence naming the real movement count and routing engine, ahead of the technical trace', () => {
      renderReport();
      clickLane(/madrid ↔ zaragoza/);

      expect(
        screen.getByText(/This number comes from 3 observed movements on this lane/),
      ).toBeInTheDocument();
      expect(screen.getAllByText(/osrm-test-fixture-TEST_ONLY/).length).toBeGreaterThan(0);
      // The technical trace must still be present in full underneath — nothing removed.
      expect(screen.getByText('WTT + TTW')).toBeInTheDocument();
    });
  });
});
