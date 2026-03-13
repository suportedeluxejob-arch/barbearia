import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Plus } from 'lucide-react';
import { useBooking } from '../contexts/BookingContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

export default function BookService() {
  const navigate = useNavigate();
  const { booking, toggleService } = useBooking();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'services'));
        if (!snapshot.empty) {
          setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
        }
      } catch (err) {
        console.error('Error fetching services', err);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const totalPrice = services
    .filter(s => booking.serviceIds.includes(s.id))
    .reduce((sum, s) => sum + s.price, 0);

  const totalDuration = services
    .filter(s => booking.serviceIds.includes(s.id))
    .reduce((sum, s) => sum + s.duration, 0);

  const handleContinue = () => {
    if (booking.serviceIds.length === 0) return;
    if (!booking.barberId) navigate('/book/barber');
    else navigate('/book/datetime');
  };

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h1 className="text-h2">Selecionar Serviços</h1>
          <button onClick={() => navigate(-1)} style={{ opacity: 0.6, color: 'white' }}><X size={26} /></button>
        </div>
        <p className="text-sm" style={{ marginBottom: '20px' }}>Selecione um ou mais serviços desejados.</p>
      </div>

      <div className="scroll-content" style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
           Array.from({length: 3}).map((_, i) => (
            <div key={i} className="card" style={{ height: '80px', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
          ))
        ) : services.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
             <p className="text-muted">Nenhum serviço disponível no momento.</p>
          </div>
        ) : services.map((service) => {
          const isSelected = booking.serviceIds.includes(service.id);
          return (
            <div
              key={service.id}
              onClick={() => toggleService(service.id)}
              className={`card card-interactive ${isSelected ? 'selected' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* Checkbox indicator */}
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                  backgroundColor: isSelected ? 'var(--accent-red)' : 'transparent',
                  border: isSelected ? '2px solid var(--accent-red)' : '2px solid var(--border-focus)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isSelected ? '0 0 10px rgba(229,57,53,0.4)' : 'none',
                  transition: 'all 0.2s'
                }}>
                  {isSelected && <Check size={16} style={{ color: 'white' }} />}
                </div>

                <div>
                  <p className="text-white font-semibold" style={{ fontSize: '16px', marginBottom: '4px' }}>{service.name}</p>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                    {service.duration} min
                  </span>
                </div>
              </div>

              <p className="text-white font-semibold" style={{ fontSize: '18px', flexShrink: 0 }}>
                R$ {service.price.toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Summary + Continue */}
      <div style={{ padding: '16px 24px 24px', flexShrink: 0, borderTop: '1px solid var(--border-subtle)', background: 'rgba(9,9,11,0.95)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {booking.serviceIds.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '14px', background: 'rgba(229,57,53,0.06)', border: '1px solid rgba(229,57,53,0.15)' }}>
            <div>
              <p className="text-sm">
                {booking.serviceIds.length} serviço{booking.serviceIds.length > 1 ? 's' : ''} selecionado{booking.serviceIds.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs" style={{ marginTop: '2px' }}>Duração estimada: {totalDuration} min</p>
            </div>
            <p className="text-white font-semibold" style={{ fontSize: '20px' }}>R$ {totalPrice.toFixed(2)}</p>
          </div>
        )}
        <button
          onClick={handleContinue}
          className="btn-primary"
          disabled={booking.serviceIds.length === 0}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <Plus size={20} />
          {booking.barberId ? 'Selecionar Data e Hora' : 'Selecionar Barbeiro'}
        </button>
      </div>
    </div>
  );
}
