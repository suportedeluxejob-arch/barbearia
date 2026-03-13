import { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';
import { LogOut, User, Save } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user, { displayName: name });
      await updateDoc(doc(db, 'users', user.uid), { name });
      setMsg('Perfil atualizado com sucesso!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="page-enter">
      <div className="scroll-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 className="text-h1 text-white">Meu Perfil</h1>
          <button onClick={handleLogout} className="text-muted" style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
            <LogOut size={20} />
          </button>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'var(--card-grey-light)', margin: '0 auto 16px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)' }}>
              <User size={40} className="text-muted" />
            </div>
            <p className="text-muted">{user?.email}</p>
          </div>

          <form onSubmit={handleSave} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="text-h3" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '8px' }}>Dados Pessoais</h3>
            
            {msg && (
              <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: msg.includes('Erro') ? 'rgba(229,57,53,0.1)' : 'rgba(16,185,129,0.1)', color: msg.includes('Erro') ? 'var(--accent-red)' : 'var(--success-green)', textAlign: 'center', fontSize: '14px' }}>
                {msg}
              </div>
            )}

            <div>
              <label className="label">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="Seu nome"
                required
              />
            </div>
            
            <button type="submit" className="btn-primary" style={{ marginTop: '8px' }} disabled={loading}>
              <Save size={20} style={{ marginRight: '8px' }} />
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}
