import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const errorMessage = (error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error);
    const messages: Record<string, string> = {
      'invalid email or password': '邮箱或密码不正确',
      'email is already registered': '该邮箱已注册，请直接登录',
      'email is invalid': '邮箱格式不正确',
      'password must be between 8 and 128 characters': '密码需要 8–128 位',
    };
    return messages[raw] ?? raw;
  };

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
      navigate('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="login-page">
      <h1>Bartender</h1>
      <p>一起，慢一点。</p>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); submit(); }}>
        <input type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="密码（至少 8 位）" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
        {error && <p className="login-error" role="alert">{error}</p>}
        {mode === 'login' ? (
          <>
            <button type="submit" disabled={busy}>{busy ? '正在登录…' : '登录'}</button>
            <button type="button" disabled={busy} onClick={() => { setError(''); setMode('register'); }}>注册新用户</button>
          </>
        ) : (
          <>
            <button type="submit" disabled={busy}>{busy ? '正在注册…' : '注册并登录'}</button>
            <button type="button" disabled={busy} onClick={() => { setError(''); setMode('login'); }}>返回登录</button>
          </>
        )}
      </form>
    </div>
  );
}
