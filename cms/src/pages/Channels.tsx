import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useCategories, useChannels, type ChannelRecord } from '../lib/queries';
import ChannelDrawer from './ChannelDrawer';

export default function Channels() {
  const { admin } = useAuth();
  const editable = canWrite(admin?.role, 'content');
  const channels = useChannels();
  const categories = useCategories();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ChannelRecord | 'new' | null>(null);

  if (channels.isLoading || categories.isLoading) {
    return <p className="text-neutral-500">Loading…</p>;
  }
  if (channels.error) {
    return <p className="text-red-500">{String(channels.error)}</p>;
  }

  const term = query.trim().toLowerCase();
  const rows = (channels.data ?? []).filter((c) =>
    !term ||
    c.slug.includes(term) ||
    c.name_en.toLowerCase().includes(term) ||
    c.name_ka.includes(query.trim()));

  return (
    <section className="space-y-4">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Channels</h1>
        <span className="text-sm text-neutral-500">{rows.length}</span>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="ml-auto rounded bg-neutral-900 px-3 py-1.5 text-sm
                     ring-1 ring-neutral-800 focus:outline-none focus:ring-red-600"
        />
        {editable && (
          <button
            onClick={() => setEditing('new')}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium"
          >
            Add channel
          </button>
        )}
      </header>

      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500">
          <tr className="border-b border-neutral-800">
            <th className="py-2 font-medium">Logo</th>
            <th className="font-medium">Name</th>
            <th className="font-medium">Slug</th>
            <th className="font-medium">Categories</th>
            <th className="font-medium">Order</th>
            <th className="font-medium">Slider</th>
            <th className="font-medium">Active</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr
              key={c.id}
              onClick={() => editable && setEditing(c)}
              className="border-b border-neutral-900 hover:bg-neutral-900/60
                         cursor-pointer"
            >
              <td className="py-2">
                {c.logo_path
                  ? <span className="text-neutral-400">{c.logo_w}×{c.logo_h}</span>
                  : <span className="text-red-500">missing</span>}
              </td>
              <td>{c.name_en}<span className="text-neutral-600"> · {c.name_ka}</span></td>
              <td className="text-neutral-500">{c.slug}</td>
              <td className="text-neutral-500">{c.channel_categories.length}</td>
              <td className="text-neutral-500">{c.sort_order}</td>
              <td className="text-neutral-500">{c.in_slider ? c.slider_order : '—'}</td>
              <td>{c.is_active ? '' : <span className="text-neutral-600">off</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <ChannelDrawer
          channel={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
