import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import BottomNav from '../components/BottomNav';
import { Clock, Calendar, Trash2 } from 'lucide-react';
import { formatSmartDate } from '../lib/dateFormatter';

interface FullAppointment {
  id: string;
  date: string;
  time: string;
  status: string;
  createdAt: any;
  barberId?: string;
  serviceIds?: string[];
  serviceId?: string;
  barberName?: string;
  serviceNames?: string[];
  totalPrice?: number;
  queuePosition?: number;
  estimatedArrival?: string;
}

export default function History() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<FullAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'appointments'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);

      const dataPromises = snapshot.docs.map(async (docSnap) => {
        const app = { id: docSnap.id, ...docSnap.data() } as FullAppointment;
        try {
          if (app.barberId) {
            const bSnap = await getDoc(doc(db, 'barbers', app.barberId));
            if (bSnap.exists()) app.barberName = bSnap.data().name;
          }
          const ids: string[] = app.serviceIds?.length
            ? app.serviceIds
            : app.serviceId ? [app.serviceId] : [];
          if (ids.length) {
            const names: string[] = [];
            for (const sid of ids) {
              const sSnap = await getDoc(doc(db, 'services', sid));
              if (sSnap.exists()) names.push(sSnap.data().name);
            }
            app.serviceNames = names;
          }
        } catch(e) {}
        return app;
      });

      const data = await Promise.all(dataPromises);
      data.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      });
      setAppointments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, [user]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'appointments', id));
      setAppointments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  // Past appointment = date is before today
  const isPast = (dateStr: string) => {
    try { return new Date(dateStr) < new Date(new Date().setHours(0,0,0,0)); }
    catch { return false; }
  };

  return (
    <div className="page-enter">
      <div className="scroll-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <h1 className="text-h1 mb-8" style={{ marginBottom: '32px' }}>Histórico</h1>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Array.from({length: 3}).map((_, i) => (
              <div key={i} className="card" style={{ height: '140px', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Calendar size={48} className="text-muted" style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p className="text-h3 mb-8">Nenhum agendamento</p>
            <p className="text-muted">Você ainda não marcou nenhum horário.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {appointments.map(app => {
              const { label: smartDate } = formatSmartDate(app.date);
              const isCancelled = app.status === 'cancelled';
              const isPending = app.status === 'pending';
              const canDelete = isCancelled || isPast(app.date);

              return (
                <div key={app.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', opacity: canDelete ? 0.85 : 1 }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p className="text-xs text-muted" style={{ marginBottom: '4px' }}>{smartDate}</p>
                      <p className="text-h3 text-white" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={18} className="text-red" />
                        {app.time}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        padding: '6px 10px',
                        borderRadius: '20px',
                        backgroundColor: isCancelled ? 'rgba(229,57,53,0.1)' : isPending ? 'rgba(255,165,0,0.1)' : 'rgba(16,185,129,0.1)',
                        color: isCancelled ? 'var(--accent-red)' : isPending ? '#FFA500' : 'var(--success-green)',
                        border: `1px solid ${isCancelled ? 'rgba(229,57,53,0.2)' : isPending ? 'rgba(255,165,0,0.2)' : 'rgba(16,185,129,0.2)'}`
                      }}>
                        {isCancelled ? 'Cancelado' : isPending ? 'Aguardando' : 'Confirmado'}
                      </span>
                      {/* Delete button — only for cancelled or past appointments */}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(app.id)}
                          disabled={deleting === app.id}
                          title="Descartar agendamento"
                          style={{
                            width: '32px', height: '32px', borderRadius: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(229,57,53,0.08)',
                            border: '1px solid rgba(229,57,53,0.2)',
                            color: 'var(--accent-red)',
                            cursor: 'pointer',
                            flexShrink: 0,
                            opacity: deleting === app.id ? 0.5 : 1,
                            transition: 'all 0.2s',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, marginRight: '12px' }}>
                      <p className="text-white font-semibold" style={{ fontSize: '15px', marginBottom: '4px' }}>
                        {app.serviceNames?.join(' + ') || 'Serviço'}
                      </p>
                      <p className="text-sm">com {app.barberName || 'Barbeiro'}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {app.totalPrice ? <p className="text-white font-semibold">R$ {app.totalPrice.toFixed(2)}</p> : null}
                      {app.queuePosition && !isCancelled && !isPast(app.date) ? (
                        <p style={{ fontSize: '11px', color: 'var(--accent-red)', marginTop: '4px', fontWeight: 600 }}>Fila #{app.queuePosition}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
