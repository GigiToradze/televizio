import { useAuth } from '../auth/AuthProvider';
import { canWrite } from '../auth/guard';
import { useLastPublication, usePendingChanges, usePublish } from '../lib/queries';

/** Sits in the shell at all times: the live site changes only when this is
 *  pressed, so it needs to say how far behind the site currently is. */
export default function PublishButton() {
  const { admin } = useAuth();
  const last = useLastPublication();
  const pending = usePendingChanges(last.data?.published_at ?? null);
  const publish = usePublish();

  if (!canWrite(admin?.role, 'content')) return null;

  const count = pending.data ?? 0;
  const when = last.data
    ? new Date(last.data.published_at).toLocaleString('en-GB',
        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'never';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-500">
        {count > 0 ? `${count} unpublished` : 'up to date'} · last {when}
      </span>
      <button
        onClick={() => publish.mutate()}
        disabled={publish.isPending}
        className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
          count > 0 ? 'bg-red-600' : 'ring-1 ring-neutral-700 text-neutral-300'}`}
      >
        {publish.isPending ? 'Publishing…' : 'Publish'}
      </button>
      {publish.error && (
        <span className="max-w-sm whitespace-pre-line text-xs text-red-500">
          {publish.error.message}
        </span>
      )}
    </div>
  );
}
