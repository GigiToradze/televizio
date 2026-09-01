import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lang/LangProvider';

/* Charts, drawn by hand in SVG.
 *
 * No chart library: the whole vocabulary here is a line, a bar and a rule,
 * and a dependency that ships its own idea of type and colour would fight
 * the design system rather than use it.
 *
 * Every figure is one series, so none of them carries a legend — the title
 * names the series. Colour is doing no encoding work at all; it is the same
 * signal red throughout, and the categories are named in the axis. That
 * keeps the palette honest: the one place colour means something is status,
 * which is reserved and always carries a word beside it.
 */

const INK = 'var(--dim)';
const GRID = 'var(--rule-2)';
const SIGNAL = 'var(--red)';

/** Width of the container, so type stays the right size at any width
 *  instead of being scaled by a viewBox. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(680);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setW(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** A nice round ceiling, so the axis reads 0/20/40 rather than 0/17/34. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (v <= mag * step) return mag * step;
  }
  return mag * 10;
}

type FigureProps = {
  title: string;
  meta?: string;
  labels: string[];
  values: number[];
  format?: (n: number) => string;
  children: React.ReactNode;
};

/** Wraps a chart with its heading and a table of the same numbers.
 *  The table is not a fallback — it is how someone reads an exact value,
 *  and how anyone who cannot use the chart reads it at all. */
function Figure({ title, meta, labels, values, format, children }: FigureProps) {
  const { t } = useLang();
  const [table, setTable] = useState(false);
  const fmt = format ?? ((n: number) => String(n));

  return (
    <figure className="fig">
      <figcaption className="fig__head">
        <span className="fig__title">{title}</span>
        {meta && <span className="fig__meta">{meta}</span>}
        <button
          type="button"
          className="btn btn--quiet btn--sm fig__toggle"
          aria-expanded={table}
          onClick={() => setTable((v) => !v)}
        >
          {table ? t('გრაფიკი', 'Chart') : t('რიცხვები', 'Numbers')}
        </button>
      </figcaption>

      {table ? (
        <div className="panel--table">
          <table className="rows">
            <thead>
              <tr><th>{t('პერიოდი', 'Period')}</th><th>{title}</th></tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l + i}>
                  <td>{l}</td>
                  <td><span className="num">{fmt(values[i])}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : children}
    </figure>
  );
}

type SeriesProps = {
  title: string;
  meta?: string;
  labels: string[];
  values: number[];
  format?: (n: number) => string;
  height?: number;
};

/** Change over time. One line, 2px, with the crosshair and tooltip an
 *  HTML chart should always have. */
