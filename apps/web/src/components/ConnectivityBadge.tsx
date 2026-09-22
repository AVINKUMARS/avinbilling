import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { apiBaseUrl } from "../lib/api";
import {
  discardMutation,
  offlineDb,
  retryMutation,
  syncPendingMutations,
  type PendingMutation,
} from "../offline/database";
import { ConfirmModal } from "./ConfirmModal";

function actionLabel(path: string) {
  const section = path.split("/").filter(Boolean)[0] ?? "record";
  const labels: Record<string, string> = {
    clients: "Customer",
    brands: "Brand",
    projects: "Project",
    catalog: "Product or rate",
    measurements: "Measurement",
    quotes: "Quotation",
    operations: "Operation",
    organization: "Settings",
  };
  return labels[section] ?? "Workspace action";
}

export function ConnectivityBadge() {
  const [online, setOnline] = useState(navigator.onLine);
  const [mutations, setMutations] = useState<PendingMutation[]>([]);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<number>();
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const refresh = useCallback(async () => {
    setOnline(navigator.onLine);
    setMutations(
      await offlineDb.pendingMutations.orderBy("createdAt").toArray(),
    );
  }, []);

  const syncNow = useCallback(async () => {
    const token = localStorage.getItem("avin_token");
    if (!navigator.onLine || !token) {
      await refresh();
      return;
    }
    setSyncing(true);
    const result = await syncPendingMutations(apiBaseUrl, token);
    if (result.synced) {
      setLastSynced(Date.now());
      window.dispatchEvent(new CustomEvent("avin:data-synced"));
    }
    setSyncing(false);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    const handleOnline = () => void syncNow();
    const handleOffline = () => void refresh();
    const handleChange = () => void refresh();
    void syncNow();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("avin:sync-change", handleChange);
    const timer = window.setInterval(() => void syncNow(), 30_000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("avin:sync-change", handleChange);
      window.clearInterval(timer);
    };
  }, [refresh, syncNow]);

  const conflicts = mutations.filter(
    (mutation) => mutation.state === "conflict",
  ).length;
  const failures = mutations.filter(
    (mutation) => mutation.state === "failed",
  ).length;
  const badgeStyle = !online
    ? "bg-amber-50 text-amber-700"
    : conflicts || failures
      ? "bg-red-50 text-red-700"
      : "bg-emerald-50 text-emerald-700";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${badgeStyle}`}
        aria-expanded={open}
        aria-label="Open offline synchronization status"
      >
        {online ? <Cloud size={14} /> : <CloudOff size={14} />}
        {syncing
          ? "Syncing…"
          : online
            ? mutations.length
              ? `${mutations.length} pending`
              : "Online"
            : `${mutations.length} waiting`}
      </button>

      {open && (
        <section className="fixed inset-x-3 top-20 z-50 max-h-[75vh] overflow-hidden rounded-2xl border border-white/40 bg-white/60 text-left shadow-2xl backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[420px]">
          <div className="flex items-start justify-between border-b border-slate-100/50 p-4">
            <div>
              <h2 className="font-black text-ink">Offline synchronization</h2>
              <p className="mt-1 text-xs text-slate-500">
                {online
                  ? "Connected. Waiting actions sync automatically."
                  : "Offline. Your changes remain safely on this device."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              aria-label="Close synchronization panel"
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex items-center justify-between bg-white/40 px-4 py-3 text-xs">
            <span className="font-semibold text-slate-600">
              {lastSynced
                ? `Last synced ${new Date(lastSynced).toLocaleTimeString()}`
                : "Automatic sync is active"}
            </span>
            <button
              type="button"
              disabled={!online || syncing}
              onClick={() => void syncNow()}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 font-bold text-white disabled:opacity-40"
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              Sync now
            </button>
          </div>

          <div className="max-h-[52vh] overflow-y-auto p-3">
            {!mutations.length ? (
              <div className="grid place-items-center px-4 py-9 text-center">
                <CheckCircle2 size={30} className="text-emerald-500" />
                <p className="mt-3 font-bold text-ink">Everything is synced</p>
                <p className="mt-1 text-xs text-slate-500">
                  Cached workspace information remains available offline.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {mutations.map((mutation) => (
                  <article
                    key={mutation.id}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {(mutation.state === "conflict" ||
                            mutation.state === "failed") && (
                            <AlertTriangle size={14} className="text-red-500" />
                          )}
                          <b className="text-sm text-ink">
                            {mutation.method} {actionLabel(mutation.path)}
                          </b>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {mutation.path}
                        </p>
                        <p className="mt-1 text-xs font-semibold capitalize text-slate-600">
                          {mutation.state}
                          {mutation.attempts
                            ? ` · ${mutation.attempts} attempt${mutation.attempts === 1 ? "" : "s"}`
                            : ""}
                        </p>
                        {mutation.lastError && (
                          <p className="mt-1 text-xs text-red-600">
                            {mutation.lastError}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {(mutation.state === "failed" ||
                          mutation.state === "conflict") && (
                          <button
                            type="button"
                            onClick={async () => {
                              await retryMutation(mutation.id);
                              await syncNow();
                            }}
                            className="rounded-lg p-2 text-brand-700 hover:bg-brand-50"
                            aria-label="Retry offline action"
                          >
                            <RefreshCw size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmAction({
                              message: "Discard this unsynchronized action? This cannot be undone.",
                              onConfirm: async () => {
                                await discardMutation(mutation.id);
                              }
                            });
                          }}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                          aria-label="Discard offline action"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
    </div>
  );
}
