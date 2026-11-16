import Card from "./Card.jsx";

export default function DataTable({
  columns,
  rows,
  getRowKey,
  emptyTitle = "Nothing to show yet",
  emptyDescription = "When data is available, it will appear here.",
}) {
  return (
    <Card className="overflow-hidden p-0">
      {rows.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="font-semibold text-slate-800">{emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th className="px-5 py-3.5 font-semibold" key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr className="hover:bg-slate-50/70" key={getRowKey?.(row) ?? index}>
                  {columns.map((column) => (
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700" key={column.key}>
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
