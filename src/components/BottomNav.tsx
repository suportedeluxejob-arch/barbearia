import { Link, useLocation } from 'react-router-dom';
import { Calendar, Clock, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function BottomNav() {
  const location = useLocation();
  const { role } = useAuth();
  
  const navItems = [
    { path: '/', icon: Calendar, label: 'Agendar' },
    { path: '/history', icon: Clock, label: 'Histórico' },
    { path: '/profile', icon: User, label: 'Perfil' },
  ];

  if (role === 'admin') {
    navItems.push({ path: '/admin', icon: User, label: 'Admin' });
  }

  return (
    <div className="bottom-actions" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
      {navItems.map((item) => {
        const isActive = location.pathname === item.path || (item.path === '/' && location.pathname.startsWith('/book'));
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '6px',
              color: isActive ? 'var(--accent-red)' : 'var(--text-muted)',
              transition: 'all 0.3s ease'
             }}
          >
            <Icon size={24} style={{ filter: isActive ? 'drop-shadow(0 0 8px rgba(229,57,53,0.5))' : 'none' }} />
            <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
