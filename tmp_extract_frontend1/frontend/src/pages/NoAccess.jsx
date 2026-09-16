import { useNavigate } from 'react-router-dom';

function NoAccess() {
    const navigate = useNavigate();

    return (
        <div className="bg-[#f8f9f8] w-full h-screen overflow-hidden flex items-center justify-center font-display relative" dir="rtl">
            {/* Soft Organic Backgrounds - Welcoming and calm */}
            <div className="fixed top-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-[#e8f5e9]/60 rounded-full blur-[80px] -z-10 animate-pulse-slow"></div>
            <div className="fixed bottom-[-10%] left-[-10%] w-[35vw] h-[35vw] bg-[#f1f8e9]/70 rounded-full blur-[80px] -z-10"></div>

            <div className="relative w-full max-w-[650px] p-4">
                <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-[0_12px_40px_rgb(0,0,0,0.06)] relative z-10 w-full text-center border border-gray-100/80">

                    {/* Floating Lock Icon */}
                    <div className="flex justify-center mb-8">
                        <div className="relative">
                            <div className="w-40 h-40 bg-[#f0f9f0] rounded-[3rem] flex items-center justify-center shadow-[0_8px_30px_rgba(82,111,82,0.12)] transition-transform hover:scale-105 duration-300">
                                <span className="material-symbols-outlined text-[#526f52]" style={{ fontSize: '110px', fontVariationSettings: "'FILL' 0, 'wght' 200" }}>
                                    lock
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Titles */}
                    <h1 className="text-[36px] font-black tracking-tight text-[#2d3748] mb-6">ברוכים הבאים למערכת!</h1>

                    <div className="bg-[#fcfdfc] rounded-[28px] p-8 mb-8 border border-[#e2e8f0]/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.01)] relative overflow-hidden">
                        <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-[#526f52]/40 rounded-r-[28px]"></div>
                        <div className="text-gray-600 text-[20px] font-medium relative z-10 flex flex-col items-center">
                            <span className="mb-6">כרגע אין למשתמש שלך הרשאות פעילות כדי להיכנס למערכת.</span>

                            <div className="text-[#4a5568] text-[20px] font-normal flex flex-col items-center">
                                <strong className="font-bold text-[#2d3748] text-[24px] mb-4">אבל לא לדאוג!</strong>
                                <span className="leading-tight mt-1">כל שעליך לעשות הוא לפנות למנהל המערכת בבקשה</span>
                                <span className="leading-tight mt-2">לקבלת הרשאות, ולהמתין לאישורו.</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full max-w-[320px] mx-auto bg-[#526f52] hover:bg-[#435c43] text-white font-bold text-[18px] py-4 px-8 rounded-full shadow-[0_4px_20px_rgba(82,111,82,0.25)] hover:shadow-[0_8px_25px_rgba(82,111,82,0.35)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 group"
                    >
                        <span>חזרה למסך הכניסה</span>
                        <span className="material-symbols-outlined text-[24px] group-hover:-translate-x-2 transition-transform duration-300">
                            arrow_back
                        </span>
                    </button>

                </div>
            </div>

            {/* Decorative soft blob at bottom right */}
            <div className="fixed bottom-[-5%] right-[-5%] w-[20vw] h-[20vw] bg-[#e0f1e0] rounded-full blur-[60px] -z-20 opacity-50"></div>

            {/* Custom Animation specifically for this page */}
            <style jsx>{`
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
