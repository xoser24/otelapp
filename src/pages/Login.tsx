import React, { useState } from 'react';
import Logo from '../components/Logo';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basit kullanıcılar ve rol bazlı yönlendirme
    const users = [
      { username: 'admin', password: 'password', role: 'admin' },
      { username: 'hk', password: 'password', role: 'housekeeping' },
      { username: 'housekeeping', password: 'password', role: 'housekeeping' },
      { username: 'yonetim', password: 'password', role: 'management' },
    ];

    const found = users.find(u => u.username === username && u.password === password);
    if (!found) {
      setError('Geçersiz kullanıcı adı veya şifre');
      return;
    }

    // Oturum ve rol saklama
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('user', JSON.stringify({ username: found.username, role: found.role }));

    // Rol bazlı yönlendirme
    if (found.role === 'housekeeping') {
      // Housekeeping portalı aynı sunucu portunda çalışır
      navigate('/housekeeping');
    } else if (found.role === 'management') {
      navigate('/management');
    } else {
      navigate('/admin');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Logo size={64} variant="login" src="/kent-group-logo.png" />
          </div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
            Otel Yönetim Sistemi
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Yönetim paneline erişmek için giriş yapın
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <input type="hidden" name="remember" value="true" />
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                Kullanıcı Adı
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Kullanıcı Adı (admin / hk / yonetim)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Şifre (password)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Giriş Yap
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;