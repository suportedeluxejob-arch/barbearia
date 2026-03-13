import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Clock, Users, CheckCircle, AlertTriangle, Calendar } from 'lucide-react';
import { useBooking } from '../contexts/BookingContext';
import { useAuth } from '../contexts/AuthContext';
import {
  collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendPushToAdmins } from '../lib/onesignal';
import {
  toDateKey, getCalendarDays, buildSlotMap, isSlotFull, isDayFull,
  TIME_SLOTS, TIME_SLOT_DURATION_MIN
} from '../lib/bookingEngine';
import type { SlotMap } from '../lib/bookingEngine';

type Step = 'blocked' | 'calendar' | 'timeslot' | 'confirm';

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAY_NAMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

interface ExistingBooking {
  id: string;
  date: string;
  time: string;
  status: string;
  barberName?: string;
  serviceName?: string;
}

export default function BookDateTime() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { booking, clearBooking } = useBooking();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [step, setStep] = useState<Step>('calendar');
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [period, setPeriod] = useState<'Manhã' | 'Tarde' | 'Noite'>('Manhã');

  const [monthSlotMaps, setMonthSlotMaps] = useState<Record<string, SlotMap>>({});
  const [daySlotMap, setDaySlotMap] = useState<SlotMap>({});
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [existingBooking, setExistingBooking] = useState<ExistingBooking | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // Duration sum across selected services
  const [totalDuration, setTotalDuration] = useState(TIME_SLOT_DURATION_MIN);
  const [serviceNames, setServiceNames] = useState<string[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [barberName, setBarberName] = useState('');

  // Confirm state
  const [saving, setSaving] = useState(false);
  const [queuePosition, setQueuePosition] = useState(1);
  const [estimatedArrival, setEstimatedArrival] = useState('');

  // ─── Check for active booking ────────────────────────────────────────────
  useEffect(() => {
    const checkExisting = async () => {
      if (!user) { setCheckingExisting(false); return; }
      try {
        const q = query(
          collection(db, 'appointments'),
          where('userId', '==', user.uid),
          where('status', 'in', ['pending', 'confirmed'])
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const appt = { id: snap.docs[0].id, ...snap.docs[0].data() } as ExistingBooking;
          // Enrich
          try {
            const aData = snap.docs[0].data();
            if (aData.barberId) {
              const b = await getDoc(doc(db, 'barbers', aData.barberId));
              if (b.exists()) appt.barberName = b.data().name;
            }
            if (aData.serviceIds?.length) {
              const sSnap = await getDoc(doc(db, 'services', aData.serviceIds[0]));
              if (sSnap.exists()) appt.serviceName = sSnap.data().name;
            }
          } catch (_) {}
          setExistingBooking(appt);
          setStep('blocked');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingExisting(false);
      }
    };
    checkExisting();
  }, [user]);

  // Fetch service data for confirm + barber name
  useEffect(() => {
    const fetchEnrichment = async () => {
      if (!booking.serviceIds.length) return;

      let dur = 0;
      let price = 0;
      const names: string[] = [];
      for (const sid of booking.serviceIds) {
        const snap = await getDoc(doc(db, 'services', sid));
        if (snap.exists()) {
          dur += snap.data().duration || TIME_SLOT_DURATION_MIN;
          price += snap.data().price || 0;
          names.push(snap.data().name);
        }
      }
      setTotalDuration(dur);
      setTotalPrice(price);
      setServiceNames(names);

      if (booking.barberId) {
        const bSnap = await getDoc(doc(db, 'barbers', booking.barberId));
        if (bSnap.exists()) setBarberName(bSnap.data().name);
      }
    };
    fetchEnrichment();
  }, [booking.serviceIds, booking.barberId]);

  // ─── Month availability ───────────────────────────────────────────────────
  const fetchMonthAvailability = useCallback(async () => {
    setLoadingMonth(true);
    try {
      const startOfMonth = new Date(viewYear, viewMonth, 1);
      const startISO = startOfMonth.toISOString();
      const endISO = new Date(viewYear, viewMonth + 1, 1).toISOString();

      const q = query(
        collection(db, 'appointments'),
        where('status', '!=', 'cancelled'),
        where('date', '>=', startISO),
        where('date', '<', endISO)
      );
      const snap = await getDocs(q);
      const appts = snap.docs.map(d => d.data() as { date: string; time: string });

      const grouped: Record<string, { time: string }[]> = {};
      for (const appt of appts) {
        const key = toDateKey(new Date(appt.date));
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ time: appt.time });
      }

      const maps: Record<string, SlotMap> = {};
      for (const [key, list] of Object.entries(grouped)) {
        maps[key] = buildSlotMap(list);
      }
      setMonthSlotMaps(maps);
    } catch (err) {
      console.error('Failed to load month availability', err);
    } finally {
      setLoadingMonth(false);
    }
  }, [viewYear, viewMonth]);

  useEffect(() => { fetchMonthAvailability(); }, [fetchMonthAvailability]);

  // ─── Day slot availability ────────────────────────────────────────────────
  const fetchDaySlots = async (date: Date) => {
    setLoadingDay(true);
    try {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const q = query(
        collection(db, 'appointments'),
        where('status', '!=', 'cancelled'),
        where('date', '>=', date.toISOString()),
        where('date', '<', nextDay.toISOString())
      );
      const snap = await getDocs(q);
      setDaySlotMap(buildSlotMap(snap.docs.map(d => ({ time: d.data().time as string }))));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDay(false);
    }
  };

  const handleDaySelect = (date: Date) => {
    if (date < today) return;
    setSelectedDate(date);
    setSelectedTime(null);
    fetchDaySlots(date);
    setStep('timeslot');
  };

  const handleTimeSelect = (time: string) => {
    if (!selectedDate) return;
    if (isSlotFull(daySlotMap, time)) return;
    setSelectedTime(time);
  };

  const handleToConfirm = async () => {
    if (!selectedDate || !selectedTime) return;
    
    try {
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // IMPORTANT: Only use single-field range queries to avoid composite index requirement.
      // Firestore requires a composite index for (date range + time equality) which doesn't
      // exist yet. Solution: query all appointments for the day, filter time/status in JS.
      const q = query(
        collection(db, 'appointments'),
        where('date', '>=', selectedDate.toISOString()),
        where('date', '<', nextDay.toISOString())
      );
      const snap = await getDocs(q);

      // Filter by time and status in JavaScript, then sort by createdAt (first-come, first-served)
      const active = snap.docs
        .filter(d => {
          const data = d.data();
          return data.time === selectedTime && data.status !== 'cancelled';
        })
        .sort((a, b) => {
          const aT = a.data().createdAt?.seconds ?? 0;
          const bT = b.data().createdAt?.seconds ?? 0;
          return aT - bT;
        });

      const positionInSlot = active.length + 1; // My position = existing active + 1

      // Calculate estimated arrival time
      const [h, m] = selectedTime.split(':').map(Number);
      const slotMinutes = h * 60 + m;
      const waitMinutes = (positionInSlot - 1) * totalDuration;
      const arrivalMinutes = slotMinutes + waitMinutes;
      const arrivalH = Math.floor(arrivalMinutes / 60);
      const arrivalM = arrivalMinutes % 60;
      const arrival = `${String(arrivalH).padStart(2,'0')}:${String(arrivalM).padStart(2,'0')}`;

      setQueuePosition(positionInSlot);
      setEstimatedArrival(arrival);
      setStep('confirm');
    } catch (err) {
      console.error('Queue calculation error:', err);
      setQueuePosition(1);
      setEstimatedArrival(selectedTime);
      setStep('confirm');
    }
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !user) return;
    setSaving(true);
    try {
      // Use Firebase Auth data directly — no extra Firestore read needed
      const userName = user.displayName || user.email || 'Cliente';

      await addDoc(collection(db, 'appointments'), {
        userId: user.uid,
        userName,
        barberId: booking.barberId || null,
        serviceIds: booking.serviceIds || [],
        date: selectedDate.toISOString(),
        time: selectedTime,
        status: 'pending',
        queuePosition,
        estimatedArrival,
        totalPrice,
        totalDuration,
        createdAt: serverTimestamp()
      });

      // Fire-and-forget admin notification (never blocks the booking)
      const dateStr = selectedDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
      getDocs(query(collection(db, 'users'), where('role', '==', 'admin')))
        .then(snap => {
          const adminUids = snap.docs.map(d => d.id);
          sendPushToAdmins(
            adminUids,
            '✂️ Novo Agendamento!',
            `${userName} marcou para ${dateStr} às ${selectedTime} — posição #${queuePosition}`
          );
        })
        .catch(() => {});

      clearBooking();
      navigate('/history');
    } catch (err) {
      console.error('Appointment save error:', err);
      alert('Erro ao confirmar agendamento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };


  if (checkingExisting) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--accent-red)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <p className="text-muted" style={{ fontSize: '14px' }}>Verificando seus agendamentos...</p>
      </div>
    );
  }

  // ─── BLOCKED VIEW (user already has active booking) ───────────────────────
  if (step === 'blocked' && existingBooking) {
    let dateStr = 'Data Inválida';
    try {
      const d = new Date(existingBooking.date);
      dateStr = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    } catch (_) {}

    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 className="text-h2">Agendamento Ativo</h1>
            <button onClick={() => navigate(-1)} style={{ opacity: 0.6, color: 'white' }}><X size={26} /></button>
          </div>
        </div>

        <div className="scroll-content" style={{ padding: '0 24px' }}>
          {/* Warning */}
          <div style={{ padding: '20px', borderRadius: '20px', background: 'rgba(229,57,53,0.06)', border: '1px solid rgba(229,57,53,0.2)', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <AlertTriangle size={28} style={{ color: 'var(--accent-red)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p className="font-semibold text-white" style={{ marginBottom: '6px' }}>Você já tem um horário marcado!</p>
              <p className="text-sm">Não é possível abrir um novo agendamento enquanto o atual estiver ativo. Aguarde ser atendido ou entre em contato com a barbearia para cancelar.</p>
            </div>
          </div>

          {/* Existing appointment card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <Calendar size={20} className="text-red" />
              <h3 className="text-h3">Seu Agendamento</h3>
            </div>

            {[
              { label: 'Data', value: dateStr },
              { label: 'Horário', value: existingBooking.time },
              { label: 'Barbeiro', value: existingBooking.barberName || '—' },
              { label: 'Status', value: existingBooking.status === 'confirmed' ? 'Confirmado' : 'Aguardando confirmação' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <span className="text-sm">{item.label}</span>
                <span className="text-white font-semibold" style={{ fontSize: '14px' }}>{item.value}</span>
              </div>
            ))}
          </div>

          <p className="text-sm" style={{ textAlign: 'center', marginTop: '24px' }}>
            Após ser atendido, você poderá fazer um novo agendamento.
          </p>
        </div>

        <div style={{ padding: '16px 24px 24px', flexShrink: 0, borderTop: '1px solid var(--border-subtle)', background: 'rgba(9,9,11,0.95)' }}>
          <button className="btn-primary" onClick={() => navigate('/history')}>
            Ver Histórico
          </button>
        </div>
      </div>
    );
  }

  // ─── CALENDAR VIEW ────────────────────────────────────────────────────────
  const renderCalendar = () => {
    const days = getCalendarDays(viewYear, viewMonth);
    const isPrevMonthDisabled = viewYear === today.getFullYear() && viewMonth <= today.getMonth();

    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h1 className="text-h2">Selecionar Data</h1>
            <button onClick={() => navigate(-1)} style={{ opacity: 0.6, color: 'white' }}><X size={26} /></button>
          </div>
          <p className="text-sm" style={{ marginBottom: '20px' }}>Dias em vermelho com "CHEIO" estão sem horários disponíveis.</p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button
              onClick={() => {
                if (!isPrevMonthDisabled) {
                  if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
                  else setViewMonth(m => m - 1);
                }
              }}
              disabled={isPrevMonthDisabled}
              style={{ width: '40px', height: '40px', borderRadius: '12px', background: isPrevMonthDisabled ? 'rgba(255,255,255,0.03)' : 'var(--card-grey)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isPrevMonthDisabled ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-subtle)' }}
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-h3" style={{ fontWeight: 700 }}>{MONTH_NAMES[viewMonth]} {viewYear}</h2>
            <button
              onClick={() => {
                if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
                else setViewMonth(m => m + 1);
              }}
              style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--card-grey)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', border: '1px solid var(--border-subtle)' }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, padding: '4px 0' }}>{d}</div>
            ))}
          </div>
        </div>

        <div className="scroll-content" style={{ padding: '0 24px 24px' }}>
          {loadingMonth ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '14px' }}>Carregando disponibilidade...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {days.map((day, i) => {
                if (!day) return <div key={`pad-${i}`} />;
                const isPast = day < today;
                const isToday = day.getTime() === today.getTime();
                const key = toDateKey(day);
                const slotMap = monthSlotMaps[key] || {};
                const dayFull = isDayFull(slotMap);
                const hasBookings = Object.keys(slotMap).length > 0;
                const isSelected = selectedDate?.getTime() === day.getTime();

                let bg = 'transparent';
                let color = isPast ? 'rgba(255,255,255,0.2)' : 'var(--text-white)';
                let border = 'transparent';

                if (isSelected) { bg = 'var(--accent-red)'; border = 'var(--accent-red)'; }
                else if (dayFull) { bg = 'rgba(229,57,53,0.15)'; color = 'var(--accent-red)'; border = 'rgba(229,57,53,0.3)'; }
                else if (hasBookings) { border = 'rgba(255,165,0,0.3)'; }
                else if (isToday) { border = 'rgba(255,255,255,0.3)'; }

                return (
                  <div
                    key={key}
                    onClick={() => !isPast && !dayFull && handleDaySelect(day)}
                    style={{
                      aspectRatio: '1', borderRadius: '12px', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', fontSize: '15px',
                      fontWeight: isToday || isSelected ? 700 : 500,
                      backgroundColor: bg, color, border: `1px solid ${border}`,
                      opacity: isPast ? 0.35 : 1,
                      cursor: isPast || dayFull ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 4px 12px rgba(229,57,53,0.4)' : 'none',
                    }}
                  >
                    {day.getDate()}
                    {dayFull && <div style={{ fontSize: '7px', color: 'var(--accent-red)', fontWeight: 700, marginTop: '2px', lineHeight: 1 }}>CHEIO</div>}
                    {hasBookings && !dayFull && !isSelected && (
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#FFA500', marginTop: '2px' }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', marginTop: '20px', flexWrap: 'wrap' }}>
            {[{ color: 'var(--accent-red)', label: 'Agenda cheia' }, { color: '#FFA500', label: 'Parcialmente ocupado' }, { color: 'rgba(255,255,255,0.4)', label: 'Disponível' }].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── TIME SLOT VIEW ───────────────────────────────────────────────────────
  const renderTimeSlot = () => {
    const periods = Object.keys(TIME_SLOTS) as ('Manhã' | 'Tarde' | 'Noite')[];
    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <button onClick={() => setStep('calendar')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-red)', fontWeight: 600, fontSize: '14px' }}>
              <ChevronLeft size={18} />
              {selectedDate?.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </button>
            <button onClick={() => navigate(-1)} style={{ opacity: 0.6, color: 'white' }}><X size={26} /></button>
          </div>
          <h1 className="text-h2" style={{ marginBottom: '4px' }}>Selecionar Horário</h1>
          <p className="text-sm" style={{ marginBottom: '20px' }}>Vermelho = lotado. Laranja = tem fila.</p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(0,0,0,0.4)', padding: '6px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
            {periods.map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: period === p ? 600 : 500, backgroundColor: period === p ? 'var(--card-grey-light)' : 'transparent', color: period === p ? 'white' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="scroll-content" style={{ padding: '0 24px 16px' }}>
          {loadingDay ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '14px' }}>Verificando disponibilidade...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {TIME_SLOTS[period].map(time => {
                const count = daySlotMap[time] || 0;
                const full = isSlotFull(daySlotMap, time);
                const isSelected = selectedTime === time;
                const isBusy = count > 0 && !full;

                return (
                  <button
                    key={time}
                    onClick={() => !full && handleTimeSelect(time)}
                    disabled={full}
                    style={{
                      padding: '16px 8px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                      backgroundColor: full ? 'rgba(229,57,53,0.06)' : isSelected ? 'var(--accent-red)' : isBusy ? 'rgba(255,165,0,0.05)' : 'var(--card-grey)',
                      border: full ? '1px solid rgba(229,57,53,0.2)' : isSelected ? '1px solid var(--accent-red)' : isBusy ? '1px solid rgba(255,165,0,0.25)' : '1px solid var(--border-subtle)',
                      color: full ? 'rgba(229,57,53,0.5)' : isSelected ? 'white' : 'var(--text-white)',
                      cursor: full ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 4px 12px rgba(229,57,53,0.4)' : 'none',
                      transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                    }}
                  >
                    <Clock size={16} style={{ opacity: full ? 0.4 : 1 }} />
                    <span style={{ fontSize: '16px', fontWeight: 700 }}>{time}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Users size={10} style={{ opacity: 0.7 }} />
                      <span style={{ fontSize: '10px', opacity: 0.9 }}>
                        {full ? 'Lotado' : count === 0 ? 'Livre' : `${count} na fila`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px 24px', flexShrink: 0, borderTop: '1px solid var(--border-subtle)', background: 'rgba(9,9,11,0.95)' }}>
          <button className="btn-primary" onClick={handleToConfirm} disabled={!selectedTime}>Confirmar Horário</button>
        </div>
      </div>
    );
  };

  // ─── CONFIRMATION VIEW ────────────────────────────────────────────────────
  const renderConfirm = () => {
    if (!selectedDate || !selectedTime) return null;

    const dateStr = (() => {
      try {
        const s = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
        return s.charAt(0).toUpperCase() + s.slice(1);
      } catch { return ''; }
    })();

    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <button onClick={() => setStep('timeslot')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-red)', fontWeight: 600, fontSize: '14px', marginBottom: '20px' }}>
            <ChevronLeft size={18} /> Voltar
          </button>
          <h1 className="text-h2" style={{ marginBottom: '4px' }}>Confirmar Agendamento</h1>
          <p className="text-sm" style={{ marginBottom: '20px' }}>Revise tudo antes de confirmar.</p>
        </div>

        <div className="scroll-content" style={{ padding: '0 24px' }}>
          <div className="card" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 className="text-sm" style={{ textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Resumo</h3>
            {[
              { label: 'Barbeiro', value: barberName || '—' },
              { label: 'Serviços', value: serviceNames.join(' + ') || '—' },
              { label: 'Data', value: dateStr },
              { label: 'Horário', value: selectedTime },
              { label: 'Duração estimada', value: `${totalDuration} min` },
              { label: 'Total', value: `R$ ${totalPrice.toFixed(2)}` },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-sm">{item.label}</span>
                <span className="text-white font-semibold" style={{ fontSize: '14px', maxWidth: '60%', textAlign: 'right' }}>{item.value}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ background: 'linear-gradient(135deg, rgba(229,57,53,0.12), rgba(229,57,53,0.04))', border: '1px solid rgba(229,57,53,0.25)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(229,57,53,0.4)' }}>
                <Users size={24} style={{ color: 'white' }} />
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Posição na Fila</p>
                <p style={{ fontSize: '30px', fontWeight: 800, color: 'white', lineHeight: 1 }}>#{queuePosition}</p>
              </div>
            </div>

            <div style={{ height: '1px', background: 'rgba(229,57,53,0.15)', margin: '0 0 16px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Horário do Slot</p>
                <p className="text-h3 text-white">{selectedTime}</p>
              </div>
              {queuePosition > 1 && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Chegue por volta de</p>
                  <p className="text-h3 text-white">{estimatedArrival}</p>
                </div>
              )}
            </div>

            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', background: queuePosition === 1 ? 'rgba(16,185,129,0.08)' : 'rgba(255,165,0,0.08)', border: `1px solid ${queuePosition === 1 ? 'rgba(16,185,129,0.2)' : 'rgba(255,165,0,0.2)'}` }}>
              <p style={{ fontSize: '13px', color: queuePosition === 1 ? 'var(--success-green)' : '#FFA500', lineHeight: 1.5 }}>
                {queuePosition === 1
                  ? `🎉 Você é o primeiro! Apareça às ${selectedTime}.`
                  : `⏱ Há ${queuePosition - 1} pessoa${queuePosition > 2 ? 's' : ''} antes de você. Chegue por volta das ${estimatedArrival} para não esperar.`
                }
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px 24px', flexShrink: 0, borderTop: '1px solid var(--border-subtle)', background: 'rgba(9,9,11,0.95)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button className="btn-primary" onClick={handleConfirm} disabled={saving} style={{ gap: '10px' }}>
            <CheckCircle size={20} />
            {saving ? 'Confirmando...' : 'Confirmar Agendamento'}
          </button>
          <button onClick={() => setStep('timeslot')} style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '8px', textAlign: 'center' }}>
            Alterar horário
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {step === 'calendar' && renderCalendar()}
      {step === 'timeslot' && renderTimeSlot()}
      {step === 'confirm' && renderConfirm()}
    </>
  );
}
