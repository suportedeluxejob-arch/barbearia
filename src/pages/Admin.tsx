import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, query, getDoc } from 'firebase/firestore';
import { LogOut, Trash2, ShieldCheck, Users, Scissors, CalendarCheck } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { formatSmartDate } from '../lib/dateFormatter';
import { sendPushToUser } from '../lib/onesignal';

function AdminAppointments() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchAppointments = async () => {
    setLoading(true);
    const q = query(collection(db, 'appointments'));
    const snapshot = await getDocs(q);
    
    const dataPromises = snapshot.docs.map(async (docSnap) => {
      const app = { id: docSnap.id, ...docSnap.data() } as any;
      try {
          if (app.barberId) {
            const bSnap = await getDoc(doc(db, 'barbers', app.barberId));
            if (bSnap.exists()) app.barberName = bSnap.data().name;
          }
          if (app.userId) {
            const uSnap = await getDoc(doc(db, 'users', app.userId));
            if (uSnap.exists()) app.userName = uSnap.data().name;
          }
      } catch(e) {}
      return app;
    });

    const data = await Promise.all(dataPromises);

    // Sort: by appointment date/time first, then by createdAt (queue order) within same slot
    data.sort((a: any, b: any) => {
      // Primary: appointment date ascending
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      // Secondary: time ascending
      const timeA = a.time || '';
      const timeB = b.time || '';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      // Tertiary: createdAt ascending (queue order — first booked = first served)
      const createdA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const createdB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return createdA - createdB;
    });

    // Calculate and attach real queue position per slot
    const slotQueues: Record<string, number> = {};
    for (const appt of data) {
      if (appt.status === 'cancelled') continue;
      const slotKey = `${appt.date}_${appt.time}`;
      slotQueues[slotKey] = (slotQueues[slotKey] || 0) + 1;
      appt.queuePosition = slotQueues[slotKey];
    }

    setAppointments(data);
    setLoading(false);
  };

  useEffect(() => { fetchAppointments(); }, []);

  const isPastAppt = (dateStr: string) => {
    try { return new Date(dateStr) < new Date(new Date().setHours(0,0,0,0)); }
    catch { return false; }
  };

  const deleteAppointment = async (id: string) => {
    await deleteDoc(doc(db, 'appointments', id));
    setAppointments(prev => prev.filter((a: any) => a.id !== id));
  };

  const clearOldAppointments = async () => {
    const toDelete = appointments.filter((a: any) =>
      a.status === 'cancelled' || isPastAppt(a.date)
    );
    await Promise.all(toDelete.map((a: any) => deleteDoc(doc(db, 'appointments', a.id))));
    setAppointments(prev => prev.filter((a: any) =>
      a.status !== 'cancelled' && !isPastAppt(a.date)
    ));
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await updateDoc(doc(db, 'appointments', id), { status: newStatus });

    // Find the appointment to get userId, barber name and date for the push
    const appt = appointments.find((a: any) => a.id === id);
    if (appt?.userId) {
      const { label } = formatSmartDate(appt.date, appt.time);
      const barberName = appt.barberName || 'Seu barbeiro';
      if (newStatus === 'confirmed') {
        sendPushToUser(
          appt.userId,
          '✅ Horário Confirmado!',
          `${barberName} confirmou seu horário: ${label}. Até lá!`
        );
      } else if (newStatus === 'cancelled') {
        sendPushToUser(
          appt.userId,
          '❌ Agendamento Cancelado',
          `Seu horário ${label} foi cancelado. Abra o app para remarcar.`
        );
      }
    }

    fetchAppointments();
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarCheck className="text-red" size={20} />
          <h2 className="text-h3">Gestão de Horários</h2>
        </div>
        {/* Bulk clear button */}
        {appointments.some((a: any) => a.status === 'cancelled' || isPastAppt(a.date)) && (
          <button
            onClick={clearOldAppointments}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '12px',
              background: 'rgba(229,57,53,0.08)',
              border: '1px solid rgba(229,57,53,0.2)',
              color: 'var(--accent-red)', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} />
            Limpar encerrados
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
             Array.from({length: 2}).map((_, i) => (
                <div key={i} className="card" style={{ height: '140px', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
             ))
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <p className="text-muted">Nenhum agendamento encontrado.</p>
          </div>
        ) : appointments.map(app => {
          
          const { label: dateTimeStr, sublabel: fullDate } = formatSmartDate(app.date, app.time);

          const isConfirm = app.status === 'confirmed';
          const isCancel = app.status === 'cancelled';

          return (
          <div key={app.id} className="card" style={{ padding: '20px', opacity: isCancel || isPastAppt(app.date) ? 0.8 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <p className="text-white font-semibold" style={{ fontSize: '17px', marginBottom: '2px' }}>{dateTimeStr}</p>
                <p className="text-sm" style={{ fontSize: '12px' }}>{fullDate}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    backgroundColor: isConfirm ? 'rgba(16,185,129,0.1)' : isCancel ? 'rgba(229,57,53,0.1)' : 'rgba(255,165,0,0.1)',
                    color: isConfirm ? 'var(--success-green)' : isCancel ? 'var(--accent-red)' : '#FFA500',
                    border: `1px solid ${isConfirm ? 'rgba(16,185,129,0.2)' : isCancel ? 'rgba(229,57,53,0.2)' : 'rgba(255,165,0,0.2)'}`,
                    flexShrink: 0,
                  }}>
                  {isConfirm ? 'Confirmado' : isCancel ? 'Cancelado' : 'Pendente'}
                </span>
                {/* Delete button for cancelled or past appointments */}
                {(isCancel || isPastAppt(app.date)) && (
                  <button
                    onClick={() => deleteAppointment(app.id)}
                    title="Excluir agendamento"
                    style={{
                      width: '30px', height: '30px', borderRadius: '10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(229,57,53,0.08)',
                      border: '1px solid rgba(229,57,53,0.2)',
                      color: 'var(--accent-red)', cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p className="text-sm">Cliente: <span className="text-white">{app.userName || app.userId?.slice(0,8) || 'Desconhecido'}</span>{app.queuePosition && !isCancel ? <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--accent-red)', fontWeight: 600 }}>#{app.queuePosition} na fila</span> : null}</p>
              <p className="text-sm">Barbeiro: <span className="text-white">{app.barberName || 'Desconhecido'}</span></p>
            </div>
            
            {!isCancel && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => updateStatus(app.id, 'confirmed')}
                  style={{ 
                    flex: 1,
                    padding: '12px',
                    borderRadius: '14px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: isConfirm ? 'rgba(16,185,129,0.1)' : 'var(--accent-red)',
                    color: isConfirm ? 'var(--success-green)' : 'white',
                    border: isConfirm ? '1px solid rgba(16,185,129,0.3)' : 'none',
                    boxShadow: isConfirm ? 'none' : '0 4px 12px rgba(229,57,53,0.4)',
                    transition: 'all 0.2s'
                  }}
                >
                  {isConfirm ? '✓ Confirmado' : 'Aprovar'}
                </button>
                <button 
                  onClick={() => updateStatus(app.id, 'cancelled')}
                  style={{ 
                    flex: 1,
                    padding: '12px',
                    borderRadius: '14px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    color: 'var(--accent-red)',
                    border: '1px solid rgba(229,57,53,0.4)',
                    transition: 'all 0.2s'
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )})}
      </div>
    </div>
  )
}

function AdminBarbers() {
  const [barbers, setBarbers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  
  const fetchBarbers = async () => {
    const snapshot = await getDocs(collection(db, 'barbers'));
    setBarbers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => { fetchBarbers(); }, []);

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if(!name || !role) return;
    await addDoc(collection(db, 'barbers'), { name, role, isAvailable: true });
    setName(''); setRole('');
    fetchBarbers();
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    await updateDoc(doc(db, 'barbers', id), { isAvailable: !current });
    fetchBarbers();
  };

  const removeBarber = async (id: string) => {
    if(confirm('Tem certeza que deseja remover este profissional? Todos os horários associados ficarão sem barbeiro.')) {
      await deleteDoc(doc(db, 'barbers', id));
      fetchBarbers();
    }
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Users className="text-red" size={20} />
        <h2 className="text-h3">Equipe</h2>
      </div>

      <form onSubmit={handleAdd} className="card" style={{ padding: '24px', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 className="text-sm">ADICIONAR PROFISSIONAL</h3>
        <input className="input-field" placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} required />
        <input className="input-field" placeholder="Cargo (ex: Barbeiro Sênior)" value={role} onChange={e => setRole(e.target.value)} required />
        <button className="btn-primary" type="submit" style={{ marginTop: '8px' }}>Adicionar à Equipe</button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {barbers.map(b => (
          <div key={b.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
            <div>
              <p className="text-white font-semibold" style={{ fontSize: '16px' }}>{b.name}</p>
              <p className="text-sm">{b.role}</p>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <button 
                onClick={() => toggleAvailability(b.id, b.isAvailable)} 
                style={{ 
                  fontSize: '11px', 
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  padding: '6px 12px', 
                  borderRadius: '20px', 
                  backgroundColor: b.isAvailable ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                  color: b.isAvailable ? 'var(--success-green)' : 'var(--text-muted)',
                  border: b.isAvailable ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border-subtle)',
                  transition: 'all 0.2s'
                }}>
                {b.isAvailable ? 'Disp. Ativo' : 'Pausado'}
              </button>
              <button onClick={() => removeBarber(b.id)} style={{ color: 'var(--accent-red)', opacity: 0.8, transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.opacity='1'} onMouseOut={e => e.currentTarget.style.opacity='0.8'}>
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminServices() {
  const [services, setServices] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');

  const fetchServices = async () => {
    const snapshot = await getDocs(collection(db, 'services'));
    setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => { fetchServices(); }, []);

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if(!name || !price || !duration) return;
    await addDoc(collection(db, 'services'), { 
      name, 
      price: Number(price), 
      duration: Number(duration) 
    });
    setName(''); setPrice(''); setDuration('');
    fetchServices();
  };

  const removeService = async (id: string) => {
    if(confirm('Tem certeza que deseja remover este serviço?')) {
      await deleteDoc(doc(db, 'services', id));
      fetchServices();
    }
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Scissors className="text-red" size={20} />
        <h2 className="text-h3">Catálogo</h2>
      </div>

      <form onSubmit={handleAdd} className="card" style={{ padding: '24px', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 className="text-sm">ADICIONAR SERVIÇO</h3>
        <input className="input-field" placeholder="Nome do Serviço" value={name} onChange={e => setName(e.target.value)} required />
        <div style={{ display: 'flex', gap: '12px' }}>
          <input className="input-field" type="number" placeholder="Preço (R$)" value={price} onChange={e => setPrice(e.target.value)} required style={{ flex: 1 }} />
          <input className="input-field" type="number" placeholder="Duração (min)" value={duration} onChange={e => setDuration(e.target.value)} required style={{ flex: 1 }}/>
        </div>
        <button className="btn-primary" type="submit" style={{ marginTop: '8px' }}>Adicionar Serviço</button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {services.map(s => (
          <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
            <div>
              <p className="text-white font-semibold" style={{ fontSize: '16px' }}>{s.name}</p>
              <p className="text-sm">R$ {s.price.toFixed(2)} • {s.duration} min</p>
            </div>
            <button onClick={() => removeService(s.id)} style={{ color: 'var(--accent-red)', opacity: 0.8, transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.opacity='1'} onMouseOut={e => e.currentTarget.style.opacity='0.8'}>
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Admin() {
  const [tab, setTab] = useState<'appointments'|'barbers'|'services'>('appointments');
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="page-enter">
      
      {/* Admin Header Premium */}
      <div style={{ 
        padding: '32px 24px 24px 24px', 
        background: 'rgba(229, 57, 53, 0.05)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h1 className="text-h1 text-white" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldCheck className="text-red" size={32} />
            Painel Admin
          </h1>
          <button onClick={handleLogout} className="text-muted" style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
            <LogOut size={20} />
          </button>
        </div>
        <p className="text-sm">Controle sua barbearia de qualquer lugar.</p>
      </div>

      <div className="scroll-content" style={{ padding: '24px' }}>
        
        {/* Tabs - iOS Style segmented control */}
        <div style={{ 
          display: 'flex', 
          marginBottom: '32px', 
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: '6px',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)'
        }}>
          {[
             {id: 'appointments', label: 'Horários'},
             {id: 'barbers', label: 'Equipe'},
             {id: 'services', label: 'Catálogo'}
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              style={{
                flex: 1, padding: '10px', borderRadius: '12px', fontSize: '14px', fontWeight: tab === t.id ? 600 : 500,
                backgroundColor: tab === t.id ? 'var(--card-grey-light)' : 'transparent',
                color: tab === t.id ? 'white' : 'var(--text-muted)',
                boxShadow: tab === t.id ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'appointments' && <AdminAppointments />}
        {tab === 'barbers' && <AdminBarbers />}
        {tab === 'services' && <AdminServices />}

      </div>
    </div>
  );
}
