import { useEffect, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { offlineDb, syncPendingMutations } from '../offline/database';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4000/api/v1';

export function ConnectivityBadge() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const update = async () => {
      const isOnline = navigator.onLine; setOnline(isOnline);
      const token = localStorage.getItem('avin_token');
      if (isOnline && token) await syncPendingMutations(apiUrl, token);
      setPending(await offlineDb.pendingMutations.count());
    };
    void update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    const timer = window.setInterval(() => void update(), 30_000);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); window.clearInterval(timer); };
  }, []);
  return <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{online ? <Cloud size={14} /> : <CloudOff size={14} />}{online ? pending ? `Syncing ${pending}` : 'Online' : `${pending} waiting`}</div>;
}
