import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isNative, getToken, clearToken, setToken, clearModelKey, api } from '../api/client';

interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthState {
  ready: boolean;
  loggedIn: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  ready: isNative(),
  loggedIn: isNative(),
  user: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const native = isNative();
  const [ready, setReady] = useState(native);
  const [loggedIn, setLoggedIn] = useState(native);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (native || !getToken()) {
      setReady(true);
      return;
    }

    // 页面刷新后先确认旧令牌，再决定是否显示受保护界面，
    // 避免登录状态闪烁或误判为未登录。
    api.me()
      .then(restored => {
        setUser(restored);
        setLoggedIn(true);
      })
      .catch(() => {
        setLoggedIn(false);
      })
      .finally(() => setReady(true));
  }, [native]);

  const completeAuth = (response: { token: string; user: AuthUser }) => {
    setToken(response.token);
    setUser(response.user);
    setLoggedIn(true);
  };

  const login = async (email: string, password: string) => {
    clearToken();
    clearModelKey();
    completeAuth(await api.login(email, password));
  };

  const register = async (email: string, password: string) => {
    clearToken();
    clearModelKey();
    completeAuth(await api.register(email, password));
  };

  const logout = () => {
    clearToken();
    clearModelKey();
    setUser(null);
    setLoggedIn(false);
  };

  return <AuthContext.Provider value={{ ready, loggedIn, user, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
