import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      setError('Credenciais inválidas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter" style={{ justifyContent: 'center', padding: '32px' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', backgroundColor: 'var(--accent-red)', margin: '0 auto 24px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(229,57,53,0.4)' }}>
           <span style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>I</span>
        </div>
        <h1 className="text-h1" style={{ marginBottom: '8px' }}>Bem-vindo de volta</h1>
        <p className="text-muted">Faça login para continuar na Intacto</p>
      </div>

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {error && (
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)', color: 'var(--accent-red)', textAlign: 'center', fontSize: '14px' }}>
            {error}
          </div>
        )}
        
        <div>
          <label className="label">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="seu@email.com"
            required
          />
        </div>
        <div>
          <label className="label">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: '16px' }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar na Conta'}
        </button>
      </form>

      <div style={{ marginTop: '48px', textAlign: 'center' }}>
        <span className="text-muted">Não tem uma conta? </span>
        <Link to="/register" className="text-white font-semibold" style={{ textDecoration: 'underline', textUnderlineOffset: '4px' }}>
          Cadastre-se
        </Link>
      </div>
      
    </div>
  );
}
