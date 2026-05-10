/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LogOut, 
  Send, 
  User as UserIcon, 
  ShieldCheck, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Mail, 
  Key, 
  PlusCircle, 
  History,
  ClipboardList,
  ChevronRight,
  Upload,
  ArrowLeft,
  Chrome,
  Trash2,
  Settings,
  Search,
  Eraser,
  FileText,
  MapPin,
  Globe,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, UserRole, Report, ReportStatus, AppState, Message, AppSettings, AccountBind, BindStatus } from './types';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  updateDoc,
  addDoc,
  deleteDoc,
  limit,
  getDocs,
  serverTimestamp,
  writeBatch,
  Timestamp,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className={`fixed bottom-4 left-4 right-4 p-4 rounded-xl shadow-lg border flex items-center gap-3 z-50 ${
      type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
    }`}
  >
    {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
    <p className="text-sm font-medium flex-1">{message}</p>
    <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full ring-0 outline-none">
      <LogOut size={16} className="rotate-90 opacity-40" />
    </button>
  </motion.div>
);

const GlobalChat = ({ currentUser, showToast, chatSettings, onResetChat }: { 
  currentUser: User, 
  showToast: (m: string, t?: 'success' | 'error') => void, 
  chatSettings: AppSettings,
  onResetChat?: () => void 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Message));
      setMessages(msgs.reverse());
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [currentUser.id]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    if (!chatSettings.chatEnabled && currentUser?.role !== UserRole.ADMIN) {
      showToast('Chat sedang dinonaktifkan oleh Admin', 'error');
      return;
    }

    setSending(true);
    try {
      const messageData: Omit<Message, 'id'> = {
        userId: currentUser.id,
        userEmail: currentUser.email,
        role: currentUser?.role,
        text: newMessage.trim(),
        createdAt: Date.now()
      };
      await addDoc(collection(db, 'messages'), messageData);
      setNewMessage('');
    } catch (error) {
      console.error('Send error:', error);
      showToast('Gagal mengirim pesan', 'error');
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'messages', id));
      showToast('Pesan dihapus');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `messages/${id}`);
    }
  };

  const isChatDisabled = !chatSettings.chatEnabled && currentUser?.role !== UserRole.ADMIN;

  return (
    <div className="bg-slate-100 rounded-[2.5rem] p-6 flex flex-col h-[500px] relative overflow-hidden">
      {isChatDisabled && (
        <div className="absolute inset-0 z-10 bg-slate-100/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 text-center space-y-4">
           <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-slate-400 shadow-sm">
             <AlertCircle size={32} />
           </div>
           <div>
             <h4 className="font-bold text-slate-600">Chat Global Dinonaktifkan</h4>
             <p className="text-xs text-slate-400 mt-1">Admin telah menonaktifkan fitur chat untuk sementara.</p>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${chatSettings.chatEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
          <h4 className="font-bold text-lg">Chat Global</h4>
        </div>
        <div className="flex items-center gap-2">
          {currentUser.role === UserRole.ADMIN && (
            <button 
              onClick={onResetChat}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Reset Chat"
            >
              <Eraser size={14} />
            </button>
          )}
          {!chatSettings.chatEnabled && currentUser.role === UserRole.ADMIN && (
            <span className="text-[9px] font-black uppercase text-red-500 bg-red-50 px-2 py-0.5 rounded-full ring-1 ring-red-100">Hidden</span>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.userId === currentUser.id ? 'items-end' : 'items-start'} group`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1">
              {currentUser.role === UserRole.ADMIN && (
                <button 
                  onClick={() => deleteMessage(msg.id)}
                  className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
              <span className={`text-[10px] font-black uppercase ${msg.role === UserRole.ADMIN ? 'text-orange-500' : 'text-slate-400'}`}>
                {msg.role === UserRole.ADMIN ? 'Admin Garena Freefire' : msg.userEmail.split('@')[0]}
              </span>
              <span className="text-[8px] text-slate-300">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-xs font-medium ${
              msg.userId === currentUser.id 
                ? 'bg-orange-500 text-white rounded-tr-none' 
                : 'bg-white text-slate-700 shadow-sm rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
            Belum ada pesan. Mulai obrolan!
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={isChatDisabled ? "Chat dinonaktifkan..." : "Tulis pesan..."}
          disabled={isChatDisabled}
          className="flex-1 bg-white rounded-xl px-4 py-2 text-sm border-none focus:ring-2 focus:ring-orange-500 outline-none shadow-sm disabled:opacity-50"
        />
        <button 
          disabled={!newMessage.trim() || sending || isChatDisabled}
          className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center hover:bg-orange-600 transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-orange-100"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
};

const CekBind = ({ bindings, bindSearch, setBindSearch, isAdmin, onDelete, onUpdateNote, onShowDetails }: { 
  bindings: AccountBind[], 
  bindSearch: string, 
  setBindSearch: (v: string) => void,
  isAdmin?: boolean,
  onDelete?: (id: string) => void,
  onUpdateNote?: (id: string, note: string) => void,
  onShowDetails?: (bind: AccountBind) => void
}) => {
  const filtered = bindings.filter(b => 
    b.accountName.toLowerCase().includes(bindSearch.toLowerCase()) || 
    b.emailBind.toLowerCase().includes(bindSearch.toLowerCase()) ||
    b.accountId?.toLowerCase().includes(bindSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-24">
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-orange-100">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative z-10 space-y-4">
           <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center ring-4 ring-orange-500/20">
               <ShieldCheck size={24} />
             </div>
             <div>
               <h3 className="text-xl font-black uppercase tracking-tight">Status Bind Akun</h3>
               <p className="text-xs text-slate-400 font-medium">Verifikasi keamanan & kepemilikan bind google</p>
             </div>
           </div>

           <div className="relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
             <input 
               value={bindSearch}
               onChange={(e) => setBindSearch(e.target.value)}
               placeholder="Cari nama akun atau email bind..."
               className="w-full bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all placeholder:text-slate-600 shadow-inner"
             />
           </div>
        </div>
      </div>

      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? filtered.map((bind) => (
            <motion.div 
              layout
              key={bind.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
            >
              <div className={`absolute top-0 right-0 w-2 h-full ${
                bind.status === BindStatus.SECURE ? 'bg-green-500' : 
                bind.status === BindStatus.PENDING ? 'bg-orange-500' : 'bg-red-500'
              }`} />
              
              <div className="flex items-start justify-between gap-4">
                 <div className="space-y-4 flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                             bind.status === BindStatus.SECURE ? 'bg-green-50 text-green-600 ring-1 ring-green-100' : 
                             bind.status === BindStatus.PENDING ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100' : 
                             'bg-red-50 text-red-600 ring-1 ring-red-100'
                           }`}>
                             {bind.status}
                           </span>
                           <span className="text-[10px] text-slate-400 font-mono">ID: {bind.accountId || bind.id.slice(0,8)}</span>
                        </div>
                        
                        {isAdmin && onDelete && (
                          <button 
                            onClick={() => {
                              if (window.confirm('Hapus data bind ini?')) {
                                onDelete(bind.id);
                              }
                            }}
                            className="p-1.5 text-red-500 hover:text-red-700 bg-red-50 rounded-lg transition-all"
                            title="Hapus Data"
                          >
                             <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                    <div>
                       <div className="flex items-center justify-between">
                          <h4 className="font-bold text-lg text-slate-800">{bind.accountName}</h4>
                          {bind.accountId && <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">#{bind.accountId}</span>}
                       </div>
                       <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5 mt-0.5">
                         <Chrome size={14} className="text-slate-400" />
                         {bind.emailBind}
                       </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                       <div className="bg-slate-50 p-2.5 rounded-xl min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">LOKASI AKTIF</p>
                          <p className="text-xs font-bold text-slate-700 truncate" title={bind.location}>{bind.location || 'Tidak diketahui'}</p>
                       </div>
                       <div className="bg-slate-50 p-2.5 rounded-xl min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">DEVICE LOGIN</p>
                          <p className="text-xs font-bold text-slate-700 truncate" title={bind.device}>{bind.device || 'N/A'}</p>
                       </div>
                    </div>

                    <div className="space-y-2">
                      <button 
                         onClick={() => onShowDetails?.(bind)}
                         className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                      >
                        <MapPin size={10} />
                        Cek Lokasi Selengkapnya
                      </button>

                      {bind.notes && (
                        <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                           <p className="text-[10px] text-orange-800 leading-relaxed italic">"{bind.notes}"</p>
                        </div>
                      )}
                      
                      {isAdmin && onUpdateNote && (
                        <button 
                          onClick={() => {
                            const newNote = prompt('Set pesan / catatan untuk bind ini:', bind.notes || '');
                            if (newNote !== null) onUpdateNote(bind.id, newNote);
                          }}
                          className="text-[10px] font-black uppercase text-orange-600 bg-orange-50 px-2 py-1 rounded hover:bg-orange-100 flex items-center gap-1 transition-all"
                        >
                          <Settings size={10} />
                          Set Pesan
                        </button>
                      )}
                    </div>
                 </div>
              </div>
            </motion.div>
          )) : (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center text-slate-400">
               <History size={48} className="mx-auto mb-4 opacity-20" />
               <p className="font-bold">Data Tidak Ditemukan</p>
               <p className="text-xs">Ulangi pencarian dengan kata kunci yang benar</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'auth' | 'dashboard'>('auth');
  const [activeTab, setActiveTab] = useState<'reports' | 'chat' | 'bind'>('reports');
  const [isAdminTab, setIsAdminTab] = useState(false);
  const [chatSettings, setChatSettings] = useState<AppSettings>({ chatEnabled: true });
  const [bindings, setBindings] = useState<AccountBind[]>([]);
  const [bindSearch, setBindSearch] = useState('');
  const [newBind, setNewBind] = useState<Partial<AccountBind>>({
    status: BindStatus.SECURE
  });
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [selectedBindDetails, setSelectedBindDetails] = useState<AccountBind | null>(null);

  // Form states
  const [googleLama, setGoogleLama] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<Report | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [now, setNow] = useState(Date.now()); // State for real-time ticking

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [adminRecoveredEmail, setAdminRecoveredEmail] = useState('');
  const [adminRecoveredPassword, setAdminRecoveredPassword] = useState('');

  // 1. Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Sync user profile
        try {
          const userRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setCurrentUser(userSnap.data() as User);
          } else {
            // Create profile
            const newUser: User = {
              id: fbUser.uid,
              email: fbUser.email || '',
              role: fbUser.email === 'kytyg800@gmail.com' ? UserRole.ADMIN : UserRole.USER,
              createdAt: Date.now(),
            };
            await setDoc(userRef, newUser);
            setCurrentUser(newUser);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${fbUser.uid}`);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Data Sync
  useEffect(() => {
    if (!currentUser) {
      setReports([]);
      setAllUsers([]);
      return;
    }

    let unsubscribeReports = () => {};
    let unsubscribeUsers = () => {};

    if (currentUser.role === UserRole.ADMIN) {
      // Admin: See all reports and all users
      const reportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
        setReports(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Report)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'reports'));

      const usersQuery = query(collection(db, 'users'));
      unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => doc.data() as User));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    } else {
      // User: See only own reports
      const reportsQuery = query(
        collection(db, 'reports'), 
        where('userId', '==', currentUser.id),
        orderBy('createdAt', 'desc')
      );
      unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
        setReports(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Report)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'reports'));
    }

    return () => {
      unsubscribeReports();
      unsubscribeUsers();
    };
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      setView('dashboard');
      if (currentUser.role === UserRole.ADMIN) {
        setIsAdminTab(true);
      }
    } else {
      setView('auth');
    }
  }, [currentUser]);

  // Listen to Global Settings & Bindings (only when logged in)
  useEffect(() => {
    if (!currentUser) {
      setBindings([]);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setChatSettings(snap.data() as AppSettings);
      }
    }, (error) => {
      // Fail silently for settings to avoid disruptive errors on login transition
      console.warn('Settings listener error:', error);
    });

    const bindUnsub = onSnapshot(query(collection(db, 'bindings'), orderBy('createdAt', 'desc')), (snap) => {
      setBindings(snap.docs.map(d => ({ ...d.data(), id: d.id } as AccountBind)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bindings');
    });

    return () => {
      unsubscribe();
      bindUnsub();
    };
  }, [currentUser?.id]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleGoogleAuth = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Login berhasil!');
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user') {
        return;
      }
      console.error(error);
      showToast('Autentikasi Gagal', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast('Berhasil logout');
    } catch (error) {
      showToast('Logout Gagal', 'error');
    }
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleLama || !currentUser) return;

    try {
      const newReport: Omit<Report, 'id'> = {
        userId: currentUser.id,
        userEmail: currentUser.email,
        googleLama,
        status: ReportStatus.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        message: 'Laporan telah diterima. Menunggu proses dari Gmail FF.'
      };

      const docRef = await addDoc(collection(db, 'reports'), newReport);
      
      // Notify Admin
      try {
        await fetch('/api/notify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            reportId: docRef.id, 
            userEmail: currentUser.email, 
            googleLama 
          })
        });
      } catch (e) {
        console.warn('Notification failed', e);
      }

      setGoogleLama('');
      showToast('Laporan dikirim!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reports');
    }
  };

  const addBind = async () => {
    if (!newBind.accountName || !newBind.emailBind) return;
    try {
      const id = doc(collection(db, 'bindings')).id;
      const data: AccountBind = {
        id,
        accountId: newBind.accountId || '',
        accountName: newBind.accountName || '',
        emailBind: newBind.emailBind || '',
        location: newBind.location || '',
        device: newBind.device || '',
        status: newBind.status || BindStatus.SECURE,
        notes: newBind.notes || '',
        createdAt: Date.now()
      };
      await setDoc(doc(db, 'bindings', id), data);
      showToast('Data bind ditambahkan');
      setNewBind({ status: BindStatus.SECURE });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bindings');
    }
  };

  const resetChat = async (skipConfirm = false) => {
    if (!skipConfirm && !confirm('Hapus semua pesan chat?')) return;
    try {
      const snap = await getDocs(collection(db, 'messages'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showToast('Global chat telah di-reset');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages');
    }
  };

  const resetBindings = async () => {
    try {
      const batch = writeBatch(db);
      const snap = await getDocs(collection(db, 'bindings'));
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showToast('Semua data bind telah di-reset');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bindings');
    }
  };

  useEffect(() => {
    // Temporary reset trigger
    const hasReset = localStorage.getItem('data_reset_requested_v1');
    if (!hasReset && currentUser?.role === UserRole.ADMIN) {
      const doReset = async () => {
        console.log('Resetting global chat and bindings as requested by user...');
        await resetChat(true);
        await resetBindings();
        localStorage.setItem('data_reset_requested_v1', 'true');
      };
      doReset();
    }
  }, [currentUser]);

  const deleteBind = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bindings', id));
      showToast('Data dihapus');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bindings/${id}`);
    }
  };

  const updateBindNote = async (id: string, notes: string) => {
    try {
      const bindRef = doc(db, 'bindings', id);
      await updateDoc(bindRef, { notes });
      showToast('Pesan bind diperbarui');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bindings/${id}`);
    }
  };

  const updateReportStatus = async (id: string, updates: Partial<Report>) => {
    try {
      const reportRef = doc(db, 'reports', id);
      const existingSnap = await getDoc(reportRef);
      const existingData = existingSnap.data() as Report;

      await updateDoc(reportRef, { ...updates, updatedAt: Date.now() });

      // Notify User if status changed
      if (updates.status && updates.status !== existingData.status) {
        try {
          await fetch('/api/notify-user-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              userEmail: existingData.userEmail, 
              googleLama: existingData.googleLama, 
              status: updates.status,
              message: updates.message || existingData.message
            })
          });
        } catch (e) {
          console.warn('User notification failed', e);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${id}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, reportId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await updateReportStatus(reportId, { 
        screenshotUrl: base64String, 
        message: 'Admin telah mengirim screenshot akun. Silakan konfirmasi.' 
      });
      showToast('Screenshot terkirim!');
    };
    reader.readAsDataURL(file);
  };

  const activeReport = useMemo(() => 
    reports.find(r => r.id === activeReportId), 
  [reports, activeReportId]);

  const handleCheckDuration = async () => {
    if (!searchEmail) return;
    setIsChecking(true);
    setSearchResult(null);
    
    try {
      const emailQuery = searchEmail.toLowerCase().trim();
      
      // Global Search in Database
      const qSearch = query(
        collection(db, 'reports'), 
        where('googleLama', '==', emailQuery), 
        limit(1)
      );
      
      const snap = await getDocs(qSearch);
      
      const targetEmails = ['amiramir99514@gmail.com', 'akunpemulihantrduwi@gmail.com'];
      const isSpecialCase = targetEmails.includes(emailQuery);
      
      // Fixed start point: May 9, 2026 at 17:35:00 UTC (approx 10:35 UTC if the user meant local WIB)
      // I will use 10:35 UTC to treat 17:35 as WIB (GMT+7)
      const fixedStartTime = new Date('2026-05-09T10:35:00Z').getTime();

      if (!snap.empty) {
        const found = { id: snap.docs[0].id, ...snap.docs[0].data() } as Report;
        // If it's a special case, override with the requested fixed timer
        if (isSpecialCase) {
          found.createdAt = fixedStartTime;
        }
        setSearchResult(found);
      } else {
        // Special Case / Demo Account Fallback if not found in DB
        if (isSpecialCase) {
          const virtualReport: Report = {
            id: 'virtual-demo-fixed',
            userId: 'system',
            userEmail: 'demo@gmail.ff',
            googleLama: emailQuery,
            status: ReportStatus.PROSES,
            createdAt: fixedStartTime, 
            updatedAt: fixedStartTime,
            message: 'Akun sedang dalam proses pemulihan otomatis oleh sistem Gmail FF. Keamanan tingkat tinggi diaktifkan.'
          };
          setSearchResult(virtualReport);
          showToast('Data Akun Khusus Ditemukan');
        } else {
          showToast('Data tidak ditemukan di database', 'error');
        }
      }
    } catch (error) {
      console.error(error);
      showToast('Gagal mencari data', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  const getEstimation = (report: Report) => {
    const emailQuery = report.googleLama.toLowerCase().trim();
    const targetEmails = ['amiramir99514@gmail.com', 'akunpemulihantrduwi@gmail.com'];
    const isSpecialCase = targetEmails.includes(emailQuery);

    if (!isSpecialCase) {
      if (report.status === ReportStatus.SELESAI) return 'SUDAH DIPULIHKAN';
      if (report.status === ReportStatus.BATAL || report.status === ReportStatus.GAGAL) return 'PROSES DIBERHENTIKAN';
    }
    
    // Target duration logic
    let totalTargetMs = 0;
    if (isSpecialCase) {
      // 3 Bulan + 24 Jam + 10 Menit + 2 Detik
      const threeMonths = 90 * 24 * 60 * 60 * 1000;
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const tenMinutes = 10 * 60 * 1000;
      const twoSeconds = 2 * 1000;
      totalTargetMs = threeMonths + twentyFourHours + tenMinutes + twoSeconds;
    } else {
      totalTargetMs = 48 * 60 * 60 * 1000; // Default 48 Jam
    }

    const targetTime = report.createdAt + totalTargetMs;
    const diff = targetTime - now;

    if (diff <= 0) {
      return (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg py-3 px-4 text-center">
           <p className="text-sm font-black text-green-400 uppercase italic">Akun Berhasil Diamankan Permanen!</p>
        </div>
      );
    }

    // Calculate time segments
    const months = Math.floor(diff / (30 * 24 * 60 * 60 * 1000));
    const days = Math.floor((diff % (30 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const secs = Math.floor((diff % (60 * 1000)) / 1000);

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-end justify-center sm:justify-start">
          {months > 0 && (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white font-mono leading-none tracking-tighter">{months}</span>
              <span className="text-[10px] text-orange-500 font-black uppercase">Bln</span>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-white font-mono leading-none tracking-tighter">{days}</span>
            <span className="text-[10px] text-orange-500 font-black uppercase">Hari</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white font-mono leading-none tracking-tighter">{hours.toString().padStart(2, '0')}</span>
            <span className="text-[10px] text-orange-500 font-black uppercase">Jam</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-orange-500 font-mono leading-none tracking-tighter">{mins.toString().padStart(2, '0')}</span>
            <span className="text-[10px] text-orange-500/50 font-black uppercase">Min</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-white/30 font-mono leading-none tracking-tighter">{secs.toString().padStart(2, '0')}</span>
            <span className="text-[8px] text-white/20 font-black uppercase">Det</span>
          </div>
        </div>
        
        <div className="bg-orange-500/20 border border-orange-500/40 rounded-xl py-3 px-4 shadow-[0_0_20px_rgba(249,115,22,0.1)]">
          <p className="text-[12px] font-black uppercase text-white tracking-widest italic text-center leading-relaxed">
            {months > 0 ? `${months} Bulan ` : ''}{days} Hari {hours} Jam {mins} Menit {secs} Detik<br/>
            <span className="text-orange-400 text-[10px]">Waktu Admin Mengambil Akun Kembali</span>
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-orange-100 flex flex-col items-center p-0 md:p-4">
      {/* Container wraps as a mobile screen for desktop */}
      <div id="app-container" className="w-full max-w-md bg-white min-h-screen md:min-h-[800px] md:rounded-[3rem] md:shadow-2xl overflow-hidden relative border-slate-200 md:border flex flex-col transition-all duration-300">
        
        {/* Header */}
        <header className="px-6 pt-12 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <h1 className="font-bold text-xl tracking-tight">FF Guard</h1>
          </div>
          <div className="flex items-center gap-2">
            {currentUser?.role === UserRole.ADMIN && (
              <button 
                onClick={() => setIsAdminTab(!isAdminTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isAdminTab ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {isAdminTab ? 'Admin Panel' : 'User View'}
              </button>
            )}
            {currentUser && (
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 pb-12">
          <AnimatePresence mode="wait">
            
          {/* View: Auth */}
            {view === 'auth' && (
              <motion.div
                key="auth-view"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex flex-col items-center justify-center min-h-[600px] text-center space-y-8"
              >
                <div className="w-20 h-20 bg-orange-100 rounded-[2.5rem] flex items-center justify-center text-orange-500 shadow-inner">
                  <ShieldCheck size={40} />
                </div>
                
                <div>
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">FF Guard Pro</h2>
                  <p className="text-slate-500 font-medium mt-2 max-w-[240px] leading-tight">
                    Sistem pemulihan akun Free Fire profesional & terpercaya.
                  </p>
                </div>

                <div className="w-full space-y-4">
                  <button 
                    onClick={handleGoogleAuth}
                    className="w-full bg-slate-900 text-white font-black italic uppercase tracking-widest py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95"
                  >
                    <Chrome size={20} /> Masuk dangan Google
                  </button>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Powered by Secure Google Auth</p>
                </div>
              </motion.div>
            )}
            
            {/* Nav Switch (Only in Dashboard) */}
            {view === 'dashboard' && (
               <div className="flex justify-center gap-4 mb-6">
                  <button 
                    onClick={() => setActiveTab('reports')}
                    className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${
                      activeTab === 'reports' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-300'
                    }`}
                  >
                    Laporan
                  </button>
                  <button 
                    onClick={() => setActiveTab('bind')}
                    className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${
                      activeTab === 'bind' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-300'
                    }`}
                  >
                    Cek Bind
                  </button>
                  <button 
                    onClick={() => setActiveTab('chat')}
                    className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${
                      activeTab === 'chat' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-300'
                    }`}
                  >
                    Chat Global
                  </button>
               </div>
            )}

            {/* View: User Dashboard */}
            {view === 'dashboard' && activeTab === 'reports' && (!isAdminTab || currentUser?.role !== UserRole.ADMIN) && (
              <motion.div
                key="user-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 pt-2"
              >
                <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-3xl">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-orange-500">
                    <UserIcon size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate">{currentUser?.email}</h3>
                    <div className="flex items-center gap-1.5 text-orange-600 text-xs font-semibold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                      Status: Veteran User
                    </div>
                  </div>
                </div>

                {/* Report Form */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-lg flex items-center gap-2">
                      <PlusCircle size={20} className="text-orange-500" />
                      Pulihkan Akun Google
                    </h4>
                  </div>
                  
                  <form onSubmit={submitReport} className="bg-slate-100 p-6 rounded-3xl space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Google Email / ID Lama</label>
                      <input 
                        required
                        placeholder="Contoh: user@gmail.com"
                        value={googleLama}
                        onChange={(e) => setGoogleLama(e.target.value)}
                        className="w-full bg-white border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all placeholder:text-slate-300"
                      />
                    </div>
                    <button className="w-full bg-slate-900 text-white font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                      <Send size={18} />
                      Pulihkan Sekarang
                    </button>
                    <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest leading-tight">Proses akan dikerjakan oleh tim Gmail FF</p>
                  </form>
                </div>

                {/* Check Status Section */}
                <div className="space-y-4">
                   <h4 className="font-bold text-lg flex items-center gap-2">
                    <ShieldCheck size={20} className="text-orange-500" />
                    Cek Masa Pemulihan
                  </h4>
                  <div className="bg-slate-900 rounded-[2rem] p-6 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Chrome size={80} />
                    </div>
                    <div className="relative z-10 space-y-4">
                      <p className="text-[10px] font-black uppercase text-orange-400 tracking-[0.2em] italic">Database Search System</p>
                      <div className="flex gap-2">
                        <input 
                          type="email"
                          placeholder="Masukkan Gmail Anda"
                          value={searchEmail}
                          onChange={(e) => setSearchEmail(e.target.value)}
                          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500 transition-all placeholder:text-white/20"
                        />
                        <button 
                          onClick={handleCheckDuration}
                          disabled={isChecking}
                          className="bg-orange-500 px-4 rounded-xl font-black italic uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isChecking ? <Loader2 size={16} className="animate-spin" /> : 'CEK'}
                        </button>
                      </div>

                      {searchResult && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-4 mt-4 border-t border-white/10 space-y-3"
                        >
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Status Terkini</span>
                             <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                               searchResult.status === ReportStatus.SELESAI ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                             }`}>
                               {searchResult.status}
                             </span>
                          </div>
                          
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-4">
                             <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                                <p className="text-xs font-black italic text-orange-400 uppercase tracking-widest">Waktu Proses Server</p>
                             </div>
                             
                             <div className="py-2">
                               {getEstimation(searchResult)}
                             </div>

                             <div className="space-y-1">
                                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                   <motion.div 
                                     initial={{ width: 0 }}
                                     animate={{ 
                                       width: searchResult.status === ReportStatus.SELESAI ? '100%' : 
                                              searchResult.status === ReportStatus.BATAL || searchResult.status === ReportStatus.GAGAL ? '0%' :
                                              '65%' // Default for progress
                                     }}
                                     className="h-full bg-gradient-to-r from-orange-400 to-orange-600 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                   />
                                </div>
                                <div className="flex justify-between items-center text-[8px] font-bold text-white/20 uppercase tracking-widest">
                                  <span>Start</span>
                                  <span>Syncing to Server</span>
                                  <span>Claimed</span>
                                </div>
                             </div>
                             
                             <p className="text-[9px] text-white/40 italic font-medium leading-tight pt-1">
                               *Waktu dapat berubah sesuai antrian server Garena/Gmail Admin.
                             </p>
                          </div>
                          
                          <button 
                            onClick={() => setSearchResult(null)}
                            className="w-full text-[10px] text-white/30 font-bold uppercase tracking-widest hover:text-white transition-colors"
                          >
                            TUTUP HASIL
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Report List */}
                <div className="space-y-4">
                  <h4 className="font-bold text-lg flex items-center gap-2">
                    <History size={20} className="text-orange-500" />
                    Riwayat Laporan
                  </h4>
                  <div className="space-y-3">
                    {reports.map((report) => (
                      <div key={report.id} className="p-4 border border-slate-100 rounded-3xl bg-white shadow-sm flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-mono text-[10px] font-bold opacity-30 tracking-tight">#{report.id.slice(0, 8)}</span>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            report.status === ReportStatus.PENDING ? 'bg-amber-100 text-amber-700' :
                            report.status === ReportStatus.PROSES ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {report.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-400 font-medium tracking-tighter uppercase mb-0.5">Google Lama</p>
                            <p className="font-bold text-slate-700 text-base leading-none">{report.googleLama}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-400 font-medium tracking-tight whitespace-nowrap">Tanggal</p>
                            <p className="text-xs font-bold text-slate-500">{new Date(report.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <div className={`p-4 rounded-2xl border ${
                          report.status === ReportStatus.SELESAI ? 'bg-green-50 border-green-100' : 
                          report.status === ReportStatus.GAGAL ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'
                        }`}>
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Pesan Gmail FF:</p>
                          <p className="text-xs text-slate-700 font-bold italic leading-relaxed">
                            {report.message}
                          </p>
                          {report.recoveredPassword && report.status === ReportStatus.SELESAI && (
                            <div className="mt-2 pt-2 border-t border-green-200">
                               <p className="text-[10px] font-black uppercase text-green-600 mb-1 tracking-widest">Password Berhasil Dipulihkan:</p>
                               <div className="bg-white p-2 rounded-lg border border-green-200 font-mono text-center text-sm font-black text-slate-900 tracking-widest">
                                 {report.recoveredPassword}
                               </div>
                            </div>
                          )}
                        </div>

                        {/* Interactive parts for user when processing or finished */}
                        {report.status === ReportStatus.SELESAI && !report.userFeedback && (
                          <div className="space-y-3">
                             <p className="text-[10px] text-center font-black uppercase text-slate-400 tracking-widest italic">Apakah Pemulihan Berhasil?</p>
                             <div className="flex gap-2">
                                <button 
                                  onClick={() => updateReportStatus(report.id, { userFeedback: 'BERHASIL' })}
                                  className="flex-1 py-3 bg-green-500 text-white rounded-xl text-xs font-black uppercase italic shadow-sm hover:bg-green-600 transition-all"
                                >
                                  Berhasil
                                </button>
                                <button 
                                  onClick={() => updateReportStatus(report.id, { userFeedback: 'GAK_BISA', status: ReportStatus.GAGAL, message: 'User melaporkan pemulihan tidak berhasil.' })}
                                  className="flex-1 py-3 bg-white text-red-500 rounded-xl text-xs font-black border border-red-500/20 uppercase italic hover:bg-red-50 transition-all"
                                >
                                  Gak Bisa
                                </button>
                             </div>
                          </div>
                        )}

                        {report.userFeedback && (
                          <div className={`p-4 rounded-2xl flex items-center justify-center gap-2 ${
                            report.userFeedback === 'BERHASIL' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {report.userFeedback === 'BERHASIL' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            <span className="text-[10px] font-black uppercase italic tracking-widest">
                              Konfirmasi User: {report.userFeedback.replace('_', ' ')}
                            </span>
                          </div>
                        )}

                        {report.status === ReportStatus.PENDING && (
                           <div className="space-y-3">
                              <div className="flex items-center gap-2 justify-center py-2">
                                 <Loader2 size={14} className="animate-spin text-orange-400" />
                                 <p className="text-[10px] font-black uppercase text-orange-400 tracking-widest italic">Menunggu Antrian Admin...</p>
                              </div>
                              <button 
                                onClick={() => {
                                  if (confirm('Batalkan laporan ini?')) {
                                    updateReportStatus(report.id, { status: ReportStatus.BATAL, message: 'Laporan dibatalkan oleh Anda.' });
                                    showToast('Laporan Dibatalkan');
                                  }
                                }}
                                className="w-full py-3 border-2 border-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase italic hover:bg-slate-50 transition-all"
                              >
                                ❌ Batalkan Laporan
                              </button>
                           </div>
                        )}
                        
                        {report.status === ReportStatus.BATAL && (
                           <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-center gap-2">
                              <LogOut size={16} className="text-slate-400 rotate-90" />
                              <span className="text-[10px] font-black uppercase italic text-slate-500 tracking-widest">Laporan Dibatalkan</span>
                           </div>
                        )}
                      </div>
                    ))}

                    {reports.length === 0 && (
                      <div className="text-center py-12 px-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl space-y-3">
                        <Loader2 className="mx-auto text-slate-300 animate-pulse" size={32} />
                        <p className="text-slate-400 text-sm font-medium italic">Belum ada laporan akun hilang.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* View: Cek Bind */}
            {view === 'dashboard' && activeTab === 'bind' && currentUser && (
              <motion.div
                 key="bind-view"
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -20 }}
              >
                <CekBind 
                  bindings={bindings} 
                  bindSearch={bindSearch} 
                  setBindSearch={setBindSearch} 
                  isAdmin={currentUser?.role === UserRole.ADMIN}
                  onDelete={deleteBind}
                  onUpdateNote={updateBindNote}
                  onShowDetails={(b) => setSelectedBindDetails(b)}
                />
              </motion.div>
            )}

            {/* View: Global Chat */}
            {view === 'dashboard' && activeTab === 'chat' && currentUser && (
              <motion.div
                key="chat-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <GlobalChat 
                  currentUser={currentUser} 
                  showToast={showToast} 
                  chatSettings={chatSettings} 
                  onResetChat={() => resetChat()}
                />
              </motion.div>
            )}

            {/* View: Admin Dashboard */}
            {view === 'dashboard' && activeTab === 'reports' && isAdminTab && currentUser?.role === UserRole.ADMIN && (
              <motion.div
                key="admin-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 pt-2"
              >
                {!activeReportId ? (
                  <>
                    <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl overflow-hidden relative">
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 opacity-60 mb-1">
                          <ShieldCheck size={14} />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Authority Portal</span>
                        </div>
                        <h2 className="text-2xl font-bold italic leading-tight uppercase tracking-tight">Pending Approval</h2>
                        <div className="flex items-baseline gap-2 mt-4">
                          <span className="text-5xl font-black text-orange-400 tracking-tighter tabular-nums leading-none">
                            {reports.filter(r => r.status !== ReportStatus.SELESAI).length}
                          </span>
                          <span className="text-sm font-bold opacity-60 italic whitespace-nowrap">Active Laps</span>
                        </div>
                      </div>
                      <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                        <ClipboardList size={120} />
                      </div>
                    </div>

                      {/* Quick Navigation Cards */}
                      <div className="grid grid-cols-2 gap-4">
                        <motion.button 
                          whileHover={{ y: -4 }}
                          onClick={() => { setActiveTab('reports'); setIsAdminTab(false); }}
                          className="bg-white border rounded-[2rem] p-6 text-left shadow-sm group"
                        >
                           <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-3 group-hover:bg-orange-600 group-hover:text-white transition-all">
                             <FileText size={18} />
                           </div>
                           <h4 className="font-bold text-slate-800">Support Reports</h4>
                           <p className="text-[10px] text-slate-400 mt-1">Kelola permohonan pemulihan akun</p>
                        </motion.button>

                        <motion.button 
                          whileHover={{ y: -4 }}
                          onClick={() => { setActiveTab('bind'); setIsAdminTab(false); }}
                          className="bg-white border rounded-[2rem] p-6 text-left shadow-sm group"
                        >
                           <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-3 group-hover:bg-green-600 group-hover:text-white transition-all">
                             <ShieldCheck size={18} />
                           </div>
                           <h4 className="font-bold text-slate-800">Account Bindings</h4>
                           <p className="text-[10px] text-slate-400 mt-1">Monitoring status bind google & email</p>
                        </motion.button>
                      </div>

                      {/* Add Bind Record Section */}
                      <div className="bg-white border rounded-[2rem] p-6 space-y-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                          <History size={64} />
                        </div>
                        <div className="flex items-center gap-2">
                           <ShieldCheck size={18} className="text-orange-500" />
                           <h3 className="font-bold text-sm uppercase tracking-tight">Add New Bind Status</h3>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ID Akun (Game ID)</label>
                          <input 
                            value={newBind.accountId || ''}
                            onChange={(e) => setNewBind({...newBind, accountId: e.target.value})}
                            className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            placeholder="Contoh: 12345678" 
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nama Akun</label>
                              <input 
                                value={newBind.accountName || ''}
                                onChange={(e) => setNewBind({...newBind, accountName: e.target.value})}
                                className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="..." 
                              />
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email Bind</label>
                              <input 
                                value={newBind.emailBind || ''}
                                onChange={(e) => setNewBind({...newBind, emailBind: e.target.value})}
                                className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="..." 
                              />
                           </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Status</label>
                              <select 
                                value={newBind.status}
                                onChange={(e) => setNewBind({...newBind, status: e.target.value as BindStatus})}
                                className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                              >
                                {Object.values(BindStatus).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Device</label>
                              <input 
                                value={newBind.device || ''}
                                onChange={(e) => setNewBind({...newBind, device: e.target.value})}
                                className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="Device..." 
                              />
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Lokasi</label>
                              <input 
                                value={newBind.location || ''}
                                onChange={(e) => setNewBind({...newBind, location: e.target.value})}
                                className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="Location..." 
                              />
                           </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center ml-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">Notes / Keterangan</label>
                            <div className="flex flex-wrap gap-1">
                              {["Akun Aman", "Proses Cek", "Trial Notice"].map(preset => (
                                <button 
                                  key={preset}
                                  type="button"
                                  onClick={() => {
                                    const msg = preset === "Trial Notice" 
                                      ? "device tersebut sudah di keluarkan dari akun bind tetapi mimin gabisa kirim email bind jangan lupa cek akun pemulihan di fitur cek pemulihan, ingat akun ini tidak permanen hanya trial"
                                      : preset;
                                    setNewBind({...newBind, notes: msg});
                                  }}
                                  className="text-[9px] bg-slate-100 hover:bg-orange-100 text-slate-500 hover:text-orange-600 px-1.5 py-0.5 rounded transition-colors font-bold"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          </div>
                          <textarea 
                            value={newBind.notes || ''}
                            onChange={(e) => setNewBind({...newBind, notes: e.target.value})}
                            className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                            placeholder="Catatan keamanan akun..." 
                          />
                        </div>

                        <button 
                          onClick={addBind}
                          className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                        >
                          <ShieldCheck size={18} />
                          Publish Bind Record
                        </button>
                      </div>

                      {/* Binding List Management */}
                      <div className="bg-white border rounded-[2rem] p-6 space-y-4 shadow-sm">
                         <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Recent Bind Logs</h4>
                            <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">{bindings.length} Total</span>
                         </div>
                         <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {bindings.map(b => (
                              <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl group/item">
                                 <div>
                                    <p className="text-xs font-bold text-slate-700">{b.accountName}</p>
                                    <p className="text-[10px] text-slate-400">{b.emailBind}</p>
                                 </div>
                                 <button 
                                   onClick={() => {
                                     if(window.confirm('Hapus log ini?')) deleteBind(b.id);
                                   }}
                                   className="p-1.5 text-red-300 hover:text-red-500 transition-all"
                                 >
                                    <Trash2 size={14} />
                                 </button>
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className="bg-white border rounded-[2rem] p-6 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Settings size={18} className="text-slate-400" />
                           <h4 className="font-bold text-sm uppercase tracking-tight">Global Settings</h4>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                         <div>
                            <p className="text-xs font-bold text-slate-700">Fitur Chat Global</p>
                            <p className="text-[10px] text-slate-400">Aktifkan atau nonaktifkan chat antar pengguna</p>
                         </div>
                         <button 
                           onClick={async () => {
                             try {
                               await setDoc(doc(db, 'settings', 'global'), { chatEnabled: !chatSettings.chatEnabled }, { merge: true });
                               showToast(`Chat ${!chatSettings.chatEnabled ? 'diaktifkan' : 'dinonaktifkan'}`);
                             } catch (e) {
                               showToast('Gagal merubah status chat', 'error');
                             }
                           }}
                           className={`w-12 h-6 rounded-full relative transition-all ${chatSettings.chatEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
                         >
                            <motion.div 
                              animate={{ x: chatSettings.chatEnabled ? 24 : 4 }}
                              className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                            />
                         </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-500 uppercase text-xs tracking-widest ml-1 font-mono tracking-tighter">Queue: ALL_RPTS</h4>
                      <div className="space-y-3">
                        {reports.map(report => (
                          <button 
                            key={report.id}
                            onClick={() => setActiveReportId(report.id)}
                            className="w-full text-left p-5 bg-white border hover:border-orange-200 rounded-3xl transition-all group flex items-center justify-between"
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-black tracking-widest uppercase py-1 px-2 border rounded-md bg-slate-50 text-slate-400">ACC: {report.googleLama}</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  report.status === ReportStatus.PENDING ? 'bg-amber-400' :
                                  report.status === ReportStatus.PROSES ? 'bg-blue-400' :
                                  report.status === ReportStatus.SELESAI ? 'bg-green-400' :
                                  'bg-red-400'
                                }`} />
                              </div>
                              <p className="font-bold text-slate-800 italic leading-none truncate max-w-[180px]">{report.userEmail}</p>
                              <p className="text-[10px] text-slate-400 font-medium">#{report.id.slice(0, 8)} • {new Date(report.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                              <ChevronRight size={20} />
                            </div>
                          </button>
                        ))}

                        {reports.length === 0 && (
                          <div className="py-12 text-center text-slate-400 font-medium italic">
                            No reports in queue.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <button onClick={() => setActiveReportId(null)} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors mb-2">
                      <ArrowLeft size={18} />
                      <span className="text-xs font-bold uppercase tracking-widest italic">Back to Queue</span>
                    </button>

                    <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
                      <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Process Recovery</p>
                          <h3 className="text-lg font-black italic uppercase tracking-tighter">ACC: {activeReport?.googleLama}</h3>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          activeReport?.status === ReportStatus.PENDING ? 'bg-amber-100 text-amber-700' :
                          activeReport?.status === ReportStatus.PROSES ? 'bg-blue-100 text-blue-700' :
                          activeReport?.status === ReportStatus.SELESAI ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {activeReport?.status}
                        </span>
                      </div>

                      <div className="p-6 space-y-6">
                        
                        {/* Summary */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Pelapor</p>
                            <p className="text-xs font-black truncate">{activeReport?.userEmail}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Case ID</p>
                            <p className="text-xs font-black">#{activeReport?.id}</p>
                          </div>
                        </div>                        <div className="p-4 bg-slate-50 rounded-2xl border">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Google Lama Pelapor</p>
                          <p className="text-xs italic text-slate-600 font-bold">{activeReport?.googleLama}</p>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-dashed">
                          {/* Active Process */}
                          {(activeReport?.status === ReportStatus.PENDING || activeReport?.status === ReportStatus.PROSES) && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Gmail FF Result (Email)</label>
                                <input 
                                  value={adminRecoveredEmail}
                                  onChange={(e) => setAdminRecoveredEmail(e.target.value)}
                                  placeholder="Email yang berhasil dipulihkan"
                                  className="w-full bg-slate-100 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm font-bold"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Password Result</label>
                                <input 
                                  value={adminRecoveredPassword}
                                  onChange={(e) => setAdminRecoveredPassword(e.target.value)}
                                  placeholder="Password baru/hasil"
                                  className="w-full bg-slate-100 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm font-bold font-mono"
                                />
                              </div>
                              <div className="grid grid-cols-1 gap-4">
                                <button 
                                  onClick={async () => {
                                    if (!adminRecoveredEmail || !adminRecoveredPassword) {
                                      showToast('Isi semua data hasil!', 'error');
                                      return;
                                    }
                                    await updateReportStatus(activeReportId!, { 
                                      status: ReportStatus.SELESAI,
                                      recoveredPassword: adminRecoveredPassword,
                                      message: `Gmail FF: Akun ${adminRecoveredEmail} telah berhasil dipulihkan dengan password berikut. Silakan cek dan klik BERHASIL jika sudah masuk.`
                                    });
                                    setAdminRecoveredEmail('');
                                    setAdminRecoveredPassword('');
                                    showToast('Data pemulihan dikirim ke user!');
                                    setActiveReportId(null);
                                  }}
                                  className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black italic uppercase tracking-widest hover:bg-orange-600 active:scale-95 transition-all shadow-lg shadow-orange-100"
                                >
                                  ✅ Kirim Hasil Pemulihan
                                </button>
                                <button 
                                  onClick={async () => {
                                    const reason = prompt("Alasan Gagal?");
                                    if (!reason) return;
                                    await updateReportStatus(activeReportId!, { 
                                      status: ReportStatus.GAGAL,
                                      message: `Gmail FF: Mohon maaf, pemulihan gagal. Alasan: ${reason}`
                                    });
                                    showToast('Status: GAGAL', 'error');
                                    setActiveReportId(null);
                                  }}
                                  className="w-full py-3 text-red-500 font-bold uppercase italic text-xs tracking-widest hover:bg-red-50 rounded-xl transition-all"
                                >
                                  ❌ Tandai Gagal
                                </button>
                                <button 
                                  onClick={async () => {
                                    const reason = "ID / Email Google Tidak Valid atau tidak ditemukan dalam sistem.";
                                    await updateReportStatus(activeReportId!, { 
                                      status: ReportStatus.GAGAL,
                                      message: `Gmail FF: Mohon maaf, pemulihan gagal. Alasan: ${reason}`
                                    });
                                    showToast('Gagal: Akun Tidak Valid', 'error');
                                    setActiveReportId(null);
                                  }}
                                  className="w-full py-2 text-slate-400 font-bold uppercase italic text-[10px] tracking-widest hover:bg-slate-50 rounded-xl transition-all"
                                >
                                  ⚠️ Akun Tidak Valid
                                </button>
                              </div>
                            </div>
                          )}

                          {activeReport?.status === ReportStatus.SELESAI && (
                            <div className="p-6 bg-green-50 border border-green-200 rounded-[2rem] text-center space-y-2">
                               <CheckCircle2 className="mx-auto text-green-600 mb-2" size={32} />
                               <h5 className="font-black italic uppercase tracking-widest text-green-700">Closed Case</h5>
                               <p className="text-xs text-green-600 font-bold opacity-80">User Feedback: {activeReport.userFeedback || 'No feedback yet'}</p>
                            </div>
                          )}

                          {activeReport?.status === ReportStatus.GAGAL && (
                            <div className="p-6 bg-red-50 border border-red-200 rounded-[2rem] text-center space-y-2">
                               <AlertCircle className="mx-auto text-red-600 mb-2" size={32} />
                               <h5 className="font-black italic uppercase tracking-widest text-red-700">Failed Case</h5>
                               <p className="text-xs text-red-600 font-bold opacity-80">{activeReport.message}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        
        {/* Bottom Navigation */}
        {!view.includes('auth') && (
          <div className="bg-white/90 backdrop-blur-xl border-t p-4 z-50 md:hidden flex justify-between px-8">
            <button 
              onClick={() => { setActiveTab('reports'); setIsAdminTab(false); }}
              className={`flex flex-col items-center gap-1 ${activeTab === 'reports' ? 'text-orange-500' : 'text-slate-400'}`}
            >
              <History size={20} />
              <span className="text-[10px] font-bold">Laporan</span>
            </button>
            <button 
              onClick={() => { setActiveTab('bind'); setIsAdminTab(false); }}
              className={`flex flex-col items-center gap-1 ${activeTab === 'bind' ? 'text-orange-500' : 'text-slate-400'}`}
            >
              <ShieldCheck size={20} />
              <span className="text-[10px] font-bold">Cek Bind</span>
            </button>
            <button 
              onClick={() => { setActiveTab('chat'); setIsAdminTab(false); }}
              className={`flex flex-col items-center gap-1 ${activeTab === 'chat' ? 'text-orange-500' : 'text-slate-400'}`}
            >
              <Send size={20} />
              <span className="text-[10px] font-bold">Global</span>
            </button>
            {currentUser?.role === UserRole.ADMIN && (
              <button 
                onClick={() => setIsAdminTab(!isAdminTab)}
                className={`flex flex-col items-center gap-1 ${isAdminTab ? 'text-orange-500' : 'text-slate-400'}`}
              >
                <Settings size={20} />
                <span className="text-[10px] font-bold">Admin</span>
              </button>
            )}
          </div>
        )}

        {/* Detail Location Modal */}
        <AnimatePresence>
          {selectedBindDetails && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setSelectedBindDetails(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="bg-slate-900 p-8 text-white relative">
                  <div className="absolute top-0 right-0 p-6">
                    <button 
                      onClick={() => setSelectedBindDetails(null)}
                      className="p-2 hover:bg-white/10 rounded-full transition-all"
                    >
                      <LogOut size={20} className="rotate-90" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                      <MapPin size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Detail Lokasi</h3>
                      <p className="text-xs text-slate-400">Informasi aktivitas login terakhir</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2 mb-2 opacity-60">
                         <ShieldCheck size={14} />
                         <span className="text-[10px] font-bold uppercase tracking-widest">Akun Target</span>
                      </div>
                      <p className="font-bold text-lg">{selectedBindDetails.accountName}</p>
                      <p className="text-sm text-slate-400">{selectedBindDetails.emailBind}</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasi Presisi</label>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                         <Globe size={18} className="text-orange-500 mt-0.5 shrink-0" />
                         <p className="text-sm font-bold text-slate-700 break-words leading-relaxed">
                           {selectedBindDetails.location || "Lokasi IP tidak terdeteksi secara otomatis"}
                         </p>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Device Terungkap</label>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                         <Smartphone size={18} className="text-slate-400 mt-0.5 shrink-0" />
                         <p className="text-sm font-bold text-slate-700">
                           {selectedBindDetails.device || "Informasi device tidak tersedia"}
                         </p>
                      </div>
                   </div>

                   <button 
                     onClick={() => setSelectedBindDetails(null)}
                     className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all"
                   >
                     Tutup Detail
                   </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
