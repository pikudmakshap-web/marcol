import React, { useState, useEffect } from 'react';
import { getActiveMessage, dismissMessage } from '../services/messageService';
import { socket } from '../services/socketService';

const GlobalNotification = () => {
    const [message, setMessage] = useState(null);
    const [dismissing, setDismissing] = useState(false);

    useEffect(() => {
        fetchMessage();

        // Optionally poll every 5 minutes to check for new messages
        const interval = setInterval(fetchMessage, 5 * 60 * 1000);

        // Listen for new messages pushed from the server
        const handleNewMessage = () => fetchMessage();
        socket.on('system_message_created', handleNewMessage);

        return () => {
            clearInterval(interval);
            socket.off('system_message_created', handleNewMessage);
        };
    }, []);

    const fetchMessage = async () => {
        try {
            const activeMsg = await getActiveMessage();
            setMessage(activeMsg);
        } catch (err) {
            console.error('Failed to fetch global message', err);
        }
    };

    const handleDismiss = async () => {
        if (!message) return;
        setDismissing(true);
        try {
            await dismissMessage(message.id);
            setMessage(null);
        } catch (err) {
            console.error('Failed to dismiss message', err);
        } finally {
            setDismissing(false);
        }
    };

    if (!message) return null;

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full transform transition-all border border-gray-100">
                <div className="bg-[#526f52] p-6 text-white flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-3xl">campaign</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{message.title}</h2>
                        <p className="text-white/80 text-sm mt-1">הודעת מערכת חשובה</p>
                    </div>
                </div>

                <div className="p-8">
                    <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap font-medium">
                        {message.content}
                    </p>
                </div>

                <div className="bg-gray-50 px-8 py-5 text-left border-t border-gray-100">
                    <button
                        onClick={handleDismiss}
                        disabled={dismissing}
                        className="bg-[#526f52] hover:bg-[#435c43] text-white px-8 py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
                    >
                        {dismissing ? 'מעדכן...' : 'קראתי והבנתי'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalNotification;
