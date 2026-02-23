import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import LoadingSpinner from '../components/LoadingSpinner';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login, error, loading } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const data = await login(username, password);

            // Redirect based on role
            if (data.user.role === 'admin') {
                navigate('/admin/dashboard');
            } else if (data.user.role === 'cashier') {
                navigate('/pos/checkout');
            } else if (data.user.role === 'officer') {
                navigate('/officer/dashboard');
            }
        } catch (err) {
            console.error('Login failed:', err);
        }
    };

    return (
        <div className="bg-[#f8f9f8] min-h-screen relative overflow-hidden flex items-center justify-center font-display" dir="rtl">
            {/* Soft Organic Backgrounds - Lighter and more subtle */}
            <div
                className="fixed top-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-[#e8f5e9]/50 rounded-full blur-[80px] -z-10"
            ></div>
            <div
                className="fixed bottom-[-10%] left-[-10%] w-[35vw] h-[35vw] bg-[#f1f8e9]/60 rounded-full blur-[80px] -z-10"
            ></div>

            <div className="relative w-full max-w-[400px] p-4">
                <div className="bg-white rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10 w-full text-center">

                    {/* Header with Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative mb-4">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-[0_2px_15px_rgb(0,0,0,0.05)]">
                                <span className="material-symbols-outlined text-[#3ce619] text-3xl"
                                    style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>
                                    eco
                                </span>
                            </div>
                            <div className="absolute top-0 right-0 w-3 h-3 bg-[#ff6b6b] rounded-full border-2 border-white"></div>
                        </div>

                        <h1 className="text-2xl font-bold text-[#2d3748] mb-1">כניסה למערכת</h1>
                        <p className="text-[#a0aec0] text-xs">ניהול תקציב וקופה חכם</p>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl text-red-500 text-xs">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username field */}
                        <div className="space-y-1.5 text-right">
                            <label className="block text-[11px] font-bold text-[#a0aec0] mr-1" htmlFor="username">
                                שם משתמש / ת.ז
                            </label>
                            <div className="relative">
                                <input
                                    className="block w-full pl-10 pr-4 py-3 bg-[#f7fafc] border border-transparent rounded-full text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-200 focus:ring-0 transition-all text-right"
                                    id="username"
                                    placeholder="הכנס מזהה משתמש"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400 text-[20px]">
                                        person
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Password field */}
                        <div className="space-y-1.5 text-right">
                            <label className="block text-[11px] font-bold text-[#a0aec0] mr-1" htmlFor="password">
                                סיסמה
                            </label>
                            <div className="relative">
                                <input
                                    className="block w-full pl-10 pr-4 py-3 bg-[#f7fafc] border border-transparent rounded-full text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-200 focus:ring-0 transition-all text-right"
                                    id="password"
                                    placeholder="••••••••"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400 text-[20px]">
                                        lock
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-start mt-1">
                                <a className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors" href="#">
                                    שכחתי סיסמה?
                                </a>
                            </div>
                        </div>

                        {/* Submit button */}
                        <button
                            className="w-full bg-[#526f52] hover:bg-[#435c43] text-white font-medium py-3.5 px-6 rounded-full shadow-[0_4px_14px_rgb(82,111,82,0.2)] hover:shadow-[0_6px_20px_rgb(82,111,82,0.3)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mt-8"
                            type="submit"
                            disabled={loading}
                        >
                            <span className="material-symbols-outlined text-lg">
                                {loading ? '' : 'arrow_back'}
                            </span>
                            <span>
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <LoadingSpinner size="small" text="" />
                                        <span>מתחבר...</span>
                                    </div>
                                ) : (
                                    'כניסה למערכת'
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-gray-400">
                            עדיין אין לך גישה?{' '}
                            <a className="text-[#e57373] font-medium hover:underline" href="#">
                                פנה למנהל המערכת
                            </a>
                        </p>
                    </div>
                </div>
            </div>

            {/* Decorative soft blob at bottom right for balance (optional, based on image feel) */}
            <div
                className="fixed bottom-[-5%] right-[-5%] w-[20vw] h-[20vw] bg-[#e0f1e0] rounded-full blur-[60px] -z-20 opacity-50"
            ></div>
        </div>
    );
}

export default Login;
