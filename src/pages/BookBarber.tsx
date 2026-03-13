import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import { useBooking } from '../contexts/BookingContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Barber {
  id: string;
  name: string;
  role: string;
  photoUrl?: string;
}

export default function BookBarber() {
  const navigate = useNavigate();
  const { booking, updateBooking } = useBooking();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBarbers = async () => {
      try {
        const q = query(collection(db, 'barbers'), where('isAvailable', '==', true));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const fetchedBarbers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Barber));
          setBarbers(fetchedBarbers);
        }
      } catch (err) {
        console.error('Error fetching barbers', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBarbers();
  }, []);

  const handleSelect = (id: string) => updateBooking({ barberId: id });

  const handleContinue = () => {
    if (booking.barberId) {
      if (!booking.serviceIds.length) navigate('/book/service');
      else if (!booking.date || !booking.time) navigate('/book/datetime');
      else navigate('/'); 
    }
  };

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 className="text-h2">Selecionar profissional</h1>
        <button onClick={() => navigate(-1)} className="text-white" style={{ opacity: 0.7 }}>
          <X size={28} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingBottom: '24px' }}>
        {loading ? (
           Array.from({length: 3}).map((_, i) => (
             <div key={i} className="card" style={{ height: '90px', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
           ))
        ) : barbers.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
             <p className="text-muted">Nenhum barbeiro disponível no momento.</p>
          </div>
        ) : barbers.map((barber) => {
          const isSelected = booking.barberId === barber.id;
          return (
            <div
              key={barber.id}
              onClick={() => handleSelect(barber.id)}
              className={`card card-interactive ${isSelected ? 'selected' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'var(--card-grey-light)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {barber.photoUrl ? (
                    <img src={barber.photoUrl} alt={barber.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="text-muted" style={{ fontSize: '12px' }}>Foto</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-h3 text-white" style={{ marginBottom: '4px' }}>{barber.name}</p>
                  <p className="text-sm">{barber.role}</p>
                </div>
              </div>
              {isSelected && (
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(229,57,53,0.5)' }}>
                  <Check size={18} className="text-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ paddingTop: '24px', paddingBottom: '16px' }}>
        <button 
          onClick={handleContinue}
          className="btn-primary" 
          disabled={!booking.barberId}
        >
          {booking.serviceIds.length && booking.date ? 'Confirmar Barbeiro' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
