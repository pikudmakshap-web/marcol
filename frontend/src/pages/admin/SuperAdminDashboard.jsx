import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Layers,
  Users,
  Settings,
  Activity,
  Search,
  Plus,
  MoreVertical,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  LogOut,
  ChevronRight,
  Eye,
  Power,
  Trash2,
  ArrowUpRight,
  UserCog,
  Wallet,
  CreditCard,
  Package,
  ShoppingCart,
  Clock,
  ArrowLeft
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

// --- MAIN APP COMPONENT ---
export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { user: currentUser, switchEnvironment, refreshUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [environments, setEnvironments] = useState([]);
  const [selectedEnv, setSelectedEnv] = useState(null);
  const [envStats, setEnvStats] = useState(null);
  const [fetchingStats, setFetchingStats] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [superAdmins, setSuperAdmins] = useState([]);
  const [loadingSuperAdmins, setLoadingSuperAdmins] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [showManageEnvUsersModal, setShowManageEnvUsersModal] = useState(false);
  const [envUserMode, setEnvUserMode] = useState('assign');
  const [savingEnvUser, setSavingEnvUser] = useState(false);
  const [newEnvUserPersonalNumber, setNewEnvUserPersonalNumber] = useState('');
  const [manageTargetEnvId, setManageTargetEnvId] = useState('');
  const [assignMode, setAssignMode] = useState('keep');
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [savingUserUpdate, setSavingUserUpdate] = useState(false);
  const [editingEnvId, setEditingEnvId] = useState(null);
  const [editingEnvName, setEditingEnvName] = useState('');
  const [savingEnvName, setSavingEnvName] = useState(false);
  const [userEnvAssignments, setUserEnvAssignments] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [newUserEnvAssignment, setNewUserEnvAssignment] = useState({
    environmentId: '',
    role: 'cashier'
  });
  const [userEditForm, setUserEditForm] = useState({
    fullName: '',
    username: '',
    personalNumber: '',
    email: '',
    isActive: true
  });

  const paymentTypeLabel = (type) => {
    switch (String(type || '').toLowerCase()) {
      case 'sale':
        return 'מכירה';
      case 'return':
        return 'החזרה';
      case 'deposit':
        return 'הפקדה';
      case 'withdrawal':
        return 'משיכה';
      default:
        return type || '-';
    }
  };

  const canEditEnvironmentName = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isSuperAdmin = currentUser?.role === 'superadmin';
  const countEmojiSymbols = (value) => {
    if (!value || typeof value !== 'string') return 0;
    const matches = value.match(/\p{Extended_Pictographic}/gu);
    return matches ? matches.length : 0;
  };

  const paymentTypeClass = (type) => {
    switch (String(type || '').toLowerCase()) {
      case 'sale':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'return':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'deposit':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'withdrawal':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const roleLabel = (role) => {
    if (role === 'admin') return 'מנהל מערכת';
    if (role === 'officer') return 'קצין ניהול';
    return 'קופאי';
  };

  const fetchEnvironments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/environments');
      setEnvironments(res.data);
    } catch (err) {
      toast.error('שגיאה בטעינת הסביבות');
    } finally {
      setLoading(false);
    }
  };

  const fetchEnvStats = async (envId) => {
    setFetchingStats(true);
    try {
      const res = await api.get(`/environments/${envId}/stats`);
      console.log(res.data);

      setEnvStats(res.data);
    } catch (err) {
      console.error('Failed to fetch env stats:', err);
      toast.error('שגיאה בטעינת נתוני הסביבה');
    } finally {
      setFetchingStats(false);
    }
  };

  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/environments/users/all');
      setAllUsers(res.data);
    } catch (err) {
      toast.error('שגיאה בטעינת משתמשים');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchSuperAdmins = async () => {
    setLoadingSuperAdmins(true);
    try {
      const res = await api.get('/environments/superadmins');
      setSuperAdmins(res.data);
    } catch (err) {
      toast.error('שגיאה בטעינת מנהלי על');
    } finally {
      setLoadingSuperAdmins(false);
    }
  };

  const handleCreateSuperAdmin = async (e) => {
    e.preventDefault();
    setSavingAdmin(true);
    const fd = new FormData(e.target);
    try {
      await api.post('/environments/superadmins', {
        username: fd.get('username'),
        password: fd.get('password'),
        fullName: fd.get('fullName'),
        personalNumber: fd.get('personalNumber') || undefined
      });
      toast.success('מנהל על נוצר בהצלחה');
      setShowAddAdminModal(false);
      fetchSuperAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'שגיאה ביצירת מנהל על');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteSuperAdmin = async (id) => {
    if (!window.confirm('בטוח שברצונך למחוק מנהל על זה?')) return;
    try {
      await api.delete(`/environments/superadmins/${id}`);
      toast.success('מנהל על הוסר');
      fetchSuperAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'שגיאה במחיקת מנהל על');
    }
  };

  useEffect(() => {
    fetchEnvironments();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchAllUsers();
    if (activeTab === 'admins') fetchSuperAdmins();
  }, [activeTab]);

  useEffect(() => {
    if (selectedEnv) {
      fetchEnvStats(selectedEnv.id);
    } else {
      setEnvStats(null);
    }
  }, [selectedEnv]);

  const handleCreateEnvironment = async (e) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.target);
    try {
      await api.post('/environments', {
        name: formData.get('name'),
        description: formData.get('description') || ''
      });
      toast.success('סביבה חדשה נוצרה בהצלחה');
      setShowCreateModal(false);
      fetchEnvironments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'שגיאה ביצירת הסביבה');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenManageEnvUsers = async () => {
    if (!allUsers.length) {
      await fetchAllUsers();
    }
    setEnvUserMode('assign');
    setAssignMode('keep');
    setManageTargetEnvId(selectedEnv?.id || environments?.[0]?.id || '');
    setNewEnvUserPersonalNumber('');
    setShowManageEnvUsersModal(true);
  };

  const handleAddEnvUser = async (e) => {
    e.preventDefault();
    const targetEnvironmentId = manageTargetEnvId || selectedEnv?.id;
    if (!targetEnvironmentId) {
      toast.error('יש לבחור סביבה');
      return;
    }

    setSavingEnvUser(true);
    const fd = new FormData(e.target);
    try {
      if (envUserMode === 'assign') {
        const userId = fd.get('userId');
        const role = fd.get('role') || 'cashier';
        const assignmentMode = fd.get('assignmentMode') || 'keep';
        if (!userId) {
          toast.error('יש לבחור משתמש קיים');
          return;
        }
        await api.post(`/environments/${targetEnvironmentId}/users`, {
          userId,
          role,
          assignmentMode
        });
      } else {
        const personalNumber = (fd.get('personalNumber') || '').trim();
        const email = personalNumber ? `${personalNumber}@idf.com` : undefined;
        await api.post(`/environments/${targetEnvironmentId}/users`, {
          username: fd.get('username'),
          password: fd.get('password'),
          fullName: fd.get('fullName'),
          personalNumber: personalNumber || undefined,
          email,
          role: fd.get('role') || 'cashier'
        });
      }

      toast.success('המשתמש נוסף לסביבה בהצלחה');
      setShowManageEnvUsersModal(false);
      setNewEnvUserPersonalNumber('');
      if (selectedEnv) fetchEnvStats(selectedEnv.id);
      fetchEnvironments();
      fetchAllUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'שגיאה בהוספת משתמש לסביבה');
    } finally {
      setSavingEnvUser(false);
    }
  };

  const handleOpenEditUser = (user) => {
    setEditingUser(user);
    setUserEnvAssignments((user.environments || []).map((env) => ({
      environmentId: env.id,
      environmentName: env.name,
      role: env.role
    })));
    setNewUserEnvAssignment({
      environmentId: environments?.[0]?.id || '',
      role: 'cashier'
    });
    setUserEditForm({
      fullName: user.fullName || '',
      username: user.username || '',
      personalNumber: user.personalNumber || '',
      email: user.personalNumber ? `${user.personalNumber}@idf.com` : (user.email || ''),
      isActive: Boolean(user.isActive)
    });
    setShowEditUserModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setSavingUserUpdate(true);
    try {
      await api.put(`/users/${editingUser.id}`, {
        fullName: userEditForm.fullName,
        username: userEditForm.username,
        personalNumber: userEditForm.personalNumber || undefined,
        email: userEditForm.email || undefined,
        isActive: userEditForm.isActive
      });
      toast.success('המשתמש עודכן בהצלחה');
      setShowEditUserModal(false);
      setEditingUser(null);
      fetchAllUsers();
      if (selectedEnv) fetchEnvStats(selectedEnv.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'שגיאה בעדכון משתמש');
    } finally {
      setSavingUserUpdate(false);
    }
  };

  const handleAddUserAssignment = async () => {
    if (!editingUser) return;
    const envId = newUserEnvAssignment.environmentId;
    const role = newUserEnvAssignment.role || 'cashier';

    if (!envId) {
      toast.error('יש לבחור סביבה');
      return;
    }

    if (userEnvAssignments.some((assignment) => assignment.environmentId === envId)) {
      toast.error('המשתמש כבר משויך לסביבה זו');
      return;
    }

    setSavingAssignments(true);
    try {
      await api.post(`/environments/${envId}/users`, {
        userId: editingUser.id,
        role,
        assignmentMode: 'keep'
      });

      const env = environments.find((item) => item.id === envId);
      setUserEnvAssignments((prev) => ([...prev, {
        environmentId: envId,
        environmentName: env?.name || envId,
        role
      }]));
      setNewUserEnvAssignment({
        environmentId: environments?.[0]?.id || '',
        role: 'cashier'
      });
      fetchAllUsers();
      toast.success('שיוך הסביבה נוסף בהצלחה');
    } catch (err) {
      toast.error(err.response?.data?.error || 'שגיאה בהוספת שיוך סביבה');
    } finally {
      setSavingAssignments(false);
    }
  };

  const handleUpdateUserAssignment = async (currentEnvironmentId, updates) => {
    if (!editingUser) return;
    const nextEnvironmentId = updates.environmentId || currentEnvironmentId;
    const nextRole = updates.role || 'cashier';

    if (!nextEnvironmentId) {
      toast.error('יש לבחור סביבה');
      return;
    }

    const duplicateEnvironment = userEnvAssignments.some((assignment) =>
      assignment.environmentId === nextEnvironmentId && assignment.environmentId !== currentEnvironmentId
    );
    if (duplicateEnvironment) {
      toast.error('המשתמש כבר משויך לסביבה שנבחרה');
      return;
    }

    setSavingAssignments(true);
    try {
      await api.post(`/environments/${nextEnvironmentId}/users`, {
        userId: editingUser.id,
        role: nextRole,
        assignmentMode: 'keep'
      });

      if (nextEnvironmentId !== currentEnvironmentId) {
        await api.delete(`/environments/${currentEnvironmentId}/users/${editingUser.id}`);
      }

      const env = environments.find((item) => item.id === nextEnvironmentId);
      setUserEnvAssignments((prev) => prev.map((assignment) => (
        assignment.environmentId === currentEnvironmentId
          ? {
            environmentId: nextEnvironmentId,
            environmentName: env?.name || nextEnvironmentId,
            role: nextRole
          }
          : assignment
      )));
      fetchAllUsers();
      toast.success('שיוך הסביבה עודכן');
    } catch (err) {
      toast.error(err.response?.data?.error || 'שגיאה בעדכון שיוך');
    } finally {
      setSavingAssignments(false);
    }
  };

  const handleDeleteUserAssignment = async (environmentId) => {
    if (!editingUser) return;

    if (!window.confirm('להסיר את שיוך המשתמש מסביבה זו?')) return;

    setSavingAssignments(true);
    try {
      await api.delete(`/environments/${environmentId}/users/${editingUser.id}`);
      setUserEnvAssignments((prev) => prev.filter((assignment) => assignment.environmentId !== environmentId));
      fetchAllUsers();
      toast.success('שיוך הסביבה הוסר');
    } catch (err) {
      toast.error(err.response?.data?.error || 'שגיאה בהסרת שיוך');
    } finally {
      setSavingAssignments(false);
    }
  };

  const beginEnvironmentNameEdit = (env) => {
    if (!canEditEnvironmentName) return;
    if (currentUser?.role === 'admin' && currentUser?.environmentId !== env.id) {
      toast.error('מנהל מערכת יכול לערוך רק את הסביבה הפעילה שלו');
      return;
    }
    setEditingEnvId(env.id);
    setEditingEnvName(env.name || '');
  };

  const cancelEnvironmentNameEdit = () => {
    setEditingEnvId(null);
    setEditingEnvName('');
  };

  const saveEnvironmentName = async (env) => {
    if (!editingEnvId || editingEnvId !== env.id) return;
    const nextName = String(editingEnvName || '').trim();

    if (!nextName) {
      toast.error('שם סביבה הוא שדה חובה');
      return;
    }

    if (countEmojiSymbols(nextName) > 4) {
      toast.error('ניתן להוסיף עד 4 סמלים בשם הסביבה');
      return;
    }

    if (nextName === env.name) {
      cancelEnvironmentNameEdit();
      return;
    }

    setSavingEnvName(true);
    try {
      const res = await api.put(`/environments/${env.id}/display-name`, { name: nextName });
      const updatedEnvironment = res.data;

      setEnvironments((prev) => prev.map((item) => (
        item.id === env.id
          ? { ...item, name: updatedEnvironment.name }
          : item
      )));

      setSelectedEnv((prev) => (prev?.id === env.id ? { ...prev, name: updatedEnvironment.name } : prev));
      await refreshUser();
      toast.success('שם הסביבה עודכן בהצלחה');
      cancelEnvironmentNameEdit();
    } catch (err) {
      toast.error(err.response?.data?.error || 'שגיאה בעדכון שם הסביבה');
    } finally {
      setSavingEnvName(false);
    }
  };

  // --- RENDERERS ---

  const renderDashboard = () => {
    const totalEnvs = environments.length;
    const activeEnvs = environments.filter(e => e.isActive !== false).length;
    const totalUsers = environments.reduce((acc, env) => acc + (env._count?.users || 0), 0);
    const totalRevenue = environments.reduce((acc, env) => acc + (env.revenue || 0), 0);

    return (
      <div className="space-y-6 h-full flex flex-col" data-tour="superadmin-overview">
        <div className="flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-bold text-slate-800">מבט על - כל הסביבות</h2>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <StatCard title="סביבות פעילות" value={`${activeEnvs} / ${totalEnvs}`} icon={<Layers />} color="text-blue-500" bg="bg-blue-50" />
          <StatCard title="סה״כ משתמשים" value={totalUsers.toLocaleString()} icon={<Users />} color="text-green-500" bg="bg-green-50" />
          <StatCard title="סה״כ הכנסות (₪)" value={totalRevenue.toLocaleString()} icon={<Activity />} color="text-orange-500" bg="bg-orange-50" />
          <StatCard title="התראות מערכת" value="0" icon={<ShieldAlert />} color="text-red-500" bg="bg-red-50" />
        </div>

        {/* Charts area - each panel scrolls internally */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          <div className="lg:col-span-2 bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-100 flex flex-col min-h-0">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-r-4 border-green-500 pr-3 shrink-0">פעילות כללית (30 ימים אחרונים)</h3>
            <div className="flex-1 w-full bg-slate-50 rounded-xl flex items-center justify-center border border-dashed border-slate-200 overflow-y-auto custom-scrollbar">
              <span className="text-slate-400">גרף פעילות יוצג כאן</span>
            </div>
          </div>
          <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-100 flex flex-col min-h-0">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-r-4 border-orange-500 pr-3 shrink-0">סביבות מניבות ביותר</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
              {environments.sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).map(env => (
                <div key={env.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl cursor-pointer" onClick={() => { setSelectedEnv(env); setActiveTab('env-detail'); }}>
                  <div>
                    <div className="font-medium text-slate-800">{env.name}</div>
                    <div className="text-xs text-slate-500">{env._count?.transactions || 0} הזמנות</div>
                  </div>
                  <div className="font-semibold text-green-600">₪{(env.revenue || 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEnvironments = () => (
    <div className="space-y-6 overflow-y-auto h-[calc(100vh-200px)] pr-2 custom-scrollbar" data-tour="superadmin-env-list">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">ניהול סביבות וחנויות</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="חפש סביבה..."
              className="pl-4 pr-10 py-2 rounded-full border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 w-64"
            />
            <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 shadow-sm transition-all font-bold"
          >
            <Plus size={18} />
            <span>סביבה חדשה</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-50 text-slate-500 text-sm">
            <tr>
              <th className="py-4 px-6 font-medium text-right">שם סביבה</th>
              <th className="py-4 px-6 font-medium text-right">סטטוס</th>
              <th className="py-4 px-6 font-medium text-right">משתמשים</th>
              <th className="py-4 px-6 font-medium text-right">מוצרים</th>
              <th className="py-4 px-6 font-medium text-right">הכנסות</th>
              <th className="py-4 px-6 font-medium text-right">תאריך יצירה</th>
              <th className="py-4 px-6 font-medium text-center">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {environments.map(env => (
              <tr
                key={env.id}
                onClick={(e) => {
                  if (e.target.closest('[data-inline-env-edit="true"]')) return;
                  setSelectedEnv(env);
                  setActiveTab('env-detail');
                }}
                className="hover:bg-slate-50/50 transition-colors cursor-pointer"
              >
                <td className="py-4 px-6" data-inline-env-edit="true" onClick={(e) => e.stopPropagation()}>
                  {editingEnvId === env.id ? (
                    <input
                      value={editingEnvName}
                      autoFocus
                      disabled={savingEnvName}
                      onChange={(e) => setEditingEnvName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => saveEnvironmentName(env)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEnvironmentName(env);
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEnvironmentNameEdit();
                        }
                      }}
                      className="font-medium text-slate-800 w-full max-w-[260px] border border-green-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div
                        className={`font-medium text-slate-800 ${canEditEnvironmentName ? 'cursor-text' : ''}`}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          beginEnvironmentNameEdit(env);
                        }}
                        title={canEditEnvironmentName ? 'לחיצה כפולה לעריכת שם הסביבה (עד 4 סמלים)' : undefined}
                      >
                        {env.name}
                      </div>
                      {canEditEnvironmentName && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            beginEnvironmentNameEdit(env);
                          }}
                          className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 flex items-center justify-center"
                          title="עריכת שם סביבה"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 font-mono mt-1">{env.description || 'ללא תיאור'}</div>
                </td>
                <td className="py-4 px-6">
                  <StatusBadge status={env.isActive !== false ? 'active' : 'inactive'} />
                </td>
                <td className="py-4 px-6 text-slate-600">{env._count?.users || 0}</td>
                <td className="py-4 px-6 text-slate-600">{env._count?.products || 0}</td>
                <td className="py-4 px-6 text-slate-600 font-medium">₪{(env.revenue || 0).toLocaleString()}</td>
                <td className="py-4 px-6 text-slate-500">{new Date(env.createdAt).toLocaleDateString('he-IL')}</td>
                <td className="py-4 px-6 text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedEnv(env); setActiveTab('env-detail'); }}
                    className="text-slate-400 hover:text-green-500 p-2 rounded-full hover:bg-green-50 transition-colors"
                    title="צפה בפרטים"
                  >
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderEnvironmentDetail = () => {
    if (!selectedEnv) return null;
    const stats = envStats || { walletBalance: 0, walletCount: 0, recentTransactions: [], usersList: [], productsList: [], walletsList: [] };

    return (
      <div className="space-y-6 h-full flex flex-col relative" data-tour="superadmin-env-detail">
        {fetchingStats && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-[1.5rem]">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500 font-medium">טוען נתונים...</p>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center gap-4 mb-2" data-tour="superadmin-env-header">
          <button
            onClick={() => { setActiveTab('environments'); setSelectedEnv(null); }}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-white shadow-sm"
          >
            <ChevronRight size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              {selectedEnv.name}
              <StatusBadge status={selectedEnv.isActive !== false ? 'active' : 'inactive'} />
              <span className="text-slate-500 text-sm font-mono mt-1">ID: {selectedEnv.id}</span>
            </h2>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  await switchEnvironment(selectedEnv.id);
                  toast.success('הסביבה הופעלה. מעביר ללוח הניהול...');
                  window.location.href = '/admin/dashboard';
                } catch (err) {
                  toast.error(err.response?.data?.error || 'שגיאה במעבר לסביבה');
                }
              }}
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 shadow-sm transition-all font-bold text-sm"
            >
              <ArrowUpRight size={16} />
              <span>פתח סביבה לניהול</span>
            </button>
          </div>
        </div>

        {/* Stats Grid - Environment Specific */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="superadmin-env-stats">
          <StatCard title="סכום כסף בארנקים" value={`₪${stats.walletBalance.toLocaleString()}`} icon={<Wallet />} color="text-green-600" bg="bg-green-100" />
          <StatCard title="כלל הארנקים בסביבה" value={stats.walletCount.toLocaleString()} icon={<CreditCard />} color="text-blue-500" bg="bg-blue-50" />
          <StatCard title="משתמשים רשומים" value={(stats.usersList?.length || selectedEnv._count?.users || 0).toLocaleString()} icon={<Users />} color="text-purple-500" bg="bg-purple-50" />
          <StatCard title="מוצרים פעילים" value={(stats.productsList?.length || selectedEnv._count?.products || 0).toLocaleString()} icon={<Package />} color="text-orange-500" bg="bg-orange-50" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 min-h-0" data-tour="superadmin-env-panels">

          {/* POS Recent Uses Table */}
          <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 flex flex-col min-h-0" data-tour="superadmin-pos-usage">
            <div className="flex items-center gap-2 mb-3 border-r-4 border-blue-500 pr-3 shrink-0">
              <ShoppingCart className="text-blue-500" size={20} />
              <h3 className="text-lg font-semibold text-slate-800">שימושים בקופה</h3>
            </div>

            {stats.recentTransactions && stats.recentTransactions.length > 0 ? (
              <div className="flex-1 overflow-auto custom-scrollbar rounded-xl border border-slate-100">
                <table className="min-w-full text-right text-sm table-fixed">
                  <thead className="text-slate-500 bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-3 font-semibold text-right w-[32%]">משתמש</th>
                      <th className="py-3 px-3 font-semibold text-right w-[24%]">סוג תשלום</th>
                      <th className="py-3 px-3 font-semibold text-right w-[26%]">זמן</th>
                      <th className="py-3 px-3 font-semibold text-right w-[18%]">סכום</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {stats.recentTransactions.map(pos => (
                      <tr key={pos.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 text-slate-800 font-medium truncate">{pos.user || 'מערכת'}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${paymentTypeClass(pos.type)}`}>
                            {paymentTypeLabel(pos.type)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-xs">
                          <div className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Clock size={12} />
                            <span>{pos.time}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">{pos.date}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">₪{Number(pos.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-4">אין נתונים להצגה</p>
            )}
          </div>
          {/* Users List */}
          <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 flex flex-col min-h-0" data-tour="superadmin-users-panel">
            <div className="flex justify-between items-center mb-3 border-r-4 border-purple-500 pr-3 shrink-0">
              <h3 className="text-lg font-semibold text-slate-800">כל המשתמשים בסביבה</h3>
              <span className="text-xs text-purple-500 bg-purple-50 px-2 py-1 rounded-full">{stats.usersList?.length || 0}</span>
            </div>
            {stats.usersList && stats.usersList.length > 0 ? (
              <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pl-2">
                {stats.usersList.map(u => (
                  <div key={u.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl">
                    <div>
                      <div className="font-medium text-slate-800 text-right">{u.name}</div>
                      <div className="text-xs text-slate-500 text-right">{u.email || u.username}</div>
                    </div>
                    <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-600">{u.role}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-4">אין נתונים להצגה</p>
            )}
          </div>

          {/* Products List */}
          <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 flex flex-col min-h-0" data-tour="superadmin-products-panel">
            <div className="flex justify-between items-center mb-3 border-r-4 border-orange-500 pr-3 shrink-0">
              <h3 className="text-lg font-semibold text-slate-800">כל המוצרים בסביבה</h3>
              <span className="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded-full">{stats.productsList?.length || 0}</span>
            </div>
            {stats.productsList && stats.productsList.length > 0 ? (
              <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pl-2">
                {stats.productsList.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      {(p.image || p.imageUrl || p.thumbnail) ? (
                        <img
                          src={p.image || p.imageUrl || p.thumbnail}
                          alt={p.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg border border-slate-200 bg-white text-slate-400 flex items-center justify-center shrink-0">
                          <Package size={16} />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-slate-800 text-right">{p.name}</div>
                        <div className="text-xs text-slate-500 text-right">מלאי: {p.stock} יח'</div>
                      </div>
                    </div>
                    <span className="font-semibold text-slate-800">₪{p.price}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-4">אין נתונים להצגה</p>
            )}
          </div>

          {/* Wallets List */}
          <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 flex flex-col min-h-0" data-tour="superadmin-wallets-panel">
            <div className="flex justify-between items-center mb-3 border-r-4 border-green-500 pr-3 shrink-0">
              <h3 className="text-lg font-semibold text-slate-800">כל הארנקים בסביבה</h3>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">{stats.walletsList?.length || 0}</span>
            </div>
            {stats.walletsList && stats.walletsList.length > 0 ? (
              <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pl-2">
                {stats.walletsList.map(w => (
                  <div key={w.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl">
                    <div>
                      <div className="font-medium text-slate-800 text-right">{w.user}</div>
                      <div className="text-xs text-slate-500 text-right">סטטוס: {w.status}</div>
                    </div>
                    <span className="font-semibold text-green-600">₪{w.balance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-4">אין נתונים להצגה</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAllUsers = () => {
    const filtered = allUsers.filter(u =>
      (u.fullName || '').includes(userSearchTerm) ||
      (u.username || '').includes(userSearchTerm) ||
      (u.personalNumber || '').includes(userSearchTerm)
    );
    return (
      <div className="h-full flex flex-col space-y-4">
        <div className="flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-bold text-slate-800">כלל משתמשי המערכת</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenManageEnvUsers}
              className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded-full hover:bg-purple-600 shadow-sm transition-all font-bold text-sm"
            >
              <Users size={16} />
              <span>ניהול משתמשים </span>
            </button>
            <div className="relative">
              <input type="text" placeholder="חיפוש משתמש..." value={userSearchTerm}
                onChange={e => setUserSearchTerm(e.target.value)}
                className="pl-4 pr-10 py-2 rounded-full border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 w-64" />
              <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
            </div>
          </div>
        </div>
        <div className="flex-1 bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-0">
          <div className="overflow-x-auto shrink-0">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-sm">
                <tr>
                  <th className="py-4 px-6 font-medium text-right">שם מלא</th>
                  <th className="py-4 px-6 font-medium text-right">שם משתמש</th>
                  <th className="py-4 px-6 font-medium text-right">מספר אישי</th>
                  <th className="py-4 px-6 font-medium text-right">סביבות משויכות</th>
                  <th className="py-4 px-6 font-medium text-right">סטטוס</th>
                </tr>
              </thead>
            </table>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingUsers ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <table className="w-full text-right">
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(u => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => handleOpenEditUser(u)}
                    >
                      <td className="py-4 px-6 font-medium text-slate-800">{u.fullName}</td>
                      <td className="py-4 px-6 text-slate-500 font-mono text-sm">{u.username}</td>
                      <td className="py-4 px-6 text-slate-500">{u.personalNumber || '-'}</td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1">
                          {(u.environments || []).length > 0 ? (u.environments || []).map(env => (
                            <span key={env.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{env.name} ({env.role})</span>
                          )) : <span className="text-xs text-slate-400">לא משויך</span>}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {u.isActive ? 'פעיל' : 'לא פעיל'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAdmins = () => (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center shrink-0">
        <h2 className="text-2xl font-bold text-slate-800">ניהול מנהלי על</h2>
        <button onClick={() => setShowAddAdminModal(true)}
          className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 shadow-sm transition-all font-bold">
          <Plus size={18} /><span>מנהל על חדש</span>
        </button>
      </div>
      <div className="flex-1 bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-0">
        <table className="w-full text-right shrink-0">
          <thead className="bg-slate-50 text-slate-500 text-sm">
            <tr>
              <th className="py-4 px-6 font-medium text-right">שם מלא</th>
              <th className="py-4 px-6 font-medium text-right">שם משתמש</th>
              <th className="py-4 px-6 font-medium text-right">סטטוס</th>
              <th className="py-4 px-6 font-medium text-right">תאריך יצירה</th>
              <th className="py-4 px-6 font-medium text-center">פעולות</th>
            </tr>
          </thead>
        </table>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loadingSuperAdmins ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <table className="w-full text-right">
              <tbody className="divide-y divide-slate-100">
                {superAdmins.map(admin => (
                  <tr key={admin.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-medium text-slate-800">{admin.fullName}</td>
                    <td className="py-4 px-6 text-slate-500 font-mono text-sm">{admin.username}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${admin.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {admin.isActive ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500 text-sm">{new Date(admin.createdAt).toLocaleDateString('he-IL')}</td>
                    <td className="py-4 px-6 text-center">
                      <button onClick={() => handleDeleteSuperAdmin(admin.id)}
                        className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors" title="מחק">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-xl animate-in zoom-in-95 duration-200" dir="rtl">
            <div className="flex justify-between items-center mb-6 px-8 pt-8">
              <h3 className="text-xl font-bold text-slate-800">הוספת מנהל על חדש</h3>
              <button onClick={() => setShowAddAdminModal(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-2"><XCircle size={20} /></button>
            </div>
            <form onSubmit={handleCreateSuperAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 mr-2">שם מלא *</label>
                <input required name="fullName" type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="שם מלא" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 mr-2">שם משתמש *</label>
                <input required name="username" type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="שם משתמש" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 mr-2">סיסמה *</label>
                <input required name="password" type="password" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="סיסמה" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 mr-2">מספר אישי</label>
                <input name="personalNumber" type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="אופציונלי" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAddAdminModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-colors">ביטול</button>
                <button type="submit" disabled={savingAdmin} className="flex-1 py-3 rounded-xl bg-green-500 text-white hover:bg-green-600 font-bold transition-colors shadow-sm disabled:opacity-50">
                  {savingAdmin ? 'יוצר...' : 'צור מנהל על'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // --- MAIN LAYOUT ---
  return (
    <div className="h-full flex font-sans" dir="rtl">

      {/* Floating Right Sidebar Integration */}
      <aside className="w-20 md:w-64 bg-white/80 backdrop-blur-md rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center md:items-stretch py-6 h-full z-20">
        <div className="px-4 mb-8 text-center md:text-right hidden md:block">
          <div className="font-black text-xl text-slate-800 tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-green-500" />
            Marcol
          </div>
          <div className="text-xs text-slate-500 mt-1">מרכול | אנליטיקס</div>
        </div>

        {/* Mobile Logo */}
        <div className="mb-8 md:hidden text-green-500">
          <ShieldAlert size={28} />
        </div>

        <nav className="flex-1 flex flex-col gap-2 px-2 md:px-4">
          <NavItem icon={<LayoutDashboard />} label="לוח בקרה" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Layers />} label="סביבות וחנויות" isActive={activeTab === 'environments' || activeTab === 'env-detail'} onClick={() => { setActiveTab('environments'); setSelectedEnv(null); }} />
          {isSuperAdmin && <NavItem icon={<Users />} label="כלל המשתמשים" isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} />}
          {isSuperAdmin && <NavItem icon={<UserCog />} label="מנהלי על" isActive={activeTab === 'admins'} onClick={() => setActiveTab('admins')} />}

          <div className="mt-4 pt-4 border-t border-slate-100/50">
            <NavItem
              icon={<ArrowLeft className="text-orange-500" />}
              label="חזרה לסביבה"
              isActive={false}
              onClick={() => navigate('/admin/dashboard')}
            />
          </div>
        </nav>

        {/* User Profile Footer */}
        <div className="mt-auto px-4 pb-2 text-center md:text-right flex flex-col items-center md:flex-row md:justify-start gap-3 pt-6 border-t border-slate-100 mx-4">
          <div className="relative">
            <img src={`https://ui-avatars.com/api/?name=${currentUser?.fullName || 'Admin'}&background=1e293b&color=fff`} alt="Admin" className="w-10 h-10 rounded-full" />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-bold text-slate-800">{currentUser?.fullName || 'מנהל'}</div>
            <div className="text-xs text-slate-500">מנהל על</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 px-4 md:px-8 flex flex-col h-full overflow-hidden">

        {/* Top Header */}
        <header className="bg-white rounded-full px-6 py-3 shadow-sm border border-slate-100 flex justify-between items-center mb-8 mt-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-2 rounded-xl text-slate-600">
              <Layers size={20} />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-800">מערכת ניהול על</h1>
              <p className="text-xs text-slate-500">כל הסביבות</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full font-medium flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              רמת הרשאה מקסימלית
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'environments' && renderEnvironments()}
            {activeTab === 'env-detail' && renderEnvironmentDetail()}
            {activeTab === 'users' && renderAllUsers()}
            {activeTab === 'admins' && renderAdmins()}
          </div>
        </div>
      </div>

      {/* Modals & Toasts */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-xl animate-in zoom-in-95 duration-200" dir="rtl">
            <div className="flex justify-between items-center mb-6 px-8 pt-8">
              <h3 className="text-xl font-bold text-slate-800">יצירת סביבה חדשה</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-2">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateEnvironment} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 mr-2">שם הסביבה (חנות/חברה) *</label>
                <input required name="name" type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="לדוגמה: חנות רמת גן" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 mr-2">תיאור קצר</label>
                <textarea name="description" rows="3" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:outline-none" placeholder="תאר את הסביבה..." />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-colors">ביטול</button>
                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-green-500 text-white hover:bg-green-600 font-bold transition-colors shadow-sm disabled:opacity-50">
                  {saving ? 'יוצר...' : 'צור סביבה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-3xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
            <div className="flex justify-between items-center mb-6 px-8 pt-8">
              <h3 className="text-xl font-bold text-slate-800">עדכון משתמש</h3>
              <button onClick={() => setShowEditUserModal(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-2">
                <XCircle size={20} />
              </button>
            </div>
            <div className="px-8 pb-8 overflow-y-auto custom-scrollbar flex-1 min-h-0">
              <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">שם מלא</label>
                  <input
                    value={userEditForm.fullName}
                    onChange={(e) => setUserEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">שם משתמש</label>
                  <input
                    value={userEditForm.username}
                    onChange={(e) => setUserEditForm(prev => ({ ...prev, username: e.target.value }))}
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">מספר אישי</label>
                  <input
                    value={userEditForm.personalNumber}
                    onChange={(e) => {
                      const personalNumber = e.target.value;
                      setUserEditForm(prev => ({
                        ...prev,
                        personalNumber,
                        email: personalNumber ? `${personalNumber}@idf.com` : ''
                      }));
                    }}
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">אימייל</label>
                  <input
                    value={userEditForm.email}
                    type="email"
                    readOnly
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 focus:outline-none"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={userEditForm.isActive}
                  onChange={(e) => setUserEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                />
                משתמש פעיל
              </label>
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-700">שיוכי סביבה והרשאה</h4>
                  {savingAssignments && <span className="text-xs text-slate-500">מעדכן שיוכים...</span>}
                </div>

                <div className="space-y-2">
                  {userEnvAssignments.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      המשתמש לא משויך כרגע לאף סביבה.
                    </div>
                  ) : userEnvAssignments.map((assignment) => (
                    <div key={assignment.environmentId} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">סביבה</label>
                          <select
                            value={assignment.environmentId}
                            onChange={(e) => handleUpdateUserAssignment(assignment.environmentId, {
                              environmentId: e.target.value,
                              role: assignment.role
                            })}
                            disabled={savingAssignments}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                          >
                            {environments.map((env) => (
                              <option key={env.id} value={env.id}>{env.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">הרשאה</label>
                          <select
                            value={assignment.role}
                            onChange={(e) => handleUpdateUserAssignment(assignment.environmentId, {
                              environmentId: assignment.environmentId,
                              role: e.target.value
                            })}
                            disabled={savingAssignments}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                          >
                            <option value="cashier">קופאי</option>
                            <option value="officer">קצין ניהול</option>
                            <option value="admin">מנהל מערכת</option>
                          </select>
                        </div>
                        <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-2 text-center">
                          {roleLabel(assignment.role)}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteUserAssignment(assignment.environmentId)}
                          disabled={savingAssignments}
                          className="px-3 py-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 text-sm font-bold disabled:opacity-50"
                        >
                          מחק
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-3">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">הוסף סביבה</label>
                      <select
                        value={newUserEnvAssignment.environmentId}
                        onChange={(e) => setNewUserEnvAssignment(prev => ({ ...prev, environmentId: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                      >
                        <option value="">בחר סביבה</option>
                        {environments.map((env) => (
                          <option key={env.id} value={env.id}>{env.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">הרשאה</label>
                      <select
                        value={newUserEnvAssignment.role}
                        onChange={(e) => setNewUserEnvAssignment(prev => ({ ...prev, role: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                      >
                        <option value="cashier">קופאי</option>
                        <option value="officer">קצין ניהול</option>
                        <option value="admin">מנהל מערכת</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddUserAssignment}
                      disabled={savingAssignments}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold disabled:opacity-50"
                    >
                      הוסף שיוך
                    </button>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowEditUserModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-colors">ביטול</button>
                <button type="submit" disabled={savingUserUpdate} className="flex-1 py-3 rounded-xl bg-green-500 text-white hover:bg-green-600 font-bold transition-colors shadow-sm disabled:opacity-50">
                  {savingUserUpdate ? 'שומר...' : 'שמור שינויים'}
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showManageEnvUsersModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl p-8 shadow-xl" dir="rtl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">ניהול משתמשים ברמת מנהל על</h3>
              <button onClick={() => setShowManageEnvUsersModal(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-2">
                <XCircle size={20} />
              </button>
            </div>

            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => { setEnvUserMode('assign'); setAssignMode('keep'); }}
                className={`px-4 py-2 rounded-full text-sm font-bold ${envUserMode === 'assign' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}
              >
                שיוך משתמש קיים
              </button>
              <button
                type="button"
                onClick={() => { setEnvUserMode('create'); setNewEnvUserPersonalNumber(''); }}
                className={`px-4 py-2 rounded-full text-sm font-bold ${envUserMode === 'create' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}
              >
                יצירת משתמש חדש
              </button>
            </div>

            <form onSubmit={handleAddEnvUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">סביבת יעד</label>
                <select
                  name="targetEnvironmentId"
                  value={manageTargetEnvId}
                  onChange={(e) => setManageTargetEnvId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200"
                  required
                >
                  <option value="">בחר סביבה</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
              </div>

              {envUserMode === 'assign' ? (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">בחר משתמש</label>
                    <select name="userId" className="w-full px-4 py-3 rounded-xl border border-slate-200">
                      <option value="">בחר משתמש</option>
                      {allUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">תפקיד בסביבה</label>
                    <select name="role" defaultValue="cashier" className="w-full px-4 py-3 rounded-xl border border-slate-200">
                      <option value="cashier">קופאי</option>
                      <option value="officer">רס"פ / קצין ניהול</option>
                      <option value="admin">מנהל מערכת</option>
                    </select>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <p className="text-sm font-bold text-slate-700">בשינוי סביבה למשתמש קיים:</p>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="assignmentMode"
                        value="keep"
                        checked={assignMode === 'keep'}
                        onChange={(e) => setAssignMode(e.target.value)}
                      />
                      להשאיר אותו גם בסביבה הישנה ולהוסיף לסביבה החדשה
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="assignmentMode"
                        value="move"
                        checked={assignMode === 'move'}
                        onChange={(e) => setAssignMode(e.target.value)}
                      />
                      להעביר לסביבה החדשה בלבד (להסיר משיוכים ישנים)
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">שם מלא *</label>
                      <input required name="fullName" type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">שם משתמש *</label>
                      <input required name="username" type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">סיסמה *</label>
                      <input required name="password" type="password" className="w-full px-4 py-3 rounded-xl border border-slate-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">מספר אישי</label>
                      <input
                        name="personalNumber"
                        type="text"
                        value={newEnvUserPersonalNumber}
                        onChange={(e) => setNewEnvUserPersonalNumber(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">אימייל</label>
                      <input
                        type="email"
                        value={newEnvUserPersonalNumber ? `${newEnvUserPersonalNumber}@idf.com` : ''}
                        readOnly
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">תפקיד בסביבה</label>
                    <select name="role" defaultValue="cashier" className="w-full px-4 py-3 rounded-xl border border-slate-200">
                      <option value="cashier">קופאי</option>
                      <option value="officer">רס"פ / קצין ניהול</option>
                      <option value="admin">מנהל מערכת</option>
                    </select>
                  </div>
                </>
              )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowManageEnvUsersModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-colors">
                  ביטול
                </button>
                <button type="submit" disabled={savingEnvUser} className="flex-1 py-3 rounded-xl bg-green-500 text-white hover:bg-green-600 font-bold transition-colors shadow-sm disabled:opacity-50">
                  {savingEnvUser ? 'שומר...' : 'שמור'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// --- REUSABLE UI COMPONENTS ---

function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 ${isActive
        ? 'bg-green-50 text-green-600 font-semibold'
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        }`}
      title={label}
    >
      <div className={`${isActive ? 'scale-110' : ''} transition-transform`}>
        {icon}
      </div>
      <span className="hidden md:block whitespace-nowrap">{label}</span>
    </button>
  );
}

function StatCard({ title, value, icon, color, bg }) {
  return (
    <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${bg} ${color}`}>
        {React.cloneElement(icon, { size: 28 })}
      </div>
      <div className="text-right">
        <div className="text-slate-500 text-xs mb-1">{title}</div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active: 'bg-green-100 text-green-700 border-green-200',
    inactive: 'bg-slate-100 text-slate-700 border-slate-200',
    suspended: 'bg-red-100 text-red-700 border-red-200',
  };
  const labels = {
    active: 'פעיל',
    inactive: 'לא פעיל',
    suspended: 'מושהה',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
