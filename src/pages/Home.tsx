import { Link } from 'react-router-dom';
import { User, Scissors, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Cliente';

  return (
    <div className="page-enter">
      <div className="scroll-content" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
        {/* Background Image Header */}
        <div style={{
          position: 'relative',
          height: '35vh',
          minHeight: '250px',
          backgroundImage: 'url("https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=800&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderBottomLeftRadius: '32px',
          borderBottomRightRadius: '32px',
          overflow: 'hidden',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(9,9,11,0.3) 0%, rgba(9,9,11,0.95) 100%)'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '32px',
            left: '24px',
            right: '24px'
          }}>
            <h2 className="text-xs mb-2" style={{ marginBottom: '8px', color: 'rgba(255,255,255,0.7)' }}>BEM-VINDO, {firstName.toUpperCase()}</h2>
            <h1 className="text-h1">
              Agende <span className="text-white">seu</span> <span className="text-red">horário</span>
            </h1>
          </div>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          <p className="text-sm" style={{ marginBottom: '8px' }}>O que você deseja fazer hoje?</p>
          
          {/* Selection Cards */}
          <Link to="/book/barber" className="card card-interactive" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: 'rgba(229, 57, 53, 0.1)', border: '1px solid rgba(229, 57, 53, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={24} className="text-red" />
              </div>
              <div>
                <p className="text-h3 text-white" style={{ marginBottom: '2px' }}>Barbeiro</p>
                <p className="text-sm">Selecione o profissional</p>
              </div>
            </div>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={18} className="text-muted" />
            </div>
          </Link>

          <Link to="/book/service" className="card card-interactive" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Scissors size={24} className="text-white" />
              </div>
              <div>
                <p className="text-h3 text-white" style={{ marginBottom: '2px' }}>Serviço</p>
                <p className="text-sm">Selecione o corte</p>
              </div>
            </div>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={18} className="text-muted" />
            </div>
          </Link>

          <Link to="/book/datetime" className="card card-interactive" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarIcon size={24} className="text-white" />
              </div>
              <div>
                <p className="text-h3 text-white" style={{ marginBottom: '2px' }}>Data e hora</p>
                <p className="text-sm">Disponibilidade</p>
              </div>
            </div>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={18} className="text-muted" />
            </div>
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
