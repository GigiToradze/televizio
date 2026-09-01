import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useChannels, useSaveSliderOrder } from '../lib/queries';

type Row = { id: string; name_en: string; in_slider: boolean };

/** The strip is a curated subset in its own order — Imedi leads it while
 *  First Channel leads the catalogue — so it gets a screen of its own
 *  rather than a column in the channels table. */
export default function Slider() {
  const { admin } = useAuth();
  const editable = canWrite(admin?.role, 'content');
  const channels = useChannels();
  const save = useSaveSliderOrder();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

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
    setDirty(false);
  }, [channels.data]);

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setRows(next);
    setDirty(true);
  }

  async function commit() {
    // Position counts only the channels actually in the strip, from one, so
    // the numbers read the way the marquee does.
    let position = 0;
    await save.mutateAsync(rows.map((r) => ({
      id: r.id,
      in_slider: r.in_slider,
      slider_order: r.in_slider ? ++position : 0,
    })));
    setDirty(false);
  }

  if (channels.isLoading) return <p className="eyebrow">Loading</p>;

  const inStrip = rows.filter((r) => r.in_slider).length;

  return (
    <section style={{ maxWidth: 620 }}>
      <div className="head">
        <h1 className="head__title">Slider</h1>
        <span className="head__count">{inStrip} in the strip</span>
        {editable && (
          <div className="head__right">
            <button
              className={`btn btn--sm${dirty ? ' btn--signal' : ''}`}
              onClick={commit} disabled={save.isPending || !dirty}
            >
              {save.isPending ? 'Saving' : dirty ? 'Save order' : 'Saved'}
            </button>
          </div>
        )}
      </div>

      <p className="lede">
        The logos that scroll across the top of the site, in the order they
        appear. Unticked channels stay in the catalogue but leave the strip.
      </p>

      <ol className="panel strip">
        {rows.map((r, i) => (
          <li key={r.id} className={`strip__row${r.in_slider ? '' : ' is-out'}`}>
            <span className="pos">
              {r.in_slider
                ? String(rows.slice(0, i + 1).filter((x) => x.in_slider).length)
                    .padStart(2, '0')
                : '—'}
            </span>
            <label className="toggle">
              <input
                type="checkbox" checked={r.in_slider} disabled={!editable}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...r, in_slider: e.target.checked };
                  setRows(next);
                  setDirty(true);
                }}
              />
              <span>{r.name_en}</span>
            </label>
            {editable && (
              <span className="strip__moves">
                <button className="btn btn--quiet btn--sm" onClick={() => move(i, i - 1)}
                        aria-label={`Move ${r.name_en} up`}>↑</button>
                <button className="btn btn--quiet btn--sm" onClick={() => move(i, i + 1)}
                        aria-label={`Move ${r.name_en} down`}>↓</button>
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
