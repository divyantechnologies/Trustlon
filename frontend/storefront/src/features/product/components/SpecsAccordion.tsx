'use client';
import type { Product } from '../types';
import type { CategoryConfig } from '../categoryConfig';
export function SpecsAccordion({
  specs = [],
  config,
}: {
  specs?: Product['specs'];
  config: CategoryConfig;
}) {
  const rank = (s: string) => {
    const i = config.specGroups.indexOf(s);
    return i < 0 ? 99 : i;
  };
  return (
    <div>
      {specs
        .filter((s) => s.items.length)
        .slice()
        .sort((a, b) => rank(a.group) - rank(b.group))
        .map((s, i) => (
          <details key={s.group} open={i === 0} className="border-b border-slate-200 last:border-0">
            <summary className="cursor-pointer py-4 font-semibold">{s.group}</summary>
            <table className="mb-4 w-full text-left text-sm">
              <caption className="sr-only">{s.group} specifications</caption>
              <tbody>
                {s.items.map((r, n) => (
                  <tr
                    key={`${r.label}-${n}`}
                    data-spec-key={`${s.group}:${r.label}`}
                    className="odd:bg-slate-50"
                  >
                    <th scope="row" className="w-2/5 p-3 font-normal text-slate-500">
                      {r.label}
                    </th>
                    <td className="p-3">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
    </div>
  );
}
