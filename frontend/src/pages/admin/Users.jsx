import { useState, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { createUser, updateUser, deleteUser } from '../../services/userService';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

function Users() {
    const { users, loading, error, fetchUsers } = useUserStore();
    const { user: currentUser } = useAuthStore();

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeUser, setActiveUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '', fullName: '', email: '', role: 'cashier', personalNumber: '', isActive: true
    });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('active'); // 'active', 'all'

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleOpenAdd = () => {
        setIsEditMode(false);
        setActiveUser(null);
        setFormData({ username: '', fullName: '', email: '', role: 'cashier', personalNumber: '', isActive: true });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user) => {
        setIsEditMode(true);
        setActiveUser(user);
        setFormData({
            username: user.username,
            fullName: user.fullName || '',
            email: user.email || '',
            role: user.role,
            personalNumber: user.personalNumber || '',
            isActive: user.isActive
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (id === currentUser?.id) {
            toast.error("לא ניתן למחוק את המשתמש המחובר");
            return;
        }
        if (window.confirm("האם אתה בטוח שברצונך למחוק משתמש זה?")) {
            try {
                await deleteUser(id);
                fetchUsers(true);
                toast.success("המשתמש נמחק בהצלחה");
            } catch (err) {
                toast.error("שגיאה במחיקת משתמש: " + (err.response?.data?.error || err.message));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const dataToSave = { ...formData };

            if (isEditMode) {
                if (activeUser.id === currentUser?.id && dataToSave.isActive === false) {
                    toast.error("לא ניתן להשעות את המשתמש המחובר");
                    return;
                }
                await updateUser(activeUser.id, dataToSave);
            } else {
                // Backend requires password, use personalNumber or username as default
                dataToSave.password = dataToSave.personalNumber || dataToSave.username;
                await createUser(dataToSave);
            }
            fetchUsers(true);
            setIsModalOpen(false);
            toast.success("נשמר בהצלחה");
        } catch (err) {
            toast.error("שגיאה בשמירה: " + (err.response?.data?.error || err.message));
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (u.personalNumber && u.personalNumber.includes(searchTerm));

        let matchesFilter = true;
        if (filterType === 'active') matchesFilter = u.isActive;
        // if 'all', matchesFilter remains true

        return matchesSearch && matchesFilter;
    });

    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin': return <span className="px-3 py-1 bg-purple-50 text-purple-600 border border-purple-100 rounded-full text-xs font-bold">מנהל מערכת</span>;
            case 'cashier': return <span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-xs font-bold">קופאי</span>;
            case 'officer': return <span className="px-3 py-1 bg-orange-50 text-orange-600 border border-orange-100 rounded-full text-xs font-bold">רס"פ / קצין מלאי </span>;
            default: return <span className="px-3 py-1 bg-gray-50 text-gray-600 border border-gray-100 rounded-full text-xs font-bold">לא ידוע</span>;
        }
    };

    const getStatusIndicator = (isActive) => {
        // Assuming backend returns isActive boolean, or status string. adjusting to boolean for now based on typical schema
        return isActive
            ? <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
            : <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>;
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#2d3748]">משתמשים והרשאות</h1>
                    <p className="text-[#a0aec0] text-sm mt-1">ניהול חשבונות משתמש והגדרות גישה</p>
                </div>
                <button onClick={handleOpenAdd} className="bg-[#526f52] hover:bg-[#435c43] text-white px-6 py-3 rounded-full shadow-[0_4px_14px_rgb(82,111,82,0.2)] hover:shadow-[0_6px_20px_rgb(82,111,82,0.3)] transition-all flex items-center gap-2 font-medium">
                    <span className="material-symbols-outlined">person_add</span>
                    <span>הוסף משתמש</span>
                </button>
            </div>

            {loading ? <LoadingSpinner fullScreen={false} /> : (
                <>
                    {/* Main Content Card */}
                    <div className="bg-white rounded-[32px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 overflow-hidden">
                        {/* Toolbar */}
                        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="relative w-full sm:w-72">
                                <input
                                    type="text"
                                    placeholder="חפש משתמש..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-4 pr-10 py-2.5 bg-[#f7fafc] border-none rounded-full text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                />
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
                                <button
                                    onClick={() => setFilterType('active')}
                                    className={`px-4 py-2 ${filterType === 'active' ? 'bg-[#526f52] text-white' : 'bg-white border border-gray-200 text-gray-500'} rounded-full text-xs font-bold whitespace-nowrap`}
                                >
                                    פעילים ({users.filter(u => u.isActive).length})
                                </button>
                                <button
                                    onClick={() => setFilterType('all')}
                                    className={`px-4 py-2 ${filterType === 'all' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-500'} rounded-full text-xs font-bold whitespace-nowrap`}
                                >
                                    כולם ({users.length})
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-[#f8f9f8] text-gray-500 text-xs uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 text-right rounded-tr-[32px]">משתמש</th>
                                        <th className="px-6 py-4 text-right">מספר אישי</th>
                                        <th className="px-6 py-4 text-right">תפקיד</th>
                                        <th className="px-6 py-4 text-right">אימייל</th>
                                        <th className="px-6 py-4 text-right">סטטוס</th>
                                        <th className="px-6 py-4 text-left rounded-tl-[32px]">פעולות</th>
                                    </tr>
                                </thead>
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-[#fcfdfc] transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-[#526f52]/10 text-[#526f52] flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-110 transition-transform duration-300">
                                                        {user.fullName ? user.fullName.charAt(0) : user.username.charAt(0)}
                                                    </div>
                                                    <div className="absolute bottom-0 right-0 border-2 border-white rounded-full">
                                                        {getStatusIndicator(user.isActive)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[#2d3748]">{user.fullName}</div>
                                                    <div className="text-[10px] text-gray-400">{user.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                                            {user.personalNumber || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getRoleBadge(user.role)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.email || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-xs font-bold ${user.isActive ? 'text-green-600' : 'text-red-400'}`}>
                                                {user.isActive ? 'פעיל' : 'לא פעיל'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-left">
                                            {user.id !== currentUser?.id && (
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleOpenEdit(user)} className="w-8 h-8 rounded-full bg-gray-50 hover:bg-[#526f52] hover:text-white flex items-center justify-center text-gray-400 transition-colors">
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button onClick={() => handleDelete(user.id)} className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-500 hover:text-white flex items-center justify-center text-red-300 transition-colors">
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            )}
                                            {user.id === currentUser?.id && (
                                                <span className="text-xs text-gray-400 italic">משתמש מחובר</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                                            לא נמצאו משתמשים
                                        </td>
                                    </tr>
                                )}
                            </table>
                        </div>

                        <div className="p-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                            <span>סה"כ {filteredUsers.length} משתמשים בתוצאות השאילתה</span>
                        </div>
                    </div>

                    {/* Modal for Add / Edit */}
                    {isModalOpen && (
                        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
                            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg relative z-10 overflow-hidden flex flex-col">
                                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h2 className="text-2xl font-bold text-[#2d3748]">{isEditMode ? 'עריכת משתמש' : 'משתמש חדש'}</h2>
                                    <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                                <div className="p-8">
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">שם משתמש *</label>
                                            <input
                                                type="text" required
                                                value={formData.username}
                                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                                disabled={isEditMode}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20 disabled:opacity-50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">שם מלא</label>
                                            <input
                                                type="text"
                                                value={formData.fullName}
                                                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">מספר אישי *</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.personalNumber}
                                                onChange={e => setFormData({ ...formData, personalNumber: e.target.value, email: e.target.value ? `${e.target.value}@idf.com` : '' })}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">דוא"ל</label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                disabled
                                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">תפקיד *</label>
                                                <select
                                                    value={formData.role}
                                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none text-sm focus:ring-2 focus:ring-[#526f52]/20"
                                                >
                                                    <option value="cashier">קופאי</option>
                                                    <option value="officer">רס"פ / קצין מלאי</option>
                                                    <option value="admin">מנהל מערכת</option>
                                                </select>
                                            </div>
                                        </div>

                                        <button type="submit" className="w-full bg-[#526f52] hover:bg-[#435c43] text-white py-4 rounded-xl font-bold text-lg shadow-lg mt-6">
                                            {isEditMode ? 'שמור שינויים' : 'צור משתמש'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default Users;
