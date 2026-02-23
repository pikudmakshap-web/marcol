import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../../services/settingsService';
import { createMessage } from '../../services/messageService';
import LoadingSpinner from '../../components/LoadingSpinner';

const Settings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Inventory Settings State
    const [threshold, setThreshold] = useState(10);
    const [settingsSuccess, setSettingsSuccess] = useState('');
    const [settingsError, setSettingsError] = useState('');

    // Message Settings State
    const [messageTitle, setMessageTitle] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [messageSuccess, setMessageSuccess] = useState('');
    const [messageError, setMessageError] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const data = await getSettings();
            if (data) {
                setThreshold(data.lowStockThreshold);
            }
        } catch (err) {
            console.error(err);
            setSettingsError('שגיאה בטעינת הגדרות מערכת.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSettingsSuccess('');
        setSettingsError('');
        try {
            await updateSettings({ lowStockThreshold: threshold });
            setSettingsSuccess('הגדרות המערכת עודכנו בהצלחה!');
        } catch (err) {
            console.error(err);
            setSettingsError('שגיאה בעדכון הגדרות המערכת.');
        } finally {
            setSaving(false);
        }
    };

    const handleSendMessage = async (e) => {
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

    if (loading) {
        return <LoadingSpinner fullScreen />;
    }

    return (
        <div className="space-y-8 pb-20 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#2d3748]">הגדרות מערכת</h1>
                    <p className="text-[#a0aec0] text-sm mt-1">ניהול הגדרות כלליות והודעות קופצות</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

                {/* Inventory Settings Card */}
                <div className="bg-white rounded-[32px] p-8 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-[#526f52]/10 flex items-center justify-center text-[#526f52]">
                            <span className="material-symbols-outlined text-2xl">inventory_2</span>
                        </div>
                        <h2 className="text-xl font-bold text-[#2d3748]">הגדרות מלאי</h2>
                    </div>

                    <form onSubmit={handleSaveSettings} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">סף התראה למלאי נמוך</label>
                            <p className="text-xs text-gray-500 mb-4">הגדר מאיזו כמות המערכת תסמן שהמוצר עומד לאזל מהמלאי (תקף לכלל המוצרים).</p>
                            <input
                                type="number"
                                min="0"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-base focus:ring-2 focus:ring-[#526f52]/20 font-bold"
                                value={threshold}
                                onChange={(e) => setThreshold(e.target.value)}
                            />
                        </div>

                        {settingsSuccess && <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{settingsSuccess}</div>}
                        {settingsError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{settingsError}</div>}

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-[#526f52] hover:bg-[#435c43] disabled:opacity-50 text-white py-3.5 rounded-xl font-bold transition-colors"
                        >
                            {saving ? 'שומר...' : 'שמור הגדרות'}
                        </button>
                    </form>
                </div>

                {/* System Message Card */}
                <div className="bg-white rounded-[32px] p-8 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-[#526f52]/10 flex items-center justify-center text-[#526f52]">
                            <span className="material-symbols-outlined text-2xl">campaign</span>
                        </div>
                        <h2 className="text-xl font-bold text-[#2d3748]">הודעת מערכת גלובלית</h2>
                    </div>

                    <form onSubmit={handleSendMessage} className="space-y-5">
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

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">תוכן ההודעה *</label>
                            <textarea
                                required
                                rows="4"
                                placeholder="הזן את פרטי ההודעה כאן..."
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20 resize-none"
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                            ></textarea>
                        </div>

                        {messageSuccess && <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{messageSuccess}</div>}
                        {messageError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{messageError}</div>}

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full border-2 border-[#526f52] text-[#526f52] hover:bg-[#526f52] hover:text-white disabled:opacity-50 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">send</span>
                            <span>{saving ? 'שולח...' : 'שלח הודעה לכולם'}</span>
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default Settings;
