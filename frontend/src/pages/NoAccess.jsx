import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../services/api';

function NoAccess() {
    const navigate = useNavigate();
    const [environments, setEnvironments] = useState([]);
    const [selectedEnvId, setSelectedEnvId] = useState('');
    const [admins, setAdmins] = useState([]);
    const [loadingAdmins, setLoadingAdmins] = useState(false);

    useEffect(() => {
        const fetchEnvironments = async () => {
            try {
                const response = await api.get('/auth/environments');
                setEnvironments(response.data);
                if (response.data.length === 1) {
                    setSelectedEnvId(response.data[0].id);
                }
            } catch (error) {
                console.error('Failed to fetch environments:', error);
            }
        };
        fetchEnvironments();
    }, []);

    useEffect(() => {
        if (!selectedEnvId) {
            setAdmins([]);
            return;
        }
        const fetchAdmins = async () => {
            setLoadingAdmins(true);
            try {
                const response = await api.get(`/auth/environments/${selectedEnvId}/admins`);
                setAdmins(response.data);
            } catch (error) {
                console.error('Failed to fetch admins:', error);
                setAdmins([]);
            } finally {
                setLoadingAdmins(false);
            }
        };
        fetchAdmins();
    }, [selectedEnvId]);

    return (
        <div className="bg-[#f8f9f8] w-full min-h-screen overflow-y-auto flex items-center justify-center font-display relative py-12" dir="rtl">
            {/* Soft Organic Backgrounds */}
            <div className="fixed top-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-[#e8f5e9]/60 rounded-full blur-[80px] -z-10 animate-pulse-slow"></div>
            <div className="fixed bottom-[-10%] left-[-10%] w-[35vw] h-[35vw] bg-[#f1f8e9]/70 rounded-full blur-[80px] -z-10"></div>

            <div className="relative w-full max-w-[600px] p-4">
                <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-[0_12px_40px_rgb(0,0,0,0.06)] relative z-10 w-full text-center border border-gray-100/80 flex flex-col max-h-[92vh]">

                    <div className="flex-shrink-0">
                        {/* Floating Lock Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="w-24 h-24 bg-[#f0f9f0] rounded-3xl flex items-center justify-center shadow-[0_4px_20px_rgba(82,111,82,0.12)] transition-transform hover:scale-105 duration-300">
                                    <span className="material-symbols-outlined text-[#526f52]" style={{ fontSize: '60px', fontVariationSettings: "'FILL' 0, 'wght' 200" }}>
                                        lock
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Titles */}
                        <h1 className="text-2xl font-black tracking-tight text-[#2d3748] mb-4">ברוכים הבאים למערכת!</h1>

                        <div className="bg-[#fcfdfc] rounded-2xl p-5 mb-5 border border-[#e2e8f0]/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.01)] relative overflow-hidden">
                            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-[#526f52]/40 rounded-r-2xl"></div>
                            <div className="text-gray-600 text-base font-medium relative z-10 flex flex-col items-center">
                                <span className="mb-3">כרגע אין למשתמש שלך הרשאות פעילות כדי להיכנס למערכת.</span>
                                <div className="text-[#4a5568] text-sm font-normal flex flex-col items-center">
                                    <strong className="font-bold text-[#2d3748] text-lg mb-2">אבל לא לדאוג!</strong>
                                    <span className="leading-tight">בחר את הסביבה שאתה רוצה להצטרף אליה ופנה למנהל הרלוונטי לקבלת הרשאות.</span>
                                </div>
                            </div>
                        </div>

                        {/* Environment Selector */}
                        {environments.length > 0 && (
                            <div className="mb-5 text-right">
                                <label className="block text-sm font-bold text-[#2d3748] mb-2">בחר סביבה:</label>
                                <select
                                    value={selectedEnvId}
                                    onChange={(e) => setSelectedEnvId(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-[#e2e8f0] bg-[#f8faf8] text-[#2d3748] font-medium focus:outline-none focus:ring-2 focus:ring-[#526f52]/30 focus:border-[#526f52] transition-all"
                                >
                                    <option value="">— בחר סביבה —</option>
                                    {environments.map(env => (
                                        <option key={env.id} value={env.id}>{env.name}</option>
                                    ))}
                                </select>
                                {selectedEnvId && environments.find(e => e.id === selectedEnvId)?.description && (
                                    <p className="text-xs text-gray-500 mt-1.5 text-right">
                                        {environments.find(e => e.id === selectedEnvId).description}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Admins List */}
                    {selectedEnvId && (
                        <div className="flex-1 overflow-y-auto min-h-[60px] max-h-[260px] mb-6 pr-1 custom-scrollbar text-right">
                            <h3 className="text-base font-bold text-[#2d3748] mb-3">
                                {loadingAdmins ? 'טוען...' : admins.length > 0 ? 'מנהלי הסביבה הזמינים לפניה:' : 'לא נמצאו מנהלים בסביבה זו'}
                            </h3>
                            {!loadingAdmins && (
                                <div className="grid gap-2">
                                    {admins.map((admin) => (
                                        <a
                                            key={admin.id}
                                            href={`mailto:${admin.email || ''}?subject=בקשת הרשאות למערכת&body=שלום ${admin.fullName},%0D%0A%0D%0Aאשמח לקבל הרשאות גישה למערכת.%0D%0A%0D%0Aתודה!`}
                                            className="flex items-center gap-3 p-3 bg-[#f8faf8] hover:bg-[#edf2ed] border border-[#e2e8f0] rounded-xl transition-colors duration-200 group text-right"
                                        >
                                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm text-[#526f52] group-hover:scale-110 transition-transform shrink-0">
                                                <span className="material-symbols-outlined text-[18px]">mail</span>
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-sm text-[#2d3748] truncate">{admin.fullName}</span>
                                                {admin.email && <span className="text-xs text-gray-500 truncate">{admin.email}</span>}
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Button */}
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full max-w-[280px] mx-auto shrink-0 bg-[#526f52] hover:bg-[#435c43] text-white font-bold text-base py-3 px-6 rounded-full shadow-[0_4px_15px_rgba(82,111,82,0.25)] hover:shadow-[0_6px_20px_rgba(82,111,82,0.35)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 group"
                    >
                        <span>חזרה למסך הכניסה</span>
                        <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform duration-300">
                            arrow_back
                        </span>
                    </button>

                </div>
            </div>

            {/* Decorative blob */}
            <div className="fixed bottom-[-5%] right-[-5%] w-[20vw] h-[20vw] bg-[#e0f1e0] rounded-full blur-[60px] -z-20 opacity-50"></div>

            <style>{`
                @keyframes pulse-slow {
                    0%, 100% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.05); opacity: 1; }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 6s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

export default NoAccess;
