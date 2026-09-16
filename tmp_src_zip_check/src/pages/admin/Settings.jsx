import React, { useState, useEffect } from 'react';
import { createMessage } from '../../services/messageService';
import { getSettings, updateSettings } from '../../services/settingsService';
import LoadingSpinner from '../../components/LoadingSpinner';

const Settings = () => {
    const [saving, setSaving] = useState(false);

    // Message Settings State
    const [messageTitle, setMessageTitle] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [messageSuccess, setMessageSuccess] = useState('');
    const [messageError, setMessageError] = useState('');

    // System Settings State
    const [lowStockPercentage, setLowStockPercentage] = useState(10);
    const [settingsSuccess, setSettingsSuccess] = useState('');
    const [settingsError, setSettingsError] = useState('');

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const data = await getSettings();
                if (data && data.lowStockPercentage !== undefined) {
                    setLowStockPercentage(data.lowStockPercentage);
                }
            } catch (err) {
                console.error("Failed to load settings:", err);
            }
        };
        loadSettings();
    }, []); const handleSendMessage = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessageSuccess('');
        setMessageError('');
        try {
            await createMessage({ title: messageTitle, content: messageContent });
            setMessageSuccess('הודעת המערכת נשלחה בהצלחה לכלל המשתמשים!');
            setMessageTitle('');
            setMessageContent('');
        } catch (err) {
            console.error(err);
            setMessageError('שגיאה בשליחת הודעת המערכת.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();

        const percentage = parseFloat(lowStockPercentage);
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            setSettingsError('יש להזין אחוז תקין בין 0 ל-100.');
            return;
        }

        setSaving(true);
        setSettingsSuccess('');
        setSettingsError('');
        try {
            await updateSettings({ lowStockPercentage: percentage });
            setSettingsSuccess('הגדרות המערכת עודכנו בהצלחה!');
        } catch (err) {
            console.error(err);
            setSettingsError('שגיאה בשמירת ההגדרות.');
        } finally {
            setSaving(false);
        }
    };


    return (
        <div className="space-y-8 pb-20 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#2d3748]">הגדרות מערכת</h1>
                    <p className="text-[#a0aec0] text-sm mt-1">ניהול הגדרות כלליות והודעות קופצות</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                <div className="bg-white rounded-[32px] p-8 shadow-[0_4px_20px_rgb(0,0,0,0.04)] flex flex-col">
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

                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">תוכן ההודעה *</label>
                            <textarea
                                required
                                rows="4"
                                placeholder="הזן את פרטי ההודעה כאן..."
                                className="w-full h-[calc(100%-24px)] px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20 resize-none min-h-[100px]"
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                            ></textarea>
                        </div>

                        {messageSuccess && <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg mt-auto">{messageSuccess}</div>}
                        {messageError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mt-auto">{messageError}</div>}

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full border-2 border-[#526f52] text-[#526f52] hover:bg-[#526f52] hover:text-white disabled:opacity-50 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 mt-auto shrink-0"
                        >
                            <span className="material-symbols-outlined">send</span>
                            <span>{saving ? 'שולח...' : 'שלח הודעה לכולם'}</span>
                        </button>
                    </form>
                </div>

                {/* System Settings Block */}
                <div className="bg-white rounded-[32px] p-8 shadow-[0_4px_20px_rgb(0,0,0,0.04)] flex flex-col">
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

                        <div>
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

                        {settingsSuccess && <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg mt-auto">{settingsSuccess}</div>}
                        {settingsError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mt-auto">{settingsError}</div>}

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-[#526f52] hover:bg-[#435c43] text-white disabled:opacity-50 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 mt-auto shrink-0"
                        >
                            <span className="material-symbols-outlined">save</span>
                            <span>{saving ? 'שומר...' : 'שמור הגדרות'}</span>
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default Settings;
