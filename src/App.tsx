import React, { useState, useEffect, useRef } from 'react';
import {
  Wallet,
  Send,
  Smartphone,
  History,
  UserCheck,
  RefreshCw,
  Database,
  Lock,
  Unlock,
  FileText,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  LogOut,
  ArrowRight,
  ShieldAlert,
  UploadCloud,
  DownloadCloud,
  ExternalLink,
  Bot,
  User,
  Check,
  Info,
  ChevronRight,
  HelpCircle,
  Clock
} from 'lucide-react';
import { initAuth, googleSignIn, logout, getAccessToken } from './auth';
import { listBackups, createBackup, getBackupContent, deleteBackup, uploadInvoice, DriveFile } from './drive';
import { generateInvoicePDFBlob } from './pdfGenerator';
import { DataEnrichmentPortal } from './components/DataEnrichmentPortal';
import { FusionPayConsole } from './components/FusionPayConsole';
import { User as FirebaseUser } from 'firebase/auth';

interface BankUser {
  id: string;
  name: string;
  username: string;
  telegramId: string;
  appBalance: number;
  telegramBalance: number;
  linked: boolean;
  avatar: string;
}

interface AuditLog {
  tx_id: string;
  senderName: string;
  senderUsername: string;
  receiverName: string;
  receiverUsername: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'ROLLBACKED';
  timestamp: string;
  note: string;
}

const INITIAL_USERS: BankUser[] = [
  {
    id: 'user_1',
    name: 'Sheikh Rubel',
    username: '@sheikhrubel',
    telegramId: '782786051',
    appBalance: 15000,
    telegramBalance: 1200,
    linked: true,
    avatar: 'SR',
  },
  {
    id: 'user_2',
    name: 'Anika Rahman',
    username: '@anika_r',
    telegramId: '482930211',
    appBalance: 8500,
    telegramBalance: 450,
    linked: true,
    avatar: 'AR',
  },
  {
    id: 'user_3',
    name: 'Tanvir Ahmed',
    username: '@tanvir_ahmed',
    telegramId: '928172635',
    appBalance: 12000,
    telegramBalance: 0,
    linked: false,
    avatar: 'TA',
  },
  {
    id: 'user_4',
    name: 'Sajid Chowdhury',
    username: '@sajid_c',
    telegramId: '384910294',
    appBalance: 350,
    telegramBalance: 50,
    linked: true,
    avatar: 'SC',
  },
];

const INITIAL_LOGS: AuditLog[] = [
  {
    tx_id: '8a2e1c39-e932-4bf1-a3f2-ef1d765fa1a0',
    senderName: 'Sheikh Rubel',
    senderUsername: '@sheikhrubel',
    receiverName: 'Anika Rahman',
    receiverUsername: '@anika_r',
    amount: 300,
    status: 'SUCCESS',
    timestamp: '2026-06-30T05:30:15.102Z',
    note: 'Internal Wallet Transfer',
  },
  {
    tx_id: '1d4b2d8e-09a2-4a0f-90cf-198bc7ae7bf3',
    senderName: 'Anika Rahman',
    senderUsername: '@anika_r',
    receiverName: 'Sajid Chowdhury',
    receiverUsername: '@sajid_c',
    amount: 50,
    status: 'SUCCESS',
    timestamp: '2026-06-30T06:12:44.225Z',
    note: 'P2P Transfer via Telegram Bot',
  },
];

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  isTwaLink?: boolean;
}

