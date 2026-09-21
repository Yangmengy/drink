import { useAuth } from './AuthContext';

export function AccountCard() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initial = user.email.slice(0, 1).toUpperCase();
  const registeredAt = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(user.createdAt));

  return (
    <section className="account-card" aria-label="当前账号">
      <span className="account-avatar" aria-hidden="true">{initial}</span>
      <span className="account-details">
        <strong>{user.email}</strong>
        <small>注册于 {registeredAt}</small>
      </span>
      <button type="button" onClick={logout}>退出</button>
    </section>
  );
}
