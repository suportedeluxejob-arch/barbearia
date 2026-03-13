import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: name });
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email,
        phone,
        role: 'user', 
        createdAt: new Date()
      });

      navigate('/');
    } catch (err: any) {
      setError('Erro ao criar conta. Verifique os dados inseridos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter" style={{ justifyContent: 'center', padding: '32px 24px', overflowY: 'auto' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 className="text-h1" style={{ marginBottom: '8px' }}>Criar Conta</h1>
        <p className="text-muted">Junte-se à Intacto Men Barbershop</p>
      </div>

      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)', color: 'var(--accent-red)', textAlign: 'center', fontSize: '14px' }}>
            {error}
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

        <div>
          <label className="label">WhatsApp</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-field"
            placeholder="(11) 99999-9999"
            required
          />
        </div>

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
            placeholder="Mínimo 6 caracteres"
            minLength={6}
            required
          />
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: '24px' }} disabled={loading}>
          {loading ? 'Cadastrando...' : 'Criar minha conta'}
        </button>
      </form>

      <div style={{ marginTop: '40px', textAlign: 'center' }}>
        <span className="text-muted">Já tem uma conta? </span>
        <Link to="/login" className="text-white font-semibold" style={{ textDecoration: 'underline', textUnderlineOffset: '4px' }}>
          Faça Login
        </Link>
      </div>
      
    </div>
  );
}
