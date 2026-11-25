import type { Product } from '../types';
import type { CategoryConfig } from '../categoryConfig';
export function CategoryWidgets({ product, config }: { product: Product; config: CategoryConfig }) {
  return (
    <div className="space-y-4">
      {config.widgets.map((w) => {
        const data = product.widgets?.[w.key];
        return data && (data.text || data.rows?.length || data.table?.length || data.url) ? (
          <details
            key={w.key}
            className="rounded-xl border border-slate-200 p-4"
            open={w.key !== 'sizeChart'}
          >
            <summary className="cursor-pointer font-semibold">{w.label}</summary>
            {data.text && (
              <p className="mt-3 whitespace-pre-line leading-7 text-slate-600">{data.text}</p>
            )}
            {data.rows?.map((r) => (
              <p key={r.label} className="mt-2 text-sm">
                <span className="text-slate-500">{r.label}: </span>
                {r.value}
              </p>
            ))}
            {!!data.table?.length && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">{w.label}</caption>
                  {data.columns && (
                    <thead>
                      <tr>
                        {data.columns.map((v) => (
                          <th scope="col" key={v} className="p-3">
                            {v}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {data.table.map((row, i) => (
                      <tr key={i} className="odd:bg-slate-50">
                        {row.map((v, j) => (
                          <td key={j} className="p-3">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.url && (
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center text-teal-700 underline"
              >
                Open {w.label} ↗
              </a>
            )}
          </details>
        ) : null;
      })}
    </div>
  );
}
