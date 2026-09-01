import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useChannels, useSaveSliderOrder } from '../lib/queries';

type Row = { id: string; name_en: string; in_slider: boolean };

/** The marquee is a curated subset in its own order — imedi leads the strip
 *  while 1tv leads the catalogue — so it gets a screen rather than a column. */
export default function Slider() {
  const { admin } = useAuth();
  const editable = canWrite(admin?.role, 'content');
  const channels = useChannels();
  const save = useSaveSliderOrder();
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!channels.data) return;
    setRows(
      [...channels.data]
        .sort((a, b) => {
          if (a.in_slider !== b.in_slider) return a.in_slider ? -1 : 1;
          return a.slider_order - b.slider_order;
        })
        .map((c) => ({ id: c.id, name_en: c.name_en, in_slider: c.in_slider })),
    );
  }, [channels.data]);

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setRows(next);
    setSaved(false);
  }

  async function commit() {
    // Position is the index among the channels actually in the marquee,
    // counted from one, so the numbers read the way the strip does.
    let position = 0;
    await save.mutateAsync(rows.map((r) => ({
      id: r.id,
      in_slider: r.in_slider,
      slider_order: r.in_slider ? ++position : 0,
    })));
    setSaved(true);
  }

  if (channels.isLoading) return <p className="text-neutral-500">Loading…</p>;

  return (
    <section className="max-w-xl space-y-4">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Slider</h1>
        <span className="text-sm text-neutral-500">
          {rows.filter((r) => r.in_slider).length} in the strip
        </span>
        {editable && (
          <button onClick={commit} disabled={save.isPending}
                  className="ml-auto rounded bg-red-600 px-3 py-1.5 text-sm font-medium
                             disabled:opacity-50">
            {save.isPending ? 'Saving…' : saved ? 'Saved' : 'Save order'}
          </button>
        )}
      </header>

      <ol className="divide-y divide-neutral-900 rounded ring-1 ring-neutral-800">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="w-6 text-neutral-600">{r.in_slider ? i + 1 : '—'}</span>
            <input
              type="checkbox" checked={r.in_slider} disabled={!editable}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...r, in_slider: e.target.checked };
                setRows(next);
                setSaved(false);
              }}
            />
            <span className={r.in_slider ? '' : 'text-neutral-600'}>{r.name_en}</span>
            {editable && (
              <span className="ml-auto flex gap-1">
                <button onClick={() => move(i, i - 1)}
                        className="px-2 text-neutral-500 hover:text-neutral-100">↑</button>
                <button onClick={() => move(i, i + 1)}
                        className="px-2 text-neutral-500 hover:text-neutral-100">↓</button>
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