export function LineChart({
  title, meta, labels, values, format, height = 170,
}: SeriesProps) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const fmt = format ?? ((n: number) => String(n));

  const padL = 44, padR = 10, padT = 12, padB = 24;
  const innerW = Math.max(10, w - padL - padR);
  const innerH = height - padT - padB;
  const max = niceMax(Math.max(...values, 1));

  const x = (i: number) =>
    padL + (values.length < 2 ? innerW / 2 : (i / (values.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const area = `${line} L${x(values.length - 1)},${padT + innerH} L${x(0)},${padT + innerH} Z`;
  const ticks = [0, max / 2, max];

  return (
    <Figure title={title} meta={meta} labels={labels} values={values} format={fmt}>
      <div className="fig__plot" ref={ref}>
        <svg width="100%" height={height} role="img" aria-label={title}
             onMouseLeave={() => setHover(null)}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
              <text x={padL - 8} y={y(v) + 4} textAnchor="end"
                    fill={INK} fontSize={11} fontFamily="var(--f-mono)">
                {fmt(v)}
              </text>
            </g>
          ))}

          <path d={area} fill={SIGNAL} opacity={0.1} />
          <path d={line} fill="none" stroke={SIGNAL} strokeWidth={2}
                strokeLinejoin="round" strokeLinecap="round" />

          {labels.map((l, i) => (
            (i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1) && (
              <text key={l + i} x={x(i)} y={height - 6} textAnchor="middle"
                    fill={INK} fontSize={11} fontFamily="var(--f-mono)">{l}</text>
            )
          ))}

          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH}
                    stroke={SIGNAL} strokeWidth={1} opacity={0.5} />
              <circle cx={x(hover)} cy={y(values[hover])} r={5}
                      fill={SIGNAL} stroke="var(--panel)" strokeWidth={2} />
            </g>
          )}

          {/* Hit targets, wider than the marks they select. */}
          {values.map((_, i) => (
            <rect key={i} x={x(i) - innerW / (values.length * 2) - 1} y={padT}
                  width={innerW / values.length + 2} height={innerH}
                  fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>

        {hover !== null && (
          <div className="fig__tip" style={{ left: x(hover), top: y(values[hover]) }}>
            <b>{fmt(values[hover])}</b>
            <span>{labels[hover]}</span>
          </div>
        )}
      </div>
    </Figure>
  );
}

/** Magnitude over time. Bars anchored to the baseline, 4px rounded tops,
 *  a 2px gap of surface between neighbours. */
export function BarChart({
  title, meta, labels, values, format, height = 170,
}: SeriesProps) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const fmt = format ?? ((n: number) => String(n));

  const padL = 44, padR = 10, padT = 12, padB = 24;
  const innerW = Math.max(10, w - padL - padR);
  const innerH = height - padT - padB;
  const max = niceMax(Math.max(...values, 1));
  const slot = innerW / Math.max(values.length, 1);
  const bw = Math.max(3, slot - 2);          // the 2px is the surface gap
  const r = Math.min(4, bw / 2);
  const ticks = [0, max / 2, max];

  return (
    <Figure title={title} meta={meta} labels={labels} values={values} format={fmt}>
      <div className="fig__plot" ref={ref}>
        <svg width="100%" height={height} role="img" aria-label={title}
             onMouseLeave={() => setHover(null)}>
          {ticks.map((v) => {
            const yy = padT + innerH - (v / max) * innerH;
            return (
              <g key={v}>
                <line x1={padL} x2={w - padR} y1={yy} y2={yy} stroke={GRID} strokeWidth={1} />
                <text x={padL - 8} y={yy + 4} textAnchor="end"
                      fill={INK} fontSize={11} fontFamily="var(--f-mono)">{fmt(v)}</text>
              </g>
            );
          })}

          {values.map((v, i) => {
            const h = (v / max) * innerH;
            const xx = padL + i * slot + (slot - bw) / 2;
            const yy = padT + innerH - h;
            const top = Math.min(r, h);
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect x={xx} y={padT} width={bw} height={innerH} fill="transparent" />
                {h > 0 && (
                  <path
                    d={`M${xx},${padT + innerH} L${xx},${yy + top}
                        Q${xx},${yy} ${xx + top},${yy}
                        L${xx + bw - top},${yy} Q${xx + bw},${yy} ${xx + bw},${yy + top}
                        L${xx + bw},${padT + innerH} Z`}
                    fill={SIGNAL} opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                )}
              </g>
            );
          })}

          {labels.map((l, i) => (
            (i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1) && (
              <text key={l + i} x={padL + i * slot + slot / 2} y={height - 6}
                    textAnchor="middle" fill={INK} fontSize={11}
                    fontFamily="var(--f-mono)">{l}</text>
            )
          ))}
        </svg>

        {hover !== null && (
          <div
            className="fig__tip"
            style={{
              left: padL + hover * slot + slot / 2,
              top: padT + innerH - (values[hover] / max) * innerH,
            }}
          >
            <b>{fmt(values[hover])}</b>
            <span>{labels[hover]}</span>
          </div>
        )}
      </div>
    </Figure>
  );
}

/** Comparison across a handful of named things. Horizontal, because the
 *  names are words and words read across. Every bar is directly labelled,
 *  so there is nothing to look up. */
export function BarsAcross({
  title, meta, rows, format,
}: {
  title: string; meta?: string;
  rows: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const fmt = format ?? ((n: number) => String(n));
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <Figure title={title} meta={meta}
            labels={rows.map((r) => r.label)} values={rows.map((r) => r.value)}
            format={fmt}>
      <div className="across">
        {rows.map((r) => (
          <div className="across__row" key={r.label}>
            <span className="across__label">{r.label}</span>
            <span className="across__track">
              <span className="across__fill"
                    style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            </span>
            <span className="across__value num">{fmt(r.value)}</span>
          </div>
        ))}
      </div>
    </Figure>
  );
}