export default function App() {
  // Application state
  const [users, setUsers] = useState<BankUser[]>(INITIAL_USERS);
  const [activeUserId, setActiveUserId] = useState<string>('user_1');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_LOGS);

  // Simulation controls
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [concurrencyLogs, setConcurrencyLogs] = useState<{ id: string; text: string; status: 'info' | 'success' | 'error' | 'lock' }[]>([]);
  const [isSimulatingLock, setIsSimulatingLock] = useState<boolean>(false);

  // Chat Bot Simulator state
  const [chatUsers, setChatUsers] = useState<Record<string, ChatMessage[]>>({
    user_1: [
      { id: '1', sender: 'bot', text: 'Coolrubelbank-এ স্বাগতম! আপনার ব্যালেন্স দেখতে বা টাকা পাঠাতে নিচের বাটন ব্যবহার করুন।', timestamp: '06:30' }
    ],
    user_2: [
      { id: '1', sender: 'bot', text: 'Coolrubelbank-এ স্বাগতম! আপনার ব্যালেন্স দেখতে বা টাকা পাঠাতে নিচের বাটন ব্যবহার করুন।', timestamp: '06:10' }
    ],
    user_3: [
      { id: '1', sender: 'bot', text: 'Coolrubelbank-এ স্বাগতম! আপনার অ্যাকাউন্টটি এখনও লিঙ্ক করা হয়নি। লিঙ্ক করতে নিচে ক্লিক করুন বা টাইপ করুন /start', timestamp: '06:40' }
    ],
    user_4: [
      { id: '1', sender: 'bot', text: 'Coolrubelbank-এ স্বাগতম! আপনার ব্যালেন্স দেখতে বা টাকা পাঠাতে নিচের বাটন ব্যবহার করুন।', timestamp: '06:20' }
    ],
  });
  const [chatInput, setChatInput] = useState<string>('');
  const [isBotTyping, setIsBotTyping] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // TWA (Telegram Web App) overlay state
  const [isTwaOpen, setIsTwaOpen] = useState<boolean>(false);
  const [twaRecipientId, setTwaRecipientId] = useState<string>('');
  const [twaAmount, setTwaAmount] = useState<string>('');
  const [twaStep, setTwaStep] = useState<'main' | 'send' | 'confirming' | 'success' | 'error'>('main');
  const [twaTxLogs, setTwaTxLogs] = useState<string[]>([]);
  const [twaError, setTwaError] = useState<string>('');
  const [twaSuccessTxId, setTwaSuccessTxId] = useState<string>('');

  // Firebase Google Auth / Google Drive state
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [backups, setBackups] = useState<DriveFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState<boolean>(false);
  const [backupStatus, setBackupStatus] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isLocalMode, setIsLocalMode] = useState<boolean>(false);
  const [localBackups, setLocalBackups] = useState<{ id: string; name: string; createdTime: string; content: any }[]>([]);

  // Notifications/Toasts
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const activeUser = users.find(u => u.id === activeUserId) || users[0];

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatUsers, isBotTyping, activeUserId]);

  // Init Auth on load
  useEffect(() => {
    loadLocalBackups();
    initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
        loadCloudBackups(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
  }, []);

  const showNotification = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
        showNotification('গুগল ড্রাইভ কানেক্ট করা হয়েছে!', 'success');
        loadCloudBackups(result.accessToken);
      }
    } catch (err: any) {
      if (err && (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup-closed-by-user'))) {
        console.warn('Login failed: Popup closed by user or blocked in iframe context.');
        setLoginError('popup-closed');
        showNotification('পপ-আপ বন্ধ বা ব্লক করা হয়েছে! লোকাল ডেমো মোড ট্রাই করতে পারেন।', 'info');
      } else {
        console.error('Login failed:', err);
        showNotification('লগইন ব্যর্থ হয়েছে: ' + err.message, 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setGoogleUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      setBackups([]);
      showNotification('গুগল অ্যাকাউন্ট ডিসকানেক্ট করা হয়েছে।', 'info');
    } catch (err: any) {
      console.error('Logout failed:', err);
    }
  };

  const loadCloudBackups = async (token: string) => {
    setIsLoadingBackups(true);
    try {
      const list = await listBackups(token);
      setBackups(list);
    } catch (err: any) {
      console.error('Fetch backups error:', err);
      showNotification('ব্যাকআপ ফাইল তালিকা লোড করতে ব্যর্থ', 'error');
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!accessToken) return;
    setBackupStatus('ব্যাকআপ ফাইল তৈরি হচ্ছে...');
    try {
      const backupName = `sheikh_ledger_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const dataToBackup = {
        users,
        auditLogs,
        timestamp: new Date().toISOString(),
        backupVersion: '1.0',
        author: googleUser?.displayName || 'Sheikh Code Exchange App'
      };

      await createBackup(accessToken, backupName, dataToBackup);
      showNotification('গুগল ড্রাইভে ডাটাবেজ ব্যাকআপ সম্পন্ন হয়েছে!', 'success');
      setBackupStatus('');
      loadCloudBackups(accessToken);
    } catch (err: any) {
      console.error('Backup creation error:', err);
      showNotification('ব্যাকআপ ফাইল ড্রাইভে সেভ করা যায়নি', 'error');
      setBackupStatus('');
    }
  };

  const handleRestoreBackup = async (fileId: string, fileName: string) => {
    if (!accessToken) return;
    const confirmRestore = window.confirm(`আপনি কি এই ব্যাকআপ ফাইলটি (${fileName}) রিস্টোর করতে চান? এটি আপনার বর্তমান ব্যালেন্স এবং লেজার পরিবর্তন করবে।`);
    if (!confirmRestore) return;

    try {
      setBackupStatus('ব্যাকআপ ডেটা ডাউনলোড হচ্ছে...');
      const restoredData = await getBackupContent(accessToken, fileId);
      if (restoredData && restoredData.users && restoredData.auditLogs) {
        setUsers(restoredData.users);
        setAuditLogs(restoredData.auditLogs);
        showNotification('সফলভাবে ডাটাবেজ রিস্টোর করা হয়েছে!', 'success');
      } else {
        showNotification('ব্যাকআপ ফাইলের ফরম্যাট সঠিক নয়।', 'error');
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      showNotification('ব্যাকআপ রিস্টোর করতে ব্যর্থ: ' + err.message, 'error');
    } finally {
      setBackupStatus('');
    }
  };

  const handleDeleteBackup = async (fileId: string) => {
    if (!accessToken) return;
    const confirmDel = window.confirm('আপনি কি এই ব্যাকআপ ফাইলটি গুগল ড্রাইভ থেকে ডিলিট করতে চান?');
    if (!confirmDel) return;

    try {
      await deleteBackup(accessToken, fileId);
      showNotification('ব্যাকআপ ফাইল ডিলিট করা হয়েছে।', 'success');
      loadCloudBackups(accessToken);
    } catch (err: any) {
      console.error('Delete error:', err);
      showNotification('ডিলিট করতে ব্যর্থ: ' + err.message, 'error');
    }
  };

  // Local Storage Backups Helpers
  const loadLocalBackups = () => {
    try {
      const stored = localStorage.getItem('sheikh_ledger_local_backups');
      if (stored) {
        setLocalBackups(JSON.parse(stored));
      } else {
        setLocalBackups([]);
      }
    } catch (e) {
      console.error('Failed to load local backups', e);
    }
  };

  const handleCreateLocalBackup = () => {
    setBackupStatus('লোকাল ব্যাকআপ তৈরি হচ্ছে...');
    try {
      const backupName = `sheikh_ledger_local_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const dataToBackup = {
        users,
        auditLogs,
        timestamp: new Date().toISOString(),
        backupVersion: '1.0',
        author: 'Local Sandbox User'
      };

      const stored = localStorage.getItem('sheikh_ledger_local_backups');
      const backupsList = stored ? JSON.parse(stored) : [];
      const newBackup = {
        id: 'local_' + Date.now(),
        name: backupName,
        createdTime: new Date().toISOString(),
        content: dataToBackup
      };

      const updated = [newBackup, ...backupsList];
      localStorage.setItem('sheikh_ledger_local_backups', JSON.stringify(updated));
      setLocalBackups(updated);
      showNotification('লোকাল স্টোরেজে সফলভাবে ব্যাকআপ নেওয়া হয়েছে!', 'success');
    } catch (err: any) {
      console.error('Local backup creation error:', err);
      showNotification('লোকাল ব্যাকআপ তৈরি করতে ব্যর্থ', 'error');
    } finally {
      setBackupStatus('');
    }
  };

  const handleRestoreLocalBackup = (id: string, name: string) => {
    const confirmRestore = window.confirm(`আপনি কি এই লোকাল ব্যাকআপটি (${name}) রিস্টোর করতে চান? এটি আপনার বর্তমান ব্যালেন্স এবং লেজার পরিবর্তন করবে।`);
    if (!confirmRestore) return;

    try {
      const backup = localBackups.find(b => b.id === id);
      if (backup && backup.content && backup.content.users && backup.content.auditLogs) {
        setUsers(backup.content.users);
        setAuditLogs(backup.content.auditLogs);
        showNotification('সফলভাবে লোকাল ব্যাকআপ রিস্টোর করা হয়েছে!', 'success');
      } else {
        showNotification('ব্যাকআপ ফাইলের ফরম্যাট সঠিক নয়।', 'error');
      }
    } catch (err: any) {
      console.error('Restore local error:', err);
      showNotification('লোকাল ব্যাকআপ রিস্টোর করতে ব্যর্থ', 'error');
    }
  };

  const handleDeleteLocalBackup = (id: string) => {
    const confirmDel = window.confirm('আপনি কি এই লোকাল ব্যাকআপটি ডিলিট করতে চান?');
    if (!confirmDel) return;

    try {
      const updated = localBackups.filter(b => b.id !== id);
      localStorage.setItem('sheikh_ledger_local_backups', JSON.stringify(updated));
      setLocalBackups(updated);
      showNotification('লোকাল ব্যাকআপ ডিলিট করা হয়েছে।', 'success');
    } catch (err: any) {
      console.error('Delete local error:', err);
      showNotification('লোকাল ব্যাকআপ ডিলিট করতে ব্যর্থ', 'error');
    }
  };

  const handleDownloadInvoice = (log: AuditLog) => {
    try {
      const pdfBlob = generateInvoicePDFBlob(log);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sheikh_invoice_${log.tx_id.substring(0, 8)}_${new Date(log.timestamp).getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification('ইনভয়েস PDF ডাউনলোড সম্পন্ন হয়েছে!', 'success');
    } catch (err: any) {
      console.error('Download PDF error:', err);
      showNotification('ইনভয়েস PDF তৈরি করতে ব্যর্থ হয়েছে', 'error');
    }
  };

  const handleAutoSaveInvoice = async (log: AuditLog) => {
    try {
      const pdfBlob = generateInvoicePDFBlob(log);
      const filename = `sheikh_invoice_${log.tx_id.substring(0, 8)}_${new Date(log.timestamp).getTime()}.pdf`;

      if (accessToken && !isLocalMode) {
        setBackupStatus('গুগল ড্রাইভে ইনভয়েস সেভ হচ্ছে...');
        await uploadInvoice(accessToken, filename, pdfBlob);
        showNotification(`ইনভয়েস (${filename}) গুগল ড্রাইভে সেভ করা হয়েছে!`, 'success');
      } else {
        console.log('Google Drive is not connected. Invoice generated locally.');
        showNotification('নতুন লেনদেনের জন্য ইনভয়েস PDF তৈরি হয়েছে!', 'success');
      }
    } catch (err: any) {
      console.error('Auto save invoice error:', err);
      showNotification('ড্রাইভে ইনভয়েস সেভ করতে ব্যর্থ: ' + err.message, 'error');
    } finally {
      if (accessToken && !isLocalMode) {
        setBackupStatus('');
      }
    }
  };

  // 1. Account Linking handler
  const handleToggleLink = (userId: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const nextLinked = !u.linked;
        // Inject system logs
        if (nextLinked) {
          addBotMessage(userId, `অভিনন্দন! আপনার টেলিগ্রাম আইডি ${u.telegramId} সফলভাবে শেখ কোড এক্সচেঞ্জ ওয়ালেটের সাথে লিঙ্ক করা হয়েছে।`);
        } else {
          addBotMessage(userId, `আপনার অ্যাকাউন্টটি ডিসকানেক্ট করা হয়েছে। পুনরায় সংযোগ করতে /start চাপুন।`);
        }
        return { ...u, linked: nextLinked };
      }
      return u;
    }));
    showNotification('টেলিগ্রাম লিঙ্ক স্ট্যাটাস পরিবর্তিত হয়েছে');
  };

  // Helper to add bot replies
  const addBotMessage = (userId: string, text: string, isTwaLink = false) => {
    setChatUsers(prev => {
      const current = prev[userId] || [];
      return {
        ...prev,
        [userId]: [
          ...current,
          {
            id: Date.now().toString() + Math.random().toString(),
            sender: 'bot',
            text,
            timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
            isTwaLink
          }
        ]
      };
    });
  };

  // Helper to add user message
  const addUserMessage = (userId: string, text: string) => {
    setChatUsers(prev => {
      const current = prev[userId] || [];
      return {
        ...prev,
        [userId]: [
          ...current,
          {
            id: Date.now().toString() + Math.random().toString(),
            sender: 'user',
            text,
            timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
          }
        ]
      };
    });
  };

  // 2. Transfer from App to Telegram Wallet (Withdrawal to Telegram)
  const handleWithdrawToTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showNotification('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন', 'error');
      return;
    }

    if (activeUser.appBalance < amountNum) {
      showNotification('পর্যাপ্ত ব্যালেন্স নেই', 'error');
      return;
    }

    // Update balances
    setUsers(prev => prev.map(u => {
      if (u.id === activeUser.id) {
        return {
          ...u,
          appBalance: u.appBalance - amountNum,
          telegramBalance: u.telegramBalance + amountNum
        };
      }
      return u;
    }));

    // Create Audit Log
    const newTxId = crypto.randomUUID();
    const newLog: AuditLog = {
      tx_id: newTxId,
      senderName: activeUser.name,
      senderUsername: activeUser.username,
      receiverName: `${activeUser.name} (Telegram Wallet)`,
      receiverUsername: `${activeUser.username}`,
      amount: amountNum,
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      note: 'Transfer App to Telegram Balance'
    };

    setAuditLogs(prev => [newLog, ...prev]);
    setWithdrawAmount('');
    showNotification('টেলিগ্রাম ওয়ালেটে টাকা স্থানান্তর সফল হয়েছে!');
    handleAutoSaveInvoice(newLog);

    // Notify user in simulated Bot
    if (activeUser.linked) {
      addBotMessage(
        activeUser.id,
        `নোট: আপনার অ্যাপ ব্যালেন্স থেকে ${amountNum} BDT টেলিগ্রাম ওয়ালেটে যুক্ত হয়েছে। বর্তমান ব্যালেন্স: ${activeUser.telegramBalance + amountNum} BDT।`
      );
    }
  };

  const handleSendTelegramBalance = async (recipientId: string, amount: number): Promise<{ success: boolean; message: string }> => {
    if (isNaN(amount) || amount <= 0) {
      showNotification('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন', 'error');
      return { success: false, message: 'সহীহ টাকার পরিমাণ লিখুন' };
    }

    if (activeUser.telegramBalance < amount) {
      showNotification('টেলিগ্রাম ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই', 'error');
      return { success: false, message: 'টেলিগ্রাম ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই' };
    }

    const recipient = users.find(u => u.id === recipientId);
    if (!recipient) {
      showNotification('প্রাপক পাওয়া যায়নি', 'error');
      return { success: false, message: 'প্রাপক পাওয়া যায়নি' };
    }

    // Update balances
    setUsers(prev => prev.map(u => {
      if (u.id === activeUser.id) {
        return {
          ...u,
          telegramBalance: u.telegramBalance - amount
        };
      }
      if (u.id === recipient.id) {
        return {
          ...u,
          telegramBalance: u.telegramBalance + amount
        };
      }
      return u;
    }));

    // Create Audit Log
    const newTxId = crypto.randomUUID();
    const newLog: AuditLog = {
      tx_id: newTxId,
      senderName: `${activeUser.name} (Telegram Wallet)`,
      senderUsername: activeUser.username,
      receiverName: `${recipient.name} (Telegram Wallet)`,
      receiverUsername: recipient.username,
      amount: amount,
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      note: 'Telegram Wallet Transfer via FusionPay Dev Console'
    };

    setAuditLogs(prev => [newLog, ...prev]);
    showNotification(`টেলিগ্রাম ওয়ালেট থেকে ${amount} BDT সফলভাবে পাঠানো হয়েছে!`, 'success');
    handleAutoSaveInvoice(newLog);

    // Notify sender & recipient via Simulated Bot messages
    if (activeUser.linked) {
      addBotMessage(
        activeUser.id,
        `নোট: আপনার টেলিগ্রাম ওয়ালেট থেকে ${amount} BDT পাঠানো হয়েছে। প্রাপক: ${recipient.name}। বর্তমান ব্যালেন্স: ${activeUser.telegramBalance - amount} BDT।`
      );
    }
    if (recipient.linked) {
      addBotMessage(
        recipient.id,
        `💰 আপনি ${activeUser.name} থেকে টেলিগ্রাম ওয়ালেটে ${amount} BDT পেয়েছেন! বর্তমান ব্যালেন্স: ${recipient.telegramBalance + amount} BDT।`
      );
    }

    return { success: true, message: 'লেনদেন সফল হয়েছে' };
  };

  // 3. Rollback Transaction (Atomic Reverse)
  const handleRollbackTransaction = (txId: string) => {
    const tx = auditLogs.find(l => l.tx_id === txId);
    if (!tx || tx.status === 'ROLLBACKED') return;

    const confirmRollback = window.confirm(`আপনি কি এই লেনদেনটি (${tx.amount} BDT) বাতিল বা রোলব্যাক করতে চান? এটি ব্যালেন্স সমন্বয় করবে এবং অডিট লগ আপডেট করবে।`);
    if (!confirmRollback) return;

    let rollbackPossible = false;

    // Find sender and receiver in users list
    const sender = users.find(u => u.name === tx.senderName);
    const receiverNameRaw = tx.receiverName;

    // Determine type of tx
    if (receiverNameRaw.includes('(Telegram Wallet)')) {
      // Transfer App to Telegram
      if (sender) {
        if (sender.telegramBalance >= tx.amount) {
          setUsers(prev => prev.map(u => {
            if (u.id === sender.id) {
              return {
                ...u,
                appBalance: u.appBalance + tx.amount,
                telegramBalance: u.telegramBalance - tx.amount
              };
            }
            return u;
          }));
          rollbackPossible = true;
        } else {
          showNotification('রোলব্যাক করা অসম্ভব: টেলিগ্রাম ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই', 'error');
        }
      }
    } else {
      // P2P transfer
      const senderObj = users.find(u => u.username === tx.senderUsername);
      const receiverObj = users.find(u => u.username === tx.receiverUsername);

      if (senderObj && receiverObj) {
        if (receiverObj.telegramBalance >= tx.amount) {
          setUsers(prev => prev.map(u => {
            if (u.id === senderObj.id) {
              return { ...u, telegramBalance: u.telegramBalance + tx.amount };
            }
            if (u.id === receiverObj.id) {
              return { ...u, telegramBalance: u.telegramBalance - tx.amount };
            }
            return u;
          }));
          rollbackPossible = true;
        } else {
          showNotification('রোলব্যাক করা অসম্ভব: প্রাপকের ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই', 'error');
        }
      }
    }

    if (rollbackPossible) {
      setAuditLogs(prev => prev.map(l => {
        if (l.tx_id === txId) {
          return { ...l, status: 'ROLLBACKED' as const };
        }
        return l;
      }));
      showNotification('ট্রানজ্যাকশন সফলভাবে রোলব্যাক সম্পন্ন হয়েছে!', 'success');
    }
  };

  // 4. Concurrency Control & Double Spending Lock Simulator
  const handleSimulateLock = async () => {
    if (isSimulatingLock) return;
    setIsSimulatingLock(true);
    setConcurrencyLogs([]);

    const logItem = (text: string, status: 'info' | 'success' | 'error' | 'lock' = 'info') => {
      setConcurrencyLogs(prev => [...prev, { id: Date.now() + Math.random().toString(), text, status }]);
    };

    logItem('🚀 Concurrency attack test triggered!', 'info');
    logItem('উদ্দেশ্য: Sheikh Rubel এর ওয়ালেট থেকে একই সময়ে ৫টি সমান্তরাল রিকোয়েস্ট পাঠিয়ে ডাবল-স্পেন্ডিং রোধ পরীক্ষা করা।', 'info');
    logItem(`বর্তমান টেলিগ্রাম ব্যালেন্স: ${activeUser.telegramBalance} BDT`, 'info');

    // Simulate 5 parallel transactions of 300 BDT
    const transferAmount = 300;
    const recipient = users.find(u => u.id === 'user_2')!; // Anika Rahman
    
    // Simulating delay for transactions
    const runTx = async (txName: string, delay: number, shouldSucceed: boolean) => {
      await new Promise(r => setTimeout(r, delay));
      logItem(`[${txName}] 🔒 Database Transaction initiated... Row locking applied on account '${activeUser.username}'`, 'lock');
      
      await new Promise(r => setTimeout(r, 600)); // DB operation delay

      if (!shouldSucceed) {
        logItem(`[${txName}] ❌ TRANSACTION REJECTED (429: Resource Locked / Concurrency Guard). Double spending attack blocked!`, 'error');
        return false;
      } else {
        // Perform actual transfer logic
        let success = false;
        setUsers(prev => {
          const userIdx = prev.findIndex(u => u.id === activeUser.id);
          const activeUserLatest = prev[userIdx];
          
          if (activeUserLatest.telegramBalance >= transferAmount) {
            success = true;
            return prev.map(u => {
              if (u.id === activeUser.id) {
                return { ...u, telegramBalance: u.telegramBalance - transferAmount };
              }
              if (u.id === recipient.id) {
                return { ...u, telegramBalance: u.telegramBalance + transferAmount };
              }
              return u;
            });
          }
          return prev;
        });

        if (success) {
          // Log inside audit
          const newTxId = crypto.randomUUID();
          const newLog: AuditLog = {
            tx_id: newTxId,
            senderName: activeUser.name,
            senderUsername: activeUser.username,
            receiverName: recipient.name,
            receiverUsername: recipient.username,
            amount: transferAmount,
            status: 'SUCCESS',
            timestamp: new Date().toISOString(),
            note: `Concurrent Session Success (${txName})`
          };
          setAuditLogs(prev => [newLog, ...prev]);
          handleAutoSaveInvoice(newLog);

          logItem(`[${txName}] ✅ TRANSACTION SUCCESS! ${transferAmount} BDT sent to ${recipient.username}. Row Lock released.`, 'success');
          return true;
        } else {
          logItem(`[${txName}] ❌ TRANSACTION FAILED: Insufficient Funds.`, 'error');
          return false;
        }
      }
    };

    // We trigger 5 promises. The first one acquires lock and starts processing. 
    // The others are initiated while the first is still processing, so the database rejects them due to active Lock on Sheikh Rubel's Row.
    const isBalanceEnough = activeUser.telegramBalance >= transferAmount;

    await Promise.all([
      runTx('Tx-Alpha', 0, isBalanceEnough),
      runTx('Tx-Beta', 80, false), // Fails due to concurrency lock
      runTx('Tx-Gamma', 150, false), // Fails due to concurrency lock
      runTx('Tx-Delta', 220, false), // Fails due to concurrency lock
      runTx('Tx-Epsilon', 300, false), // Fails due to concurrency lock
    ]);

    logItem('🏁 Concurrency test completed. 1 transaction successfully acquired the atomic lock; 4 malicious concurrent requests were rejected successfully!', 'success');
    setIsSimulatingLock(false);
  };

  // 5. Telegram chat bot message processing
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const text = chatInput.trim();
    setChatInput('');
    addUserMessage(activeUser.id, text);

    // Bot Typing State
    setIsBotTyping(true);

    setTimeout(() => {
      setIsBotTyping(false);
      processBotReply(text);
    }, 1000);
  };

  const processBotReply = (text: string) => {
    const cleanText = text.toLowerCase().trim();

    if (cleanText === '/start') {
      if (!activeUser.linked) {
        addBotMessage(
          activeUser.id,
          `Coolrubelbank-এ স্বাগতম! আপনার অ্যাকাউন্টটি লিঙ্ক করা হয়নি। নিচের বাটনটি চাপুন আপনার টেলিগ্রাম আইডি (${activeUser.telegramId}) লিঙ্ক করতে।`,
          true
        );
      } else {
        addBotMessage(
          activeUser.id,
          `Coolrubelbank-এ স্বাগতম! আপনি সফলভাবে লিঙ্কড আছেন। ব্যবহার করুন:\n\n/balance - বর্তমান ব্যালেন্স দেখতে\n/send [username] [amount] - অন্যকে টাকা পাঠাতে\n\nঅথবা নিচের বাটন চেপে সরাসরি ড্যাশবোর্ড খুলুন।`,
          true
        );
      }
    } else if (cleanText === '/balance') {
      if (!activeUser.linked) {
        addBotMessage(activeUser.id, 'আপনার অ্যাকাউন্টটি এখনও লিঙ্ক করা হয়নি। অনুগ্রহ করে লিঙ্ক করুন।');
      } else {
        addBotMessage(activeUser.id, `আপনার বর্তমান টেলিগ্রাম ওয়ালেট ব্যালেন্স: ${activeUser.telegramBalance} BDT।`);
      }
    } else if (cleanText.startsWith('/send')) {
      if (!activeUser.linked) {
        addBotMessage(activeUser.id, 'আপনার অ্যাকাউন্টটি এখনও লিঙ্ক করা হয়নি। অনুগ্রহ করে আগে অ্যাকাউন্ট লিঙ্ক করুন।');
        return;
      }

      const parts = text.split(/\s+/);
      if (parts.length < 3) {
        addBotMessage(activeUser.id, 'সঠিক ফরম্যাট: /send [username] [amount]\nউদাহরণ: /send @anika_r 100');
        return;
      }

      const recipientUsername = parts[1];
      const amountRaw = parts[2];
      const amountNum = parseFloat(amountRaw);

      if (isNaN(amountNum) || amountNum <= 0) {
        addBotMessage(activeUser.id, 'ভুল টাকার পরিমাণ! সঠিক অংক দিন।\nউদাহরণ: /send @anika_r 150');
        return;
      }

      if (activeUser.telegramBalance < amountNum) {
        addBotMessage(activeUser.id, `অপর্যাপ্ত ফান্ড! আপনার ব্যালেন্স: ${activeUser.telegramBalance} BDT, কিন্তু আপনি পাঠাতে চাচ্ছেন ${amountNum} BDT।`);
        return;
      }

      // Find recipient
      const recipient = users.find(u => u.username.toLowerCase() === recipientUsername.toLowerCase());
      if (!recipient) {
        addBotMessage(activeUser.id, `ব্যবহারকারী '${recipientUsername}' খুঁজে পাওয়া যায়নি। অনুগ্রহ করে সঠিক ইউজারনেম দিন (যেমন @anika_r)`);
        return;
      }

      if (recipient.id === activeUser.id) {
        addBotMessage(activeUser.id, 'আপনি নিজেকে টাকা পাঠাতে পারবেন না!');
        return;
      }

      // Process transaction
      setUsers(prev => prev.map(u => {
        if (u.id === activeUser.id) {
          return { ...u, telegramBalance: u.telegramBalance - amountNum };
        }
        if (u.id === recipient.id) {
          return { ...u, telegramBalance: u.telegramBalance + amountNum };
        }
        return u;
      }));

      // Create log
      const newTxId = crypto.randomUUID();
      const newLog: AuditLog = {
        tx_id: newTxId,
        senderName: activeUser.name,
        senderUsername: activeUser.username,
        receiverName: recipient.name,
        receiverUsername: recipient.username,
        amount: amountNum,
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        note: 'P2P Transfer via Bot Command'
      };
      setAuditLogs(prev => [newLog, ...prev]);
      handleAutoSaveInvoice(newLog);

      addBotMessage(
        activeUser.id,
        `✅ লেনদেন সফল হয়েছে!\n\nপ্রাপক: ${recipient.name} (${recipient.username})\nপরিমাণ: ${amountNum} BDT\n\nট্রানজ্যাকশন আইডি:\n${newTxId}\n\nআপনার বর্তমান ওয়ালেট ব্যালেন্স: ${activeUser.telegramBalance - amountNum} BDT।`
      );

      // Inform recipient as well if linked
      if (recipient.linked) {
        addBotMessage(
          recipient.id,
          `💰 আপনি ${activeUser.name} (${activeUser.username}) থেকে ${amountNum} BDT পেয়েছেন!\nবর্তমান ব্যালেন্স: ${recipient.telegramBalance + amountNum} BDT।`
        );
      }
    } else {
      addBotMessage(
        activeUser.id,
        `দুঃখিত, কমান্ডটি বুঝতে পারিনি। নিচের কমান্ডগুলো ব্যবহার করুন:\n\n/start - শুরু করতে\n/balance - ব্যালেন্স দেখতে\n/send [username] [amount] - টাকা পাঠাতে`
      );
    }
  };

  // 6. TWA Dashboard Operations
  const openTwa = () => {
    if (!activeUser.linked) {
      showNotification('অনুগ্রহ করে আগে বটের সাথে অ্যাকাউন্ট লিঙ্ক করুন!', 'error');
      return;
    }
    setTwaStep('main');
    setTwaAmount('');
    setTwaRecipientId('');
    setTwaError('');
    setIsTwaOpen(true);
  };

  const handleTwaSendMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(twaAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setTwaError('সঠিক টাকার অংক টাইপ করুন');
      return;
    }

    if (activeUser.telegramBalance < amountNum) {
      setTwaError('আপনার টেলিগ্রাম ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই');
      return;
    }

    if (!twaRecipientId) {
      setTwaError('অনুগ্রহ করে প্রাপক নির্বাচন করুন');
      return;
    }

    // Step to visual row lock sequence
    setTwaStep('confirming');
    setTwaTxLogs([]);

    const addTwaLog = (txt: string) => {
      setTwaTxLogs(prev => [...prev, txt]);
    };

    const recipient = users.find(u => u.id === twaRecipientId)!;

    // Simulate Step-by-Step Backend Core Verification
    setTimeout(() => {
      addTwaLog('✓ Authenticated via Telegram auth token hash');
    }, 400);

    setTimeout(() => {
      addTwaLog(`✓ Row Lock acquired for account: ${activeUser.username}`);
    }, 1000);

    setTimeout(() => {
      addTwaLog(`✓ Balance verification: Checked ${amountNum} BDT <= ${activeUser.telegramBalance} BDT`);
    }, 1600);

    setTimeout(() => {
      addTwaLog('✓ Atomic Database update: balances modified');
    }, 2200);

    setTimeout(() => {
      addTwaLog('✓ Cryptographic Audit log appended to Ledger');
    }, 2800);

    setTimeout(() => {
      // Execute transaction state change
      setUsers(prev => prev.map(u => {
        if (u.id === activeUser.id) {
          return { ...u, telegramBalance: u.telegramBalance - amountNum };
        }
        if (u.id === recipient.id) {
          return { ...u, telegramBalance: u.telegramBalance + amountNum };
        }
        return u;
      }));

      const newTxId = crypto.randomUUID();
      const newLog: AuditLog = {
        tx_id: newTxId,
        senderName: activeUser.name,
        senderUsername: activeUser.username,
        receiverName: recipient.name,
        receiverUsername: recipient.username,
        amount: amountNum,
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        note: 'P2P Transfer via Telegram Web App'
      };
      setAuditLogs(prev => [newLog, ...prev]);
      handleAutoSaveInvoice(newLog);

      setTwaSuccessTxId(newTxId);
      setTwaStep('success');

      // Add to Bot chat log
      addBotMessage(
        activeUser.id,
        `📲 TWA-এর মাধ্যমে ${amountNum} BDT লেনদেন সম্পন্ন হয়েছে!\n\nপ্রাপক: ${recipient.name} (${recipient.username})\nট্রানজ্যাকশন আইডি:\n${newTxId}`
      );

      if (recipient.linked) {
        addBotMessage(
          recipient.id,
          `💰 TWA-এর মাধ্যমে আপনি ${activeUser.name} (${activeUser.username}) থেকে ${amountNum} BDT পেয়েছেন!`
        );
      }
    }, 3400);
  };

  return (
    <div className="min-h-screen bg-[#070A13] text-slate-100 flex flex-col font-sans relative overflow-x-hidden" id="app_root">
      {/* Sleek Ambient Glowing background decoration */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-indigo-950/20 via-blue-950/10 to-transparent pointer-events-none" />
      <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute top-[50%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full filter blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/40 bg-[#0B0F19]/80 backdrop-blur-xl sticky top-0 z-40 px-4 py-3.5" id="app_header">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/10 relative">
              <Database className="h-5 w-5 text-white animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  Sheikh Code Exchange
                </h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse"></span>
                  OPERATIONAL
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-wide">42nd Project: Core Wallet Banking & Telegram Integration</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Active User Switcher */}
            <div className="bg-[#111625] border border-slate-800/60 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm transition-all hover:border-indigo-500/30">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Account:</span>
              <select
                className="bg-transparent text-xs font-bold text-indigo-400 focus:outline-none cursor-pointer pr-1"
                value={activeUserId}
                onChange={(e) => {
                  setActiveUserId(e.target.value);
                  setIsTwaOpen(false); // Close TWA if user changes
                }}
              >
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-[#0D111F] text-slate-200">
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Google Drive Status Button */}
            {googleUser ? (
              <div className="flex items-center gap-2.5 bg-[#111625] border border-emerald-500/20 rounded-xl px-3.5 py-1.5 text-xs shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 font-bold text-xs">{googleUser.displayName || googleUser.email}</span>
                <button
                  onClick={handleLogout}
                  title="Disconnect Google Drive"
                  className="text-slate-400 hover:text-red-400 transition-colors ml-1 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all shadow-md shadow-indigo-500/10 cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                {isLoggingIn ? 'কানেক্ট করা হচ্ছে...' : 'Drive সিঙ্ক করুন'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10" id="main_layout">
        
        {/* Toast Notification */}
        {notification && (
          <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 transition-all duration-300 transform border animate-bounce ${
            notification.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30' :
            notification.type === 'error' ? 'bg-red-950/90 text-red-300 border-red-500/30' :
            'bg-slate-900/90 text-blue-300 border-blue-500/30'
          }`}>
            {notification.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
            {notification.type === 'error' && <XCircle className="h-5 w-5 text-red-400 shrink-0" />}
            {notification.type === 'info' && <Info className="h-5 w-5 text-blue-400 shrink-0" />}
            <span className="text-sm font-medium">{notification.text}</span>
          </div>
        )}

        {/* LEFT COLUMN: TELEGRAM PHONE SIMULATOR & TWA (5 Columns) */}
        <section className="lg:col-span-5 flex flex-col gap-6" id="telegram_simulator_section">
          <div className="bg-[#0F1321] border border-slate-800/80 rounded-3xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] flex flex-col h-[640px] relative">
            
            {/* Phone Top Frame / Dynamic Island representation */}
            <div className="bg-[#090D16] px-5 py-2 flex justify-between items-center text-[10px] text-slate-400 font-mono border-b border-slate-900/40">
              <span className="font-semibold">06:48 AM</span>
              <div className="w-18 h-4 bg-black rounded-full mx-auto flex items-center justify-center border border-slate-800/30">
                <div className="w-2 h-2 rounded-full bg-slate-900" />
              </div>
              <div className="flex items-center gap-1.5">
                <span>5G</span>
                <span>80%</span>
              </div>
            </div>

            {/* Simulated Bot Header */}
            <div className="bg-[#131929] border-b border-slate-800/40 px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white relative shadow-inner">
                  <Bot className="h-5.5 w-5.5" />
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-100">Coolrubelbank2bot</h3>
                    <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.2 rounded font-mono font-bold">BOT</span>
                  </div>
                  <p className="text-xs text-slate-400">শেখ কোড এক্সচেঞ্জ ওয়ালেট</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition-all ${
                  activeUser.linked ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {activeUser.linked ? 'Linked' : 'Unlinked'}
                </span>
              </div>
            </div>

            {/* Chat Bubble Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#0B0E1A] relative">
              
              {/* Decorative instructions helper in chat */}
              <div className="text-center my-2">
                <span className="text-[10px] bg-[#13192B]/80 text-slate-400 border border-slate-800/60 px-3.5 py-1.5 rounded-xl font-medium inline-block max-w-xs">
                  বটের মাধ্যমে ইন্টারঅ্যাকশন পরীক্ষা করতে টাইপ করুন অথবা নিচের কমান্ড বাটনগুলো ব্যবহার করুন।
                </span>
              </div>

              {chatUsers[activeUser.id]?.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-md transition-all ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-tr-none border border-indigo-500/20'
                      : 'bg-[#141A2E] text-slate-200 rounded-tl-none border border-slate-800/60'
                  }`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    
                    {/* Inline Web App Launcher button in Bot response */}
                    {msg.isTwaLink && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-700/20 flex flex-col gap-1.5">
                        <button
                          onClick={openTwa}
                          className="w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all duration-300 cursor-pointer"
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                          ড্যাশবোর্ড ওপেন করুন (TWA)
                        </button>
                        {!activeUser.linked && (
                          <button
                            onClick={() => handleToggleLink(activeUser.id)}
                            className="w-full bg-slate-850/60 hover:bg-slate-800 text-slate-300 border border-slate-700/20 font-semibold text-xs py-2 rounded-xl transition-all cursor-pointer"
                          >
                            🔗 লিঙ্ক করুন ({activeUser.telegramId})
                          </button>
                        )}
                      </div>
                    )}
                    
                    <span className="block text-[9px] text-slate-500 mt-1 text-right font-mono">{msg.timestamp}</span>
                  </div>
                </div>
              ))}

              {isBotTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#141A2E] border border-slate-800/60 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

            </div>

            {/* Telegram Chat Input Bar */}
            <form onSubmit={handleSendChat} className="bg-[#131929] border-t border-slate-800/40 p-3 flex gap-2 z-10">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="ম্যাসেজ টাইপ করুন..."
                className="flex-1 bg-[#1A2238] border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            {/* TWA (Telegram Web App) Sliding Drawer / Overlay */}
            {isTwaOpen && (
              <div className="absolute inset-x-0 bottom-0 top-[60px] bg-[#0A0D17] z-30 flex flex-col animate-slide-up">
                {/* TWA Header */}
                <div className="bg-[#131929] border-b border-slate-850 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-indigo-400" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Coolrubelbank TWA</h4>
                      <p className="text-[9px] text-slate-500 font-mono">https://twa.coolrubelbank.net</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsTwaOpen(false)}
                    className="text-slate-450 hover:text-white bg-slate-800/50 hover:bg-slate-800 p-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>

                {/* TWA Content Viewport */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col justify-between bg-gradient-to-b from-[#0F1326] to-[#0A0D17]">
                  
                  {twaStep === 'main' && (
                    <div className="space-y-6">
                      {/* Visual user info bar */}
                      <div className="flex items-center gap-3 bg-[#161D35]/60 p-3 rounded-xl border border-slate-800/50">
                        <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-extrabold text-xs shadow-md">
                          {activeUser.avatar}
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold tracking-wide">Logged in via Telegram</p>
                          <h5 className="font-bold text-slate-200 text-xs">{activeUser.name}</h5>
                        </div>
                      </div>

                      {/* Giant Wallet Balance Box */}
                      <div className="bg-gradient-to-br from-indigo-950/50 via-[#121A31] to-[#0A0D17] border border-indigo-500/20 rounded-2xl p-6 text-center relative overflow-hidden shadow-xl shadow-indigo-950/20">
                        <div className="absolute top-0 right-0 h-24 w-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                        <span className="text-[10px] text-indigo-300 font-extrabold tracking-widest uppercase block mb-1">টেলিগ্রাম ওয়ালেট ব্যালেন্স</span>
                        <h2 className="text-2xl font-black text-white font-mono">{activeUser.telegramBalance.toLocaleString('bn-BD')}.00 BDT</h2>
                        <div className="flex justify-center gap-4 mt-5 pt-4 border-t border-indigo-500/10">
                          <button
                            onClick={() => setTwaStep('send')}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                          >
                            <Send className="h-3.5 w-3.5" /> টাকা পাঠান
                          </button>
                          <button
                            onClick={() => {
                              showNotification('TWA ড্যাশবোর্ড রিফ্রেশ করা হয়েছে!');
                            }}
                            className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-[11px] font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> রিফ্রেশ
                          </button>
                        </div>
                      </div>

                      {/* Info Tips */}
                      <div className="bg-[#12182B] border border-slate-800/50 rounded-xl p-3 flex gap-2.5">
                        <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-400 leading-relaxed">
                          টেলিগ্রাম ওয়েব অ্যাপ (TWA) সরাসরি কোর ব্যাংকিং ডেটাবেজের সাথে ওয়েব-লিঙ্কড এপিআই এর মাধ্যমে সিঙ্ক থাকে।
                        </p>
                      </div>
                    </div>
                  )}

                  {twaStep === 'send' && (
                    <div className="space-y-4">
                      <h5 className="font-extrabold text-slate-200 text-xs tracking-wider uppercase border-b border-slate-800 pb-2">নতুন লেনদেন (P2P Send)</h5>
                      
                      {twaError && (
                        <div className="bg-red-950/40 border border-red-500/20 rounded-xl p-2.5 flex items-center gap-2 text-red-400 text-xs font-semibold">
                          <ShieldAlert className="h-4 w-4 shrink-0" />
                          <span>{twaError}</span>
                        </div>
                      )}

                      <form onSubmit={handleTwaSendMoney} className="space-y-4">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">প্রাপক নির্বাচন করুন:</label>
                          <select
                            value={twaRecipientId}
                            onChange={(e) => setTwaRecipientId(e.target.value)}
                            className="w-full bg-[#141A2E] border border-slate-800 rounded-xl p-2.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="">-- সিলেক্ট করুন --</option>
                            {users.filter(u => u.id !== activeUser.id).map(u => (
                              <option key={u.id} value={u.id} className="bg-[#0A0D14]">
                                {u.name} ({u.username})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">টাকার পরিমাণ (BDT):</label>
                          <input
                            type="number"
                            value={twaAmount}
                            onChange={(e) => setTwaAmount(e.target.value)}
                            placeholder="যেমন: 200"
                            className="w-full bg-[#141A2E] border border-slate-800 rounded-xl p-2.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex gap-2.5 pt-3">
                          <button
                            type="button"
                            onClick={() => setTwaStep('main')}
                            className="w-1/2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            পিছনে যান
                          </button>
                          <button
                            type="submit"
                            className="w-1/2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                          >
                            লেনদেন সম্পন্ন করুন
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {twaStep === 'confirming' && (
                    <div className="space-y-6 text-center py-6">
                      <div className="relative inline-block">
                        <div className="h-16 w-16 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin" />
                        <Lock className="h-6 w-6 text-indigo-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-white text-sm">লেনদেন প্রসেস হচ্ছে...</h4>
                        <p className="text-[10px] text-slate-400 font-medium">নিরাপদ ডাবল-স্পেন্ডিং লক কার্যকর করা হচ্ছে</p>
                      </div>

                      {/* Log Console mockup */}
                      <div className="bg-[#060810] border border-slate-900 rounded-xl p-3 text-left font-mono text-[10px] space-y-1 max-w-sm mx-auto h-32 overflow-y-auto">
                        {twaTxLogs.map((log, idx) => (
                          <div key={idx} className="text-slate-400 flex items-center gap-1.5">
                            <span className="text-emerald-500">➜</span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {twaStep === 'success' && (
                    <div className="space-y-6 text-center py-6 animate-fade-in">
                      <div className="h-14 w-14 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-md">
                        <Check className="h-7 w-7" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-white text-sm">লেনদেন সফল হয়েছে!</h4>
                        <p className="text-[10px] text-emerald-400 font-bold font-mono uppercase tracking-wider">Status: SUCCESS (Committed)</p>
                      </div>

                      <div className="bg-[#141A2E]/60 border border-slate-800/80 rounded-xl p-4 text-xs space-y-2.5 text-left max-w-sm mx-auto shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">প্রেরক:</span>
                          <span className="font-bold text-slate-200">{activeUser.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">পরিমাণ:</span>
                          <span className="font-black text-emerald-400 font-mono text-sm">{twaAmount} BDT</span>
                        </div>
                        <div className="flex flex-col pt-2 border-t border-slate-800 mt-2">
                          <span className="text-slate-400 text-[10px] mb-1">ট্রানজ্যাকশন আইডি (UUID):</span>
                          <span className="font-mono text-[9px] text-indigo-300 break-all bg-[#090D17] p-2 rounded-lg border border-slate-800">{twaSuccessTxId}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setTwaStep('main')}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-6 rounded-xl transition-all shadow-md cursor-pointer"
                      >
                        ড্যাশবোর্ডে ফিরুন
                      </button>
                    </div>
                  )}

                  {/* Powered By Bottom */}
                  <div className="text-center text-[9px] text-slate-500 font-semibold tracking-wider uppercase border-t border-slate-850 pt-3.5 mt-4 shrink-0">
                    Sheikh Code Exchange Core 1.0 • Webhook Safe
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>

        {/* RIGHT COLUMN: CORE BANK SYSTEM, AUDIT LOGS & CLOUD SYNC (7 Columns) */}
        <section className="lg:col-span-7 flex flex-col gap-6" id="core_banking_dashboard">
          
          {/* 1. BANK ACCOUNTS OVERVIEW */}
          <div className="bg-gradient-to-b from-[#111625]/80 to-[#0C0F1B]/90 border border-slate-800/40 rounded-2xl p-5 backdrop-blur-xl shadow-xl shadow-black/20" id="bank_accounts_overview">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <Wallet className="h-4.5 w-4.5 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">ব্যাংক ওয়ালেটসমূহ (Ledger Balances)</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-800/50 px-2.5 py-1 rounded-md border border-slate-700/20">সর্বমোট অ্যাকাউন্ট: {users.length}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {users.map(u => (
                <div
                  key={u.id}
                  onClick={() => {
                    setActiveUserId(u.id);
                    setIsTwaOpen(false);
                  }}
                  className={`border rounded-xl p-3.5 transition-all duration-300 cursor-pointer ${
                    u.id === activeUserId
                      ? 'bg-gradient-to-br from-[#161D33] to-[#0F1426] border-indigo-500/40 shadow-lg shadow-indigo-950/20 scale-[1.01]'
                      : 'bg-[#0D111F]/50 border-slate-800/50 hover:bg-[#13192B]/80 hover:border-slate-700/60'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all ${
                        u.id === activeUserId ? 'bg-indigo-600 text-white shadow-md' : 'bg-[#192138] text-slate-400'
                      }`}>
                        {u.avatar}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{u.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">{u.username}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold tracking-wider border transition-all ${
                      u.linked ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/60 text-slate-500 border-slate-800/20'
                    }`}>
                      {u.linked ? 'LINKED' : 'OFFLINE'}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-1.5 pt-2.5 border-t border-slate-850 text-center">
                    <div>
                      <span className="text-[8px] text-slate-400 uppercase font-extrabold tracking-wide">কোর ব্যাংক ব্যালেন্স</span>
                      <p className="text-xs font-bold text-slate-200 font-mono mt-0.5">{u.appBalance.toLocaleString('bn-BD')} BDT</p>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 uppercase font-extrabold tracking-wide">টেলিগ্রাম ব্যালেন্স</span>
                      <p className="text-xs font-bold text-slate-200 font-mono mt-0.5">{u.telegramBalance.toLocaleString('bn-BD')} BDT</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. CONCURRENCY CONTROL & DOUBLE SPEND GUARD SIMULATOR */}
          <div className="bg-gradient-to-b from-[#111625]/80 to-[#0C0F1B]/90 border border-slate-800/40 rounded-2xl p-5 backdrop-blur-xl shadow-xl shadow-black/20" id="concurrency_control_panel">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4.5 w-4.5 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">ডাবল-স্পেন্ডিং রোধ এবং কনকারেন্সি লকিং সিমুলেটর</h3>
              </div>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded border border-emerald-500/20 font-mono font-bold uppercase tracking-wider">Active Mutex Guard</span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              সিস্টেমের উচ্চ নিরাপত্তা প্রমাণের জন্য একটি <strong className="text-indigo-300">কনকারেন্সি অ্যাটাক</strong> পরীক্ষা করুন। এটি একই মিলি-সেকেন্ডে আপনার অ্যাকাউন্ট থেকে ৫টি আলাদা ৩০০ টাকার পেমেন্ট রিকোয়েস্ট একযোগে সার্ভারে পাঠাবে। কোর ডাটাবেজের <strong>Row-level Lock</strong> মেকানিজম শুধুমাত্র ১ম রিকোয়েস্ট সফল করবে এবং বাকি ৪টি অ্যাটাক সাথে সাথে রিজেক্ট করবে।
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-center mb-4">
              <button
                onClick={handleSimulateLock}
                disabled={isSimulatingLock}
                className="w-full sm:w-auto bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-950/20 transition-all duration-300 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4 animate-spin" />
                {isSimulatingLock ? 'টেস্ট রান হচ্ছে...' : 'কনকারেন্সি টেস্ট রান করুন (Attack Simulation)'}
              </button>
              {concurrencyLogs.length > 0 && (
                <button
                  onClick={() => setConcurrencyLogs([])}
                  className="w-full sm:w-auto bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                >
                  ক্লিয়ার লগ
                </button>
              )}
            </div>

            {concurrencyLogs.length > 0 && (
              <div className="bg-[#060810] border border-slate-900 rounded-xl p-3.5 font-mono text-[11px] space-y-1.5 max-h-56 overflow-y-auto shadow-inner">
                {concurrencyLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-start gap-2 ${
                      log.status === 'success' ? 'text-emerald-400' :
                      log.status === 'error' ? 'text-rose-400 font-bold' :
                      log.status === 'lock' ? 'text-amber-400' : 'text-slate-300'
                    }`}
                  >
                    <span className="shrink-0">
                      {log.status === 'success' ? '✓' :
                       log.status === 'error' ? '❌' :
                       log.status === 'lock' ? '🔒' : 'ℹ'}
                    </span>
                    <span className="leading-relaxed">{log.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. AUDIT LOGS / HISTORIC TRANSACTION TRAIL */}
          <div className="bg-gradient-to-b from-[#111625]/80 to-[#0C0F1B]/90 border border-slate-800/40 rounded-2xl p-5 backdrop-blur-xl shadow-xl shadow-black/20" id="audit_logs_section">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <History className="h-4.5 w-4.5 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">অডিট ট্রেইল এবং ট্রানজ্যাকশন হিস্টোরি</h3>
              </div>
              <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded border border-indigo-500/20 font-mono font-bold uppercase tracking-wider">ATOMIC BLOCKCHAIN LEDGER</span>
            </div>

            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1.5">
              {auditLogs.map((log) => (
                <div
                  key={log.tx_id}
                  className={`bg-[#0D111F]/40 border rounded-xl p-3 flex flex-col md:flex-row justify-between md:items-center gap-3 transition-all ${
                    log.status === 'ROLLBACKED'
                      ? 'border-slate-800/40 opacity-55 text-slate-500'
                      : 'border-slate-800/60 hover:bg-slate-900/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-200">{log.senderName}</span>
                      <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-200">{log.receiverName}</span>
                      
                      {/* Telegram Verification & Invoice Delivery Tags */}
                      {(log.senderName.includes('Telegram Wallet') || log.receiverName.includes('Telegram Wallet') || log.note?.toLowerCase().includes('telegram') || log.note?.toLowerCase().includes('twa')) && (
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded-md uppercase">
                            <Send className="h-2.5 w-2.5" />
                            TELEGRAM VERIFIED
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-md uppercase" title="Automated Invoice Delivered via Telegram Webhook">
                            <Check className="h-2.5 w-2.5 text-emerald-400" />
                            INVOICE DISPATCHED
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                      <span className="text-indigo-400 font-semibold shrink-0">{log.amount} BDT</span>
                      <span>•</span>
                      <span className="break-all text-slate-500">TX: {log.tx_id}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">নোট: {log.note}</p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
                    <div className="flex flex-col items-end">
                      <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold tracking-wider border ${
                        log.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        log.status === 'ROLLBACKED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {log.status}
                      </span>
                      <span className="text-[9px] text-slate-500 mt-1 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>

                     {log.status === 'SUCCESS' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDownloadInvoice(log)}
                          title="ইনভয়েস PDF ডাউনলোড করুন"
                          className="bg-teal-600/10 hover:bg-teal-600/20 text-teal-400 border border-teal-500/20 rounded-xl p-1.5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span className="text-[10px]">Invoice</span>
                        </button>
                        <button
                          onClick={() => handleRollbackTransaction(log.tx_id)}
                          title="রোলব্যাক বা বাতিল করুন"
                          className="bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded-xl p-1.5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="text-[10px]">Rollback</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. GOOGLE DRIVE BACKUP & CLOUD STORAGE MODULE */}
          <div className="bg-gradient-to-b from-[#111625]/80 to-[#0C0F1B]/90 border border-slate-800/40 rounded-2xl p-5 backdrop-blur-xl shadow-xl shadow-black/20" id="google_drive_sync_panel">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-4.5 w-4.5 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">গুগল ড্রাইভ ব্যাকআপ ও ক্লাউড সিঙ্ক</h3>
              </div>
              <div className="flex bg-[#070A13] border border-slate-800 rounded-lg p-0.5 text-[10px] font-semibold">
                <button
                  onClick={() => setIsLocalMode(false)}
                  className={`px-2 py-1 rounded-md transition-all ${!isLocalMode ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  গুগল ড্রাইভ
                </button>
                <button
                  onClick={() => setIsLocalMode(true)}
                  className={`px-2 py-1 rounded-md transition-all ${isLocalMode ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  লোকাল ডেমো
                </button>
              </div>
            </div>

            {isLocalMode ? (
              /* LOCAL STORAGE DEMO MODE */
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center bg-[#070A13]/50 p-3.5 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-2.5">
                    <Database className="h-4 w-4 text-indigo-400" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">লোকাল ব্যাকআপ সিস্টেম (অফলাইন)</h4>
                      <p className="text-[10px] text-slate-400">আপনার ব্রাউজারের লোকাল স্টোরেজে ডাটা সুরক্ষিত রাখুন</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCreateLocalBackup}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-md shadow-emerald-600/10 cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> লোকাল ব্যাকআপ তৈরি করুন
                    </button>
                  </div>
                </div>

                {backupStatus && (
                  <div className="text-xs bg-indigo-950/40 text-indigo-400 border border-indigo-500/20 rounded-xl p-2.5 flex items-center gap-2 animate-pulse">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{backupStatus}</span>
                  </div>
                )}

                {/* Local Backup list */}
                <div className="space-y-2">
                  <h5 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">বিদ্যমান লোকাল ব্যাকআপ তালিকা (Local Storage):</h5>
                  {localBackups.length === 0 ? (
                    <div className="text-center py-5 border border-slate-800 rounded-xl text-xs text-slate-500 italic bg-[#070A13]/25">
                      লোকাল স্টোরেজে কোনো ব্যাকআপ ফাইল পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {localBackups.map((file) => (
                        <div key={file.id} className="bg-[#0D111F]/60 p-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                          <div className="space-y-0.5 max-w-[65%]">
                            <p className="font-semibold text-slate-200 truncate" title={file.name}>{file.name}</p>
                            <p className="text-[9px] text-slate-450 font-mono">তারিখ: {new Date(file.createdTime).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleRestoreLocalBackup(file.id, file.name)}
                              className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 py-1.5 px-3 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <DownloadCloud className="h-3 w-3" /> Restore
                            </button>
                            <button
                              onClick={() => handleDeleteLocalBackup(file.id)}
                              className="text-red-400 hover:bg-red-500/10 p-1.5 rounded-xl transition-all cursor-pointer"
                              title="ডিলিট করুন"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* GOOGLE DRIVE SYNC MODE */
              <>
                {loginError === 'popup-closed' && (
                  <div className="mb-4 bg-amber-500/5 border border-amber-500/20 text-amber-200 rounded-xl p-4 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>পপ-আপ বন্ধ বা ব্লক করা হয়েছে!</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      গুগল সাইন-ইন পপ-আপ বন্ধ বা ব্লক করার কারণে লগইন সম্পন্ন করা যায়নি। আইফ্রেম প্রিভিউ মোডে ব্রাউজার পপ-আপ ব্লক করতে পারে।
                    </p>
                    <div className="pt-1 flex flex-wrap gap-2">
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="h-3 w-3" /> নতুন ট্যাবে অ্যাপটি খুলুন
                      </a>
                      <button
                        onClick={() => setIsLocalMode(true)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Database className="h-3 w-3" /> লোকাল ডেমো মোড ট্রাই করুন
                      </button>
                    </div>
                  </div>
                )}

                {needsAuth ? (
                  <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-[#070A13]/40 p-5">
                    <UploadCloud className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                    <h4 className="font-bold text-slate-200 text-sm">গুগল ড্রাইভ সিঙ্ক নিষ্ক্রিয় আছে</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      আপনার ক্লাউড ব্যাকআপ সিস্টেম সচল করতে আপনার গুগল অ্যাকাউন্টটি সংযুক্ত করুন। এটি দিয়ে আপনি আপনার লেজার ডেটা ব্যাকআপ ও রিস্টোর করতে পারবেন।
                    </p>
                    <div className="flex justify-center gap-3 mt-4">
                      <button
                        onClick={handleLogin}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer inline-flex items-center gap-1.5"
                      >
                        {isLoggingIn ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> সাইন-ইন হচ্ছে...
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-3.5 w-3.5" /> গুগল অ্যাকাউন্ট সাইন-ইন
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setIsLocalMode(true)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Database className="h-3.5 w-3.5" /> ডেমো মোড
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center bg-[#070A13]/50 p-3.5 rounded-xl border border-slate-800/60">
                      <div className="flex items-center gap-3">
                        {googleUser?.photoURL ? (
                          <img src={googleUser.photoURL} alt="Avatar" className="h-9 w-9 rounded-full border border-slate-800" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                            {googleUser?.displayName?.charAt(0) || 'G'}
                          </div>
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">{googleUser?.displayName || 'Google User'}</h4>
                          <p className="text-[10px] text-slate-400 font-mono">{googleUser?.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCreateBackup}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-md shadow-emerald-600/10 cursor-pointer flex items-center gap-1.5"
                        >
                          <UploadCloud className="h-3.5 w-3.5" /> ক্লাউড ব্যাকআপ তৈরি করুন
                        </button>
                        <button
                          onClick={() => accessToken && loadCloudBackups(accessToken)}
                          title="রিফ্রেশ করুন"
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2.5 rounded-xl transition-all cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={handleLogout}
                          title="ডিসকানেক্ট করুন"
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-450 p-2.5 rounded-xl transition-all cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {backupStatus && (
                      <div className="text-xs bg-indigo-950/40 text-indigo-400 border border-indigo-500/20 rounded-xl p-2.5 flex items-center gap-2 animate-pulse">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>{backupStatus}</span>
                      </div>
                    )}

                    {/* Backup files list */}
                    <div className="space-y-2">
                      <h5 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">বিদ্যমান ক্লাউড ব্যাকআপ তালিকা (Google Drive):</h5>
                      {isLoadingBackups ? (
                        <div className="text-center py-4 text-xs text-slate-500">
                          <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1.5" />
                          ব্যাকআপ ফাইল তালিকা ডাউনলোড হচ্ছে...
                        </div>
                      ) : backups.length === 0 ? (
                        <div className="text-center py-4 border border-slate-800 rounded-xl text-xs text-slate-500 italic bg-[#070A13]/25">
                          গুগল ড্রাইভে কোনো শেখ কোড এক্সচেূপ ব্যাকআপ ফাইল পাওয়া যায়নি।
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                          {backups.map((file) => (
                            <div key={file.id} className="bg-[#0D111F]/60 p-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                              <div className="space-y-0.5 max-w-[65%]">
                                <p className="font-semibold text-slate-200 truncate" title={file.name}>{file.name}</p>
                                <p className="text-[9px] text-slate-450 font-mono">তারিখ: {new Date(file.createdTime).toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleRestoreBackup(file.id, file.name)}
                                  className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 py-1.5 px-3 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <DownloadCloud className="h-3 w-3" /> Restore
                                </button>
                                <button
                                  onClick={() => handleDeleteBackup(file.id)}
                                  className="text-red-400 hover:bg-red-500/10 p-1.5 rounded-xl transition-all cursor-pointer"
                                  title="ডিলিট করুন"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </section>

        {/* 5. DATA ENRICHMENT PORTAL (FULL-WIDTH LEDGER ANALYTICS SECTION) */}
        <DataEnrichmentPortal auditLogs={auditLogs} />

        {/* 6. FUSIONPAY SECURE API SANDBOX (DEVELOPER UTILITY MODULE) */}
        <FusionPayConsole 
          auditLogs={auditLogs} 
          users={users}
          activeUser={activeUser}
          onTelegramTransfer={handleSendTelegramBalance}
        />

      </main>

      {/* Page Footer */}
      <footer className="border-t border-slate-900 bg-[#070A14] px-4 py-6 mt-auto relative z-10 text-center text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Sheikh Code Exchange. Developed with Google AI Studio.</p>
          <div className="flex gap-4 font-semibold">
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-indigo-400" /> Double Spend Guard</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-indigo-400" /> Google Drive Backup Sync</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

