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
  Chrome
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, UserRole, Report, ReportStatus, AppState } from './types';
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
  serverTimestamp,
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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
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

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'auth' | 'dashboard'>('auth');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Form states
  const [googleLama, setGoogleLama] = useState('');
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
    } else {
      setView('auth');
    }
  }, [currentUser]);

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

      await addDoc(collection(db, 'reports'), newReport);
      setGoogleLama('');
      showToast('Laporan dikirim!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reports');
    }
  };

  const updateReportStatus = async (id: string, updates: Partial<Report>) => {
    try {
      const reportRef = doc(db, 'reports', id);
      await updateDoc(reportRef, { ...updates, updatedAt: Date.now() });
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
          {currentUser && (
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
            >
              <LogOut size={20} />
            </button>
          )}
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

            {/* View: User Dashboard */}
            {view === 'dashboard' && currentUser?.role === UserRole.USER && (
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
                    <h3 className="font-bold truncate">{currentUser.email}</h3>
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

            {/* View: Admin Dashboard */}
            {view === 'dashboard' && currentUser?.role === UserRole.ADMIN && (
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
        
        {/* Navigation / Status Bar simulation for extra mobile feel */}
        {!view.includes('auth') && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-white/80 backdrop-blur-md flex items-center justify-center">
            <div className="w-24 h-1 bg-slate-300 rounded-full" />
          </div>
        )}

        <AnimatePresence>
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
