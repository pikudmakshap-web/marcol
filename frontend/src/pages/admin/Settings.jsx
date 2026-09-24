import React, { useState, useEffect } from 'react';
import { createMessage } from '../../services/messageService';
import { getSettings, updateSettings } from '../../services/settingsService';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

const Settings = () => {
    const { user: currentUser } = useAuthStore();
    const [posManualEntryDisabled, setPosManualEntryDisabled] = useState(false);
    const [settingsReady, setSettingsReady] = useState(false);
    const [settingsError, setSettingsError] = useState('');
    const [isSavingMessage, setIsSavingMessage] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Message Settings State
    const [messageTitle, setMessageTitle] = useState('');
    const [messageContent, setMessageContent] = useState('');

    // System Settings State
    const [lowStockPercentage, setLowStockPercentage] = useState(10);

    useEffect(() => {
        let active = true;
        setSettingsReady(false);
        setSettingsError('');
        const loadSettings = async () => {
            try {
                const data = await getSettings();
                if (!active) return;
                if (data.environmentId !== currentUser?.environmentId) throw new Error('Environment changed');
                setLowStockPercentage(data.lowStockPercentage ?? 10);
                setPosManualEntryDisabled(data.posManualEntryDisabled === true);
                setSettingsReady(true);
            } catch (_error) {
                if (active) setSettingsError('טעינת ההגדרות נכשלה. יש לרענן לפני שמירה.');
            }
        };
        loadSettings();
        return () => { active = false; };
    }, [currentUser?.environmentId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        setIsSavingMessage(true);
        try {
            await createMessage({ title: messageTitle, content: messageContent });
            toast.success('הודעת המערכת נשלחה בהצלחה לכלל המשתמשים!');
            setMessageTitle('');
            setMessageContent('');
        } catch (err) {
            console.error(err);
            toast.error('שגיאה בשליחת הודעת המערכת.');
        } finally {
            setIsSavingMessage(false);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();

        if (!settingsReady || isSavingSettings) return;
        const percentage = Number(lowStockPercentage);
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            toast.error('יש להזין אחוז תקין בין 0 ל-100.');
            return;
        }

        setIsSavingSettings(true);
        try {
            await updateSettings({ lowStockPercentage: percentage, posManualEntryDisabled, environmentId: currentUser?.environmentId });
            toast.success('הגדרות המערכת עודכנו בהצלחה!');
        } catch (err) {
            console.error(err);
            toast.error('שגיאה בשמירת ההגדרות.');
        } finally {
            setIsSavingSettings(false);
        }
    };


    return (
        <div className="space-y-8 pb-20 max-w-4xl mx-auto" data-tour="settings-page">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#2d3748]">הגדרות מערכת</h1>
                    <p className="text-[#a0aec0] text-sm mt-1">ניהול הגדרות כלליות והודעות קופצות</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch" data-tour="settings-panels">
                <div className="bg-white rounded-[32px] p-8 shadow-[0_4px_20px_rgb(0,0,0,0.04)] flex flex-col h-full" data-tour="settings-global-message">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-[#526f52]/10 flex items-center justify-center text-[#526f52]">
                            <span className="material-symbols-outlined text-2xl">campaign</span>
                        </div>
                        <h2 className="text-xl font-bold text-[#2d3748]">הודעת מערכת גלובלית</h2>
                    </div>

                    <form onSubmit={handleSendMessage} className="space-y-5 flex-1 flex flex-col">
                        <p className="text-xs text-gray-500 mb-2">
                            הודעה חדשה שתשלח כאן תחליף כל הודעה פעילה קודמת, ותקפוץ לכל המשתמשים במערכת (רופאים, קופאים ומנהלים) עד שהם יאשרו שקראו אותה.
                        </p>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">כותרת ההודעה *</label>
                            <input
                                type="text"
                                required
                                placeholder="לדוגמה: עדכון חשוב לגבי שעות פעילות"
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                value={messageTitle}
                                onChange={(e) => setMessageTitle(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 min-h-[120px]">
                            <label className="block text-sm font-bold text-gray-700 mb-1">תוכן ההודעה *</label>
                            <textarea
                                required
                                rows="4"
                                placeholder="הזן את פרטי ההודעה כאן..."
                                className="w-full h-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20 resize-none min-h-[100px]"
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            disabled={isSavingMessage}
                            className="w-full mt-4 border-2 border-[#526f52] text-[#526f52] hover:bg-[#526f52] hover:text-white disabled:opacity-50 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shrink-0"
                        >
                            <span className="material-symbols-outlined">send</span>
                            <span>{isSavingMessage ? 'שולח...' : 'שלח הודעה לכולם'}</span>
                        </button>
                    </form>
                </div>

                {/* System Settings Block */}
                <div className="bg-white rounded-[32px] p-8 shadow-[0_4px_20px_rgb(0,0,0,0.04)] flex flex-col h-full" data-tour="settings-general-config">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-[#526f52]/10 flex items-center justify-center text-[#526f52]">
                            <span className="material-symbols-outlined text-2xl">settings</span>
                        </div>
                        <h2 className="text-xl font-bold text-[#2d3748]">הגדרות כלליות</h2>
                    </div>

                    <form onSubmit={handleSaveSettings} className="space-y-5 flex-1 flex flex-col">
                        <p className="text-xs text-gray-500 mb-2">
                            הגדרת רף עולמי עבור התרעת "מלאי נמוך" במוצרים. הרף מחושב כאחוז מהכמות ההתחלתית שהוזנה בעת יצירת המוצר או העדכון האחרון.
                        </p>

                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">התרעת מלאי נמוך (%) *</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    step="1"
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20 pr-10"
                                    value={lowStockPercentage}
                                    onChange={(e) => setLowStockPercentage(e.target.value)}
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                            </div>
                        </div>

                        <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer">
                            <input type="checkbox" className="mt-1" checked={posManualEntryDisabled}
                                disabled={!settingsReady || isSavingSettings}
                                onChange={(event) => setPosManualEntryDisabled(event.target.checked)} />
                            <span>
                                <span className="block text-sm font-bold">חסימת הקלדה ידנית בקופה בלבד</span>
                                <span className="block text-xs text-gray-600 mt-1">חוסם הקלדה, הדבקה ושינוי כמות בהקלדה בקופה. סריקת ברקוד, בחירת מוצרים וכפתורי הכמות נשארים פעילים. מסכי הניהול אינם משתנים.</span>
                            </span>
                        </label>
                        {settingsError && <p role="alert" className="text-sm text-red-700">{settingsError}</p>}

                        <button
                            type="submit"
                            disabled={isSavingSettings || !settingsReady}
                            className="w-full mt-4 bg-[#526f52] hover:bg-[#435c43] text-white disabled:opacity-50 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shrink-0"
                        >
                            <span className="material-symbols-outlined">save</span>
                            <span>{isSavingSettings ? 'שומר...' : 'שמור הגדרות'}</span>
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default Settings;
