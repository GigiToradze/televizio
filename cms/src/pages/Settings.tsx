import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  useAdmins, useCreateAdmin, usePublications, useSaveSetting, useSiteSettings,
} from '../lib/queries';

const field = 'rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ' +
              'ring-neutral-800 focus:outline-none focus:ring-red-600';

function Admins() {
  const { admin } = useAuth();
  const admins = useAdmins();
  const create = useCreateAdmin();
  const [form, setForm] = useState({ email: '', name: '', role: 'editor' });
  const [note, setNote] = useState<string | null>(null);
  const isOwner = admin?.role === 'owner';

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Admins</h2>
      <ul className="divide-y divide-neutral-900 rounded text-sm ring-1 ring-neutral-800">
        {(admins.data ?? []).map((a) => (
          <li key={a.id} className="flex gap-3 px-3 py-2">
            <span>{a.name}</span>
            <span className="text-neutral-500">{a.email}</span>
            <span className="ml-auto text-neutral-500">{a.role}</span>
          </li>
        ))}
      </ul>

      {isOwner ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setNote(null);
            try {
              await create.mutateAsync(form);
              setNote(`Invite sent to ${form.email}.`);
              setForm({ email: '', name: '', role: 'editor' });
            } catch (err) {
              setNote(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          <input className={field} required type="email" placeholder="Email"
                 value={form.email}
                 onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={field} required placeholder="Name" value={form.name}
                 onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={field} value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="editor">editor — content</option>
            <option value="support">support — subscribers</option>
            <option value="owner">owner — everything</option>
          </select>
          <button type="submit" disabled={create.isPending}
                  className="rounded bg-red-600 px-3 py-2 text-sm font-medium
                             disabled:opacity-50">
            Invite
          </button>
          {note && <p className="w-full text-xs text-neutral-400">{note}</p>}
        </form>
      ) : (
        <p className="text-xs text-neutral-600">Only an owner can add admins.</p>
      )}
    </section>
  );
}

function Numbers() {
  const settings = useSiteSettings();
  const save = useSaveSetting();

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Numbers on the page</h2>
      <div className="space-y-2">
        {(settings.data ?? []).map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-sm">
            <span className="w-44 text-neutral-500">{s.key}</span>
            <input
              className={field} defaultValue={s.value_text ?? ''}
              onBlur={(e) => {
                // "1 024" and "1,000+" are labels; the digits inside them are
                // what the counter animates to, where there are any.
                const digits = e.target.value.replace(/[\s,+]/g, '');
                save.mutate({
                  key: s.key,
                  value_text: e.target.value,
                  value_num: digits !== '' && Number.isFinite(+digits)
                    ? +digits
                    : s.value_num,
                });
              }}
            />
            <span className="text-xs text-neutral-600">{s.description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function History() {
  const pubs = usePublications();
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Publish history</h2>
      <ul className="divide-y divide-neutral-900 rounded text-sm ring-1 ring-neutral-800">
        {(pubs.data ?? []).map((p) => (
          <li key={p.id} className="flex gap-4 px-3 py-2 text-neutral-400">
            <span>{new Date(p.published_at).toLocaleString('en-GB')}</span>
            <span>{p.channel_count} channels · {p.plan_count} plans</span>
            <span className="ml-auto font-mono text-xs text-neutral-600">
              {p.snapshot_hash.slice(0, 12)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Settings() {
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Admins />
      <Numbers />
      <History />
    </div>
  );
}
