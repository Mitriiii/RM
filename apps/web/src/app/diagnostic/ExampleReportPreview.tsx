import { DataQualityBadge } from '@/components/ui/DataQualityBadge';
import { Caption, DataValue, Label } from '@/components/ui/Typography';

interface ExampleRow {
  readonly lane: string;
  readonly emptyKm: string;
  readonly dieselCost: string;
  readonly co2e: string;
  readonly grade: 'primary' | 'modelled' | 'default';
}

const EXAMPLE_ROWS: readonly ExampleRow[] = [
  {
    lane: 'Madrid ↔ Zaragoza',
    emptyKm: '624 km',
    dieselCost: '€319',
    co2e: '653.1 kg',
    grade: 'modelled',
  },
  {
    lane: 'Madrid ↔ Barcelona',
    emptyKm: '213 km',
    dieselCost: '€109',
    co2e: '223.4 kg',
    grade: 'default',
  },
  {
    lane: 'Zaragoza ↔ Barcelona',
    emptyKm: '148 km',
    dieselCost: '€76',
    co2e: '155.2 kg',
    grade: 'modelled',
  },
];

/**
 * Sells the instrument before anyone uploads anything: shows exactly the density and
 * type system the real report uses, with numbers that are clearly fictional rather than
 * a marketing screenshot — what a prospect sees here is honestly what they'll get.
 */
export function ExampleReportPreview() {
  return (
    <div className="border border-slate-300">
      <div className="flex items-center justify-between border-b border-slate-300 bg-slate-50 px-4 py-2">
        <Label>Example output</Label>
        <Caption>Illustrative data — not a live result</Caption>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="px-4 py-2 text-label font-medium text-slate-600">Lane</th>
              <th className="px-4 py-2 text-right text-label font-medium text-slate-600">
                Empty km
              </th>
              <th className="px-4 py-2 text-right text-label font-medium text-slate-600">
                Diesel cost
              </th>
              <th className="px-4 py-2 text-right text-label font-medium text-slate-600">CO2e</th>
              <th className="px-4 py-2 text-left text-label font-medium text-slate-600">
                Data quality
              </th>
            </tr>
          </thead>
          <tbody>
            {EXAMPLE_ROWS.map((row) => (
              <tr key={row.lane} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 text-body text-slate-800">{row.lane}</td>
                <td className="px-4 py-2 text-right">
                  <DataValue>{row.emptyKm}</DataValue>
                </td>
                <td className="px-4 py-2 text-right">
                  <DataValue>{row.dieselCost}</DataValue>
                </td>
                <td className="px-4 py-2 text-right">
                  <DataValue>{row.co2e}</DataValue>
                </td>
                <td className="px-4 py-2">
                  <DataQualityBadge grade={row.grade} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
