import React, { useState, useEffect, useRef, FormEvent, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { GoogleGenAI } from '@google/genai';
import { 
  Calendar as CalendarIcon, 
  User, 
  LogOut, 
  Mic, 
  Plus, 
  Filter, 
  ChevronRight, 
  MapPin, 
  Users, 
  TrendingUp, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  LayoutDashboard,
  Settings,
  Search,
  Edit3,
  X,
  Menu as MenuIcon,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Copy,
  Check,
  BookOpen,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Eye,
  RefreshCcw,
  Sparkles,
  Zap,
  Megaphone
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  where,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  increment,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './lib/error-logging';
import { logger } from './lib/logger';

// --- Components ---

const Logo = ({ className = "w-12 h-12", onClick }: { className?: string, onClick?: () => void }) => (
  <svg className={`${className} ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(50, 50)">
      {/* Petals - Refined to match the elegant pointed shape in the image */}
      <path d="M0 0 C8 -15 12 -30 0 -48 C-12 -30 -8 -15 0 0" fill="#E2E8F0" /> {/* Top: Grey */}
      <path d="M0 0 C8 -15 12 -30 0 -48 C-12 -30 -8 -15 0 0" fill="#EF4444" transform="rotate(45)" /> {/* Top-Right: Red */}
      <path d="M0 0 C8 -15 12 -30 0 -48 C-12 -30 -8 -15 0 0" fill="#22C55E" transform="rotate(90)" /> {/* Right: Green */}
      <path d="M0 0 C8 -15 12 -30 0 -48 C-12 -30 -8 -15 0 0" fill="#F97316" transform="rotate(135)" /> {/* Bottom-Right: Orange */}
      <path d="M0 0 C8 -15 12 -30 0 -48 C-12 -30 -8 -15 0 0" fill="#FACC15" transform="rotate(180)" /> {/* Bottom: Yellow */}
      <path d="M0 0 C8 -15 12 -30 0 -48 C-12 -30 -8 -15 0 0" fill="#3B82F6" transform="rotate(225)" /> {/* Bottom-Left: Blue */}
      <path d="M0 0 C8 -15 12 -30 0 -48 C-12 -30 -8 -15 0 0" fill="#06B6D4" transform="rotate(270)" /> {/* Left: Cyan */}
      <path d="M0 0 C8 -15 12 -30 0 -48 C-12 -30 -8 -15 0 0" fill="#A855F7" transform="rotate(315)" /> {/* Top-Left: Purple */}
      
      {/* Central dots - yellow triangle, slightly smaller and tighter */}
      <circle cx="0" cy="-3.5" r="1.8" fill="#FACC15" />
      <circle cx="-3" cy="1.5" r="1.8" fill="#FACC15" />
      <circle cx="3" cy="1.5" r="1.8" fill="#FACC15" />
    </g>
  </svg>
);

// --- Types ---

interface Event {
  id: string;
  title: string;
  speakerName: string;
  speakerId?: string;
  location: string;
  branch: string;
  startTime: any;
  endTime?: any;
  category: string;
  color: string;
  registeredCount: number;
  maxParticipants: number;
  description?: string;
  price?: number;
  discounts?: string;
  access?: string;
  format?: 'Онлайн' | 'Оффлайн';
  sessionsCount?: number;
  sessionDates?: any[];
  status?: 'planned' | 'active' | 'completed' | 'cancelled';
  createdAt?: any;
  baseExpenses?: {
    rent: number;
    speakerFee: number;
    marketing: number;
    other: number;
  };
  totalRevenue?: number;
  totalExpenses?: number;
  netProfit?: number;
  additionalExpenses?: number;
  expenseList?: { name: string, amount: number }[];
}

interface Registration {
  id: string;
  userId: string;
  eventId: string;
  status: 'registered' | 'attended' | 'cancelled';
  paid: boolean;
  totalPrice: number;
  amountPaid: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod?: 'cash' | 'card';
  participantName?: string;
  registrationDate: any;
}

interface FinanceRecord {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  eventId?: string;
  userId?: string;
  branch?: string;
  managerId?: string;
  description?: string;
  date: any;
}

interface UserProfile {
  uid: string;
  role: 'admin' | 'speaker' | 'participant';
  displayName: string;
  email: string;
  lastName?: string;
  firstName?: string;
  patronymic?: string;
  academyStatus?: 'Мастер' | 'Магистр' | 'Ученик' | 'Новый' | 'Постоянный' | 'Слушатель' | 'Студент' | 'Выпускник';
  branch?: string;
  bonusBalance?: number;
  referrerId?: string;
}

const BRANCHES = ['Все филиалы', 'Екатеринбург', 'Москва', 'Санкт-Петербург', 'Новосибирск', 'Казань'];
const CATEGORIES = ['Семинары', 'Практики', 'Вебинары', 'Курсы', 'Ретриты', 'Путешествия', 'Все направления'];
const PERIODS = ['Месяц', 'Квартал', 'Год', 'Произвольный'];

function getEventDate(startTime: any): Date {
  if (!startTime) return new Date();
  let date: Date;
  if (typeof startTime.toDate === 'function') {
    date = startTime.toDate();
  } else if (startTime instanceof Date) {
    date = startTime;
  } else if (startTime.seconds !== undefined) {
    date = new Date(startTime.seconds * 1000);
  } else {
    date = new Date(startTime);
  }
  
  return isNaN(date.getTime()) ? new Date() : date;
}

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Что-то пошло не так.";
      try {
        if (this.state.error?.message) {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error) {
            errorMessage = `Ошибка Firestore: ${parsedError.error} (${parsedError.operationType} на ${parsedError.path})`;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl border border-red-100 text-center">
            <div className="w-20 h-20 bg-red-100 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} />
            </div>
            <h2 className="text-2xl font-black mb-4">Упс! Ошибка</h2>
            <p className="text-slate-500 mb-8 font-medium leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-logo-blue transition-all"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'schedule' | 'admin' | 'profile' | 'event-input' | 'participant-card'>('schedule');
  const [events, setEvents] = useState<Event[]>([]);
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [allUserProfiles, setAllUserProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<'List' | 'Calendar'>('List');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [pendingEventForRules, setPendingEventForRules] = useState<Event | null>(null);
  const [pendingEventAfterLogin, setPendingEventAfterLogin] = useState<Event | null>(null);
  const [showUserFinanceModal, setShowUserFinanceModal] = useState(false);
  const [showAdminEventModal, setShowAdminEventModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [recognizedIdentity, setRecognizedIdentity] = useState<{ uid?: string, fullName: string, email: string } | null>(null);
  const [selectedEventForFinance, setSelectedEventForFinance] = useState<Event | null>(null);
  const [sessionAnchorDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === 'il17184@gmail.com';

  // Filter States
  const [filterTitle, setFilterTitle] = useState('');
  const [filterSpeaker, setFilterSpeaker] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const resetFilters = () => {
    setFilterTitle('');
    setFilterSpeaker('');
    setFilterLocation('');
    setFilterBranch('Все филиалы');
    setFilterCategory('Семинары');
    setFilterPeriod('Месяц');
    setFilterDateFrom('');
    setFilterDateTo('');
  };
  const [filterLocation, setFilterLocation] = useState('');
  const [filterBranch, setFilterBranch] = useState('Все филиалы');
  const [filterCategory, setFilterCategory] = useState('Семинары');
  const [filterPeriod, setFilterPeriod] = useState('Месяц');
  const [showFilters, setShowFilters] = useState(true);

  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [registeringEventId, setRegisteringEventId] = useState<string | null>(null);

  // Body scroll lock for overlays
  useEffect(() => {
    const isOverlayOpen = view !== 'schedule' || showAuthModal || isMobileMenuOpen;
    if (isOverlayOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [view, showAuthModal, isMobileMenuOpen]);

  // Capture Referral ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferrerId(ref);
      // Clean up URL
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u);
        if (u) {
          const profileDoc = await getDoc(doc(db, 'users', u.uid));
          let currentProfile: UserProfile | null = null;
          if (profileDoc.exists()) {
            const data = profileDoc.data() as UserProfile;
            if (u.email === 'il17184@gmail.com' && data.role !== 'admin') {
              currentProfile = { ...data, role: 'admin' as const };
              await setDoc(doc(db, 'users', u.uid), currentProfile, { merge: true });
            } else {
              currentProfile = data;
            }
          } else {
            currentProfile = {
              uid: u.uid,
              displayName: u.displayName || 'Anonymous',
              email: u.email || '',
              role: u.email === 'il17184@gmail.com' ? 'admin' : 'participant',
              bonusBalance: 0,
              ...(referrerId ? { referrerId } : {})
            };
            await setDoc(doc(db, 'users', u.uid), {
              ...currentProfile,
              createdAt: serverTimestamp()
            });
          }
          setProfile(currentProfile);
          
          // Save identity to device
          if (currentProfile) {
            localStorage.setItem('app_user_identity', JSON.stringify({
              uid: currentProfile.uid,
              fullName: currentProfile.firstName ? `${currentProfile.lastName} ${currentProfile.firstName}` : currentProfile.displayName,
              email: currentProfile.email
            }));
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth profile error:", err);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [referrerId]);

  // Load recognized identity from device
  useEffect(() => {
    const saved = localStorage.getItem('app_user_identity') || localStorage.getItem('last_participant');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRecognizedIdentity({
          uid: parsed.uid,
          fullName: parsed.fullName || `${parsed.lastName || ''} ${parsed.firstName || ''}`.trim(),
          email: parsed.email
        });
      } catch (e) {
        console.error("Failed to parse identity", e);
      }
    }
  }, []);

  // Continue registration after successful login
  useEffect(() => {
    if (user && pendingEventAfterLogin) {
      const eventToReg = pendingEventAfterLogin;
      setPendingEventAfterLogin(null);
      handleRegister(eventToReg);
    }
  }, [user, pendingEventAfterLogin]);

  // Firestore Listener for Events
  useEffect(() => {
    try {
      const q = query(collection(db, 'events'), orderBy('startTime', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const evs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
        setEvents(evs);
        setGlobalError(null);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'events');
      });
      return unsubscribe;
    } catch (err) {
      setGlobalError(`Критическая ошибка: ${err instanceof Error ? err.message : String(err)}`);
      return () => {};
    }
  }, []);

  // Firestore Listener for Finance
  useEffect(() => {
    if (!isAdmin) {
      setFinanceRecords([]);
      return;
    }
    try {
      const q = query(collection(db, 'finance'), orderBy('date', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinanceRecord));
        setFinanceRecords(records);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'finance');
      });
      return unsubscribe;
    } catch (err) {
      logger.log('Finance Listener Error', err);
      return () => {};
    }
  }, [isAdmin]);

  // Firestore Listener for Participants
  useEffect(() => {
    if (!isAdmin) {
      setParticipants([]);
      setParticipantsCount(0);
      return;
    }
    try {
      const q = query(collection(db, 'participants'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setParticipants(data);
        setParticipantsCount(snapshot.size);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'participants');
      });
      return unsubscribe;
    } catch (err) {
      logger.log('Participants Listener Error', err);
      return () => {};
    }
  }, [isAdmin]);

  // Firestore Listener for All User Profiles (Admin Only)
  useEffect(() => {
    if (!isAdmin) {
      setAllUserProfiles([]);
      return;
    }
    try {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setAllUserProfiles(users);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
      });
      return unsubscribe;
    } catch (err) {
      logger.log('Users Listener Error', err);
      return () => {};
    }
  }, [isAdmin]);

  // Firestore Listener for Registrations
  useEffect(() => {
    if (!user) {
      setRegistrations([]);
      return;
    }
    try {
      const q = isAdmin 
        ? query(collection(db, 'registrations'), orderBy('registrationDate', 'desc'))
        : query(collection(db, 'registrations'), where('userId', '==', user.uid));
        
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const regs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
        // Critical: Only update state if the array actually changed or we got fresh data
        setRegistrations(regs);
      }, (err) => {
        // If Permission Denied occurs, it means the security rules are blocking us
        if (err.message.includes('permission-denied')) {
          console.warn("Registrations listener permission issue. This might be temporary during profile creation.");
        } else {
          handleFirestoreError(err, OperationType.LIST, 'registrations');
        }
      });
      return unsubscribe;
    } catch (err) {
      logger.log('Registrations Listener Error', err);
      return () => {};
    }
  }, [user, isAdmin]);

  const seedMockData = async () => {
    const mockEvents = [
      {
        title: "Семинар 'Второе рождение'",
        speakerId: "olga-vorotnikova",
        speakerName: "Ольга Николаевна Воротникова",
        location: "Оффлайн",
        branch: "Все филиалы",
        startTime: new Date(2026, 3, 4, 10, 0),
        endTime: new Date(2026, 3, 5, 18, 0),
        price: 0,
        category: "Семинар",
        color: "var(--color-logo-purple)",
        registeredCount: 0,
        maxParticipants: 30,
        status: "planned",
        description: "Возможность участия с детьми."
      },
      {
        title: "Семинар 'Тайский энерго-восстанавливающий массаж'",
        speakerId: "tatyana-novoselova",
        speakerName: "Татьяна Новоселова",
        location: "Оффлайн",
        branch: "Все филиалы",
        startTime: new Date(2026, 3, 3, 10, 0),
        endTime: new Date(2026, 3, 5, 18, 0),
        price: 32000,
        category: "Семинар",
        color: "var(--color-logo-green)",
        registeredCount: 0,
        maxParticipants: 20,
        status: "planned",
        description: "Стоимость до 15.03 - 28000, с 16.03 - 30000, в день семинара - 32000."
      },
      {
        title: "Вебинар 'Астральные путешествия'",
        speakerId: "olga-vorotnikova",
        speakerName: "Ольга Николаевна Воротникова",
        location: "Онлайн",
        branch: "Все филиалы",
        startTime: new Date(2026, 3, 7, 19, 0),
        endTime: new Date(2026, 3, 7, 21, 0),
        price: 0,
        category: "Вебинар",
        color: "var(--color-logo-blue)",
        registeredCount: 0,
        maxParticipants: 100,
        status: "planned",
        description: "Оплата за донат. ❤️"
      },
      {
        title: "Семинар 'Храм 2'",
        speakerId: "academy-master",
        speakerName: "Мастер Академии",
        location: "Оффлайн",
        branch: "Все филиалы",
        startTime: new Date(2026, 3, 11, 10, 0),
        endTime: new Date(2026, 3, 12, 18, 0),
        price: 0,
        category: "Семинар",
        color: "var(--color-logo-purple)",
        registeredCount: 0,
        maxParticipants: 20,
        status: "planned",
        description: "Допуск после экзамена."
      },
      {
        title: "Старт курса 'Астральные путешествия'",
        speakerId: "academy-master",
        speakerName: "Мастер Академии",
        location: "Онлайн",
        branch: "Все филиалы",
        startTime: new Date(2026, 3, 13, 19, 0),
        endTime: new Date(2026, 3, 13, 21, 0),
        price: 0,
        category: "Вебинар",
        color: "var(--color-logo-blue)",
        registeredCount: 0,
        maxParticipants: 50,
        status: "planned",
        description: "Длительность 2 месяца."
      },
      {
        title: "Фестиваль 'Психофест'",
        speakerId: "academy-team",
        speakerName: "Команда Академии",
        location: "Оффлайн",
        branch: "Все филиалы",
        startTime: new Date(2026, 3, 18, 10, 0),
        endTime: new Date(2026, 3, 18, 20, 0),
        price: 0,
        category: "Практика",
        color: "var(--color-logo-orange)",
        registeredCount: 0,
        maxParticipants: 1000,
        status: "planned",
        description: "Принимаем участие в фестивале."
      },
      {
        title: "Встреча 'Шаманский гипнотранс'",
        speakerId: "shaman-masters",
        speakerName: "Мастера Академии",
        location: "Оффлайн",
        branch: "Все филиалы",
        startTime: new Date(2026, 3, 25, 18, 0),
        endTime: new Date(2026, 3, 25, 21, 0),
        price: 15000,
        category: "Практика",
        color: "var(--color-logo-red)",
        registeredCount: 0,
        maxParticipants: 30,
        status: "planned",
        description: "Только для шаманов! 3 часа. Стоимость до 15.04 - 10000, позже - 13000, в день встречи - 15000."
      },
      {
        title: "Семинар 'Внутренняя свобода и кому мы служим'",
        speakerId: "academy-master",
        speakerName: "Мастер Академии",
        location: "Место уточняется",
        branch: "Все филиалы",
        startTime: new Date(2026, 3, 26, 11, 0),
        endTime: new Date(2026, 3, 27, 23, 0),
        price: 35000,
        category: "Семинар",
        color: "var(--color-logo-purple)",
        registeredCount: 0,
        maxParticipants: 40,
        status: "planned",
        description: "26 апреля 11:00-15:00, 27 апреля 19:00-23:00. Стоимость до 15.04 - 25000, позже - 30000, в день семинара - 35000. Доступ для всех!"
      },
      {
        title: "Расстановки с Владимиром Юрьевичем",
        speakerId: "vladimir-yuryevich",
        speakerName: "Владимир Юрьевич",
        location: "Оффлайн",
        branch: "Все филиалы",
        startTime: new Date(2026, 3, 25, 16, 0),
        endTime: new Date(2026, 3, 26, 20, 0),
        price: 50000,
        category: "Практика",
        color: "var(--color-logo-cyan)",
        registeredCount: 0,
        maxParticipants: 10,
        status: "planned",
        description: "Стоимость для заказчика 50000. Участие фигурой: 2000 за 1 раз, 5000 за все."
      },
      {
        title: "Семинар 'Храм 1'",
        speakerId: "tatyana-novoselova",
        speakerName: "Татьяна Новоселова",
        location: "Оффлайн",
        branch: "Все филиалы",
        startTime: new Date(2026, 3, 29, 10, 0),
        endTime: new Date(2026, 4, 1, 18, 0),
        price: 0,
        category: "Семинар",
        color: "var(--color-logo-purple)",
        registeredCount: 0,
        maxParticipants: 25,
        status: "planned",
        description: "Семинар с мастером Академии Татьяной Новоселовой."
      }
    ];

    try {
      setSeedStatus("Добавление...");
      for (const ev of mockEvents) {
        await addDoc(collection(db, 'events'), {
          ...ev,
          createdAt: serverTimestamp()
        });
      }
      setSeedStatus("Успешно!");
      setTimeout(() => setSeedStatus(null), 3000);
    } catch (err) {
      setSeedStatus("Ошибка");
      handleFirestoreError(err, OperationType.WRITE, 'events');
      setTimeout(() => setSeedStatus(null), 3000);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const loggedUser = result.user;
      
      // Ensure user document exists for role-based rules
      const userRef = doc(db, 'users', loggedUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: loggedUser.uid,
          displayName: loggedUser.displayName || 'Посетитель',
          email: loggedUser.email,
          role: 'participant',
          bonusBalance: 0,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleRegister = async (event: Event) => {
    if (!user) {
      setPendingEventAfterLogin(event);
      setShowAuthModal(true);
      return;
    }

    // Check if already registered (explicit check for 'registered' status)
    const activeReg = registrations.find(r => r.eventId === event.id && r.userId === user.uid && r.status === 'registered');
    if (activeReg) {
      return;
    }

    setRegisteringEventId(event.id);
    setPendingEventForRules(event);
    setShowRulesModal(true);
  };

  const finalizeRegistration = async () => {
    if (!pendingEventForRules || !user) {
      setRegisteringEventId(null);
      setShowRulesModal(false);
      return;
    }
    const eventForReg = pendingEventForRules;
    setRegisteringEventId(eventForReg.id);
    setShowRulesModal(false);
    
    try {
      const regId = `${user.uid}_${eventForReg.id}`;
      const batch = writeBatch(db);
      
      // 1. Set the registration document
      batch.set(doc(db, 'registrations', regId), {
        userId: user.uid,
        eventId: eventForReg.id,
        participantName: user.displayName || 'Anonymous',
        status: 'registered',
        paid: false,
        totalPrice: eventForReg.price || 0,
        amountPaid: 0,
        paymentStatus: 'unpaid',
        registrationDate: serverTimestamp()
      });

      // 2. Atomically increment the source-of-truth count in the event document
      batch.update(doc(db, 'events', eventForReg.id), {
        registeredCount: increment(1)
      });

      await batch.commit();
      setPendingEventForRules(null);
    } catch (err) {
      console.error("Registration error:", err);
      handleFirestoreError(err, OperationType.WRITE, `registrations/${user.uid}_${eventForReg.id}`);
    } finally {
      setRegisteringEventId(null);
    }
  };

  const handleCancelRegistration = async (eventToCancel: Event) => {
    if (!user) return;
    
    // Find the active registration to get its real Firestore ID
    const activeReg = registrations.find(r => r.eventId === eventToCancel.id && r.userId === user.uid && r.status === 'registered');
    if (!activeReg) return;

    setRegisteringEventId(eventToCancel.id);
    try {
      // Use writeBatch for atomicity to prevent UI flicker/state desync
      const batch = writeBatch(db);
      
      // 1. Mark the registration as cancelled using its TRUE ID
      batch.update(doc(db, 'registrations', activeReg.id), {
        status: 'cancelled',
        cancelledDate: serverTimestamp()
      });

      // 2. Decrement the event counter atomically
      batch.update(doc(db, 'events', eventToCancel.id), {
        registeredCount: increment(-1)
      });

      await batch.commit();
    } catch (err) {
      console.error("Cancellation error:", err);
      handleFirestoreError(err, OperationType.WRITE, `registrations/${activeReg.id}`);
    } finally {
      setRegisteringEventId(null);
    }
  };

  const filteredEvents = events.filter(event => {
    try {
      const eventDate = getEventDate(event.startTime);
      
      const matchesTitle = (event.title || '').toLowerCase().includes(filterTitle.toLowerCase());
      const matchesSpeaker = (event.speakerName || '').toLowerCase().includes(filterSpeaker.toLowerCase());
      const matchesLocation = (event.location || '').toLowerCase().includes(filterLocation.toLowerCase());
      const matchesBranch = filterBranch === 'Все филиалы' || event.branch === filterBranch;
      const matchesCategory = filterCategory === 'Все направления' || 
                             event.category === filterCategory ||
                             (filterCategory === 'Семинары' && event.category === 'Семинар') ||
                             (filterCategory === 'Практики' && event.category === 'Практика') ||
                             (filterCategory === 'Вебинары' && event.category === 'Вебинар') ||
                             (filterCategory === 'Курсы' && event.category === 'Курс') ||
                             (filterCategory === 'Ретриты' && event.category === 'Ретрит') ||
                             (filterCategory === 'Путешествия' && event.category === 'Путешествие');
      
      let matchesPeriod = true;
      const eventTime = eventDate.getTime();
      const anchorTime = sessionAnchorDate.getTime();

      if (filterPeriod === 'Месяц') {
        const oneMonthLater = new Date(sessionAnchorDate);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        matchesPeriod = eventTime >= anchorTime && eventTime < oneMonthLater.getTime();
      } else if (filterPeriod === 'Квартал') {
        const threeMonthsLater = new Date(sessionAnchorDate);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
        matchesPeriod = eventTime >= anchorTime && eventTime < threeMonthsLater.getTime();
      } else if (filterPeriod === 'Год') {
        const twelveMonthsLater = new Date(sessionAnchorDate);
        twelveMonthsLater.setFullYear(twelveMonthsLater.getFullYear() + 1);
        matchesPeriod = eventTime >= anchorTime && eventTime < twelveMonthsLater.getTime();
      } else if (filterPeriod === 'Произвольный') {
        // When custom is selected, we rely on the matchesDate logic below
        matchesPeriod = true;
      }
      
      let matchesDate = true;
      const compareDate = new Date(eventDate);
      compareDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const isDateRangeActive = filterDateFrom || filterDateTo;

      if (isDateRangeActive) {
        if (filterDateFrom) {
          const fromDate = new Date(filterDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (compareDate < fromDate) matchesDate = false;
        }
        if (filterDateTo) {
          const toDate = new Date(filterDateTo);
          toDate.setHours(0, 0, 0, 0);
          if (compareDate > toDate) matchesDate = false;
        }
      } else {
        // Default: only show events from today onwards
        if (compareDate < today) matchesDate = false;
      }
      
      return matchesTitle && matchesSpeaker && matchesLocation && matchesBranch && matchesCategory && matchesDate && matchesPeriod;
    } catch (err) {
      logger.log("Filter error", err);
      return false;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          <Logo className="w-16 h-16" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F8F9FB] font-sans text-slate-950 flex flex-col overflow-hidden">
      {/* --- HEADER --- */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-[100] shadow-sm overflow-hidden">
        <div className="w-full flex items-center px-4 md:px-[5%] py-3 md:py-4 gap-4">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
          >
            <MenuIcon size={24} />
          </button>
          <Logo className="w-10 h-10 md:w-14 md:h-14 shrink-0" onClick={() => setView('schedule')} />
          <h1 className="flex-1 text-[clamp(1.5rem,5vw,4rem)] font-black uppercase tracking-tighter text-blue-900 leading-none cursor-pointer truncate py-2" onClick={() => setView('schedule')}>
            Академия Развития Человека
          </h1>
        </div>
      </header>

      <div className="flex-1 flex max-w-[1600px] mx-auto w-full overflow-hidden">
        {/* --- SIDEBAR (Desktop) --- */}
        <aside className="w-[280px] bg-white border-r border-slate-200 p-8 flex flex-col gap-8 overflow-y-auto scrollbar-hide hidden lg:flex">
          <SidebarContent 
            view={view} 
            setView={setView} 
            profile={profile} 
            user={user}
            isAdmin={isAdmin}
            PERIODS={PERIODS} 
            filterPeriod={filterPeriod} 
            setFilterPeriod={setFilterPeriod}
            CATEGORIES={CATEGORIES}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            filterTitle={filterTitle}
            setFilterTitle={setFilterTitle}
            filterSpeaker={filterSpeaker}
            setFilterSpeaker={setFilterSpeaker}
            filterBranch={filterBranch}
            setFilterBranch={setFilterBranch}
            BRANCHES={BRANCHES}
            filterLocation={filterLocation}
            setFilterLocation={setFilterLocation}
            filterDateFrom={filterDateFrom}
            setFilterDateFrom={setFilterDateFrom}
            filterDateTo={filterDateTo}
            setFilterDateTo={setFilterDateTo}
            events={events}
            seedMockData={seedMockData}
            seedStatus={seedStatus}
            handleLogin={handleLogin}
            handleLogout={handleLogout}
          />
        </aside>

        {/* --- MAIN CONTENT --- */}
        <main className="flex-1 flex flex-col overflow-hidden p-6 md:p-12">
          <div className="w-full mb-12">
            <h2 className="text-4xl md:text-7xl font-black tracking-tighter uppercase border-b-4 border-slate-900 pb-4 w-full">
              Расписание
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide pb-12">
            {globalError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-center gap-3">
                <AlertCircle size={18} />
                {globalError}
              </div>
            )}

            <AnimatePresence mode="wait">
              {calendarView === 'List' ? (
                <motion.div 
                  key="list"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {filteredEvents.length > 0 ? (
                    filteredEvents.map(event => (
                      <EventRow 
                        key={event.id} 
                        event={event} 
                        user={user}
                        onRegister={() => handleRegister(event)}
                        onCancelRegister={() => handleCancelRegistration(event)}
                        onShowFinance={() => { 
                          setSelectedEventForFinance(event); 
                          setShowUserFinanceModal(true); 
                        }}
                        onShowAdminInfo={() => {
                          setSelectedEventForFinance(event);
                          setShowAdminEventModal(true);
                        }}
                        isRegistering={registeringEventId === event.id}
                        isAdmin={isAdmin}
                        registrations={registrations}
                        financeRecords={financeRecords}
                      />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                      <Search size={48} className="mb-4 opacity-20" />
                      <p className="text-lg font-bold">Событий не найдено</p>
                      <p className="text-sm mb-6">Попробуйте изменить параметры фильтрации</p>
                      
                      {events.length > 0 ? (
                        <div className="text-center">
                          <p className="text-xs text-slate-500 mb-4">
                            В базе есть {events.length} событий, но они не подходят под фильтры.
                          </p>
                          <button 
                            onClick={resetFilters}
                            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-sm font-bold transition-colors"
                          >
                            Сбросить все фильтры
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-xs text-slate-500 mb-4">
                            База данных пуста.
                          </p>
                          <button 
                            onClick={seedMockData}
                            disabled={seedStatus !== null}
                            className="px-6 py-2 bg-logo-blue text-white rounded-full text-sm font-bold transition-all hover:shadow-lg hover:shadow-logo-blue/20 disabled:opacity-50"
                          >
                            {seedStatus || "Добавить тестовые данные"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="calendar"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-xl shadow-slate-200/20"
                >
                  <p className="text-center py-24 text-slate-400 font-bold">Вид календаря в разработке...</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Admin/Profile/Public Overlays */}
      <AnimatePresence>
        {view === 'admin' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-white p-4 md:p-12 overflow-y-auto">
            <button onClick={() => setView('schedule')} className="absolute top-4 right-4 md:top-8 md:right-8 p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors z-10"><X size={24} /></button>
            <AdminPanel 
              events={events} 
              financeRecords={financeRecords} 
              registrations={registrations}
              participantsCount={participantsCount}
              allUserProfiles={allUserProfiles}
              leads={participants}
              user={user}
            />
          </motion.div>
        )}
        {view === 'profile' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-white p-4 md:p-12 overflow-y-auto flex items-center justify-center">
            <button onClick={() => setView('schedule')} className="absolute top-4 right-4 md:top-8 md:right-8 p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors z-10"><X size={24} /></button>
            <UserProfileView user={user!} profile={profile} />
          </motion.div>
        )}
        {view === 'event-input' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-white p-4 md:p-12 overflow-y-auto">
            <button onClick={() => setView('schedule')} className="absolute top-4 right-4 md:top-8 md:right-8 p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors z-10"><X size={24} /></button>
            <EventInputPublic events={events} onBack={() => setView('schedule')} />
          </motion.div>
        )}
        {view === 'participant-card' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <button 
                onClick={() => setView('schedule')} 
                className="absolute top-6 right-6 z-10 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
              <ParticipantCardPublic onBack={() => setView('schedule')} events={events} />
            </motion.div>
          </motion.div>
        )}

        {showAuthModal && (
          <AuthRequiredModal 
            onClose={() => setShowAuthModal(false)} 
            onLogin={() => { setShowAuthModal(false); handleLogin(); }}
            recognizedIdentity={recognizedIdentity}
            onResetIdentity={() => {
              localStorage.removeItem('app_user_identity');
              localStorage.removeItem('last_participant');
              setRecognizedIdentity(null);
            }}
          />
        )}

        {showRulesModal && pendingEventForRules && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white rounded-[40px] p-10 max-w-lg w-full shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                  <FileText size={24} />
                </div>
                <h2 className="text-2xl font-black tracking-tight uppercase tracking-tighter">Правила участия</h2>
              </div>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 mb-8 text-slate-600 leading-relaxed font-semibold">
                <p>Перед регистрацией на <strong>"{pendingEventForRules.title}"</strong> ознакомьтесь с правилами Академии:</p>
                <ul className="space-y-3 list-disc pl-5">
                  <li>Запись на мероприятие подтверждает ваше согласие с уставом.</li>
                  <li>Оплата должна быть в полном объеме до начала занятия.</li>
                  <li>Отмена участия возможна за 24 часа с сохранением оплаты на балансе.</li>
                  <li>Все материалы Академии охраняются авторским правом.</li>
                </ul>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3 mt-6">
                  <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-amber-600 uppercase font-black tracking-widest">Внимание: нажатие кнопки регистрации означает полное принятие данных правил.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={finalizeRegistration}
                  className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-bold hover:bg-logo-blue transition-all shadow-xl shadow-slate-200"
                >
                  Принимаю и записываюсь
                </button>
                <button 
                  onClick={() => { 
                    setShowRulesModal(false); 
                    setPendingEventForRules(null);
                    setRegisteringEventId(null);
                  }}
                  className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-all"
                >
                  Отмена
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showUserFinanceModal && selectedEventForFinance && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowUserFinanceModal(false)}>
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowUserFinanceModal(false)}
                className="absolute right-8 top-8 p-2 hover:bg-slate-50 rounded-xl"
              >
                <X size={20} className="text-slate-400" />
              </button>

              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-logo-blue animate-pulse" />
                  <p className="text-[10px] font-black uppercase text-logo-blue tracking-widest">Статус вашей записи</p>
                </div>
                <h2 className="text-2xl font-black leading-tight">{selectedEventForFinance.title}</h2>
              </div>

              {(() => {
                const reg = registrations.find(r => r.eventId === selectedEventForFinance.id && r.userId === user?.uid);
                if (!reg) return null;

                const currentEventFinance = financeRecords.filter(f => f.eventId === selectedEventForFinance.id && f.userId === user?.uid);
                const cashPaid = currentEventFinance.filter(f => f.category === 'Наличные' || f.description?.includes('наличными')).reduce((sum, f) => sum + f.amount, 0);
                const cardPaid = currentEventFinance.filter(f => f.category === 'Безналично' || f.description?.includes('безнал')).reduce((sum, f) => sum + f.amount, 0);
                const totalPaid = cashPaid + cardPaid;
                const unpaid = Math.max(0, (selectedEventForFinance.price || 0) - totalPaid);

                return (
                  <div className="space-y-6">
                    <div className={`p-6 rounded-3xl border flex items-center justify-between ${
                      reg.paymentStatus === 'paid' ? 'bg-green-50 border-green-100 text-green-700' :
                      reg.paymentStatus === 'partial' ? 'bg-yellow-50 border-yellow-100 text-yellow-700' :
                      'bg-red-50 border-red-100 text-red-700'
                    }`}>
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">Финансовый итог</p>
                        <p className="text-xl font-black uppercase tracking-tighter">
                          {reg.paymentStatus === 'paid' ? 'Оплачено полностью' :
                           reg.paymentStatus === 'partial' ? 'Оплачено частично' : 'Не оплачено'}
                        </p>
                      </div>
                      <ShieldCheck size={32} />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-xs font-black uppercase text-slate-400">Наличные</span>
                        <span className="text-lg font-black text-slate-900">{cashPaid.toLocaleString()} ₽</span>
                      </div>
                      <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-xs font-black uppercase text-slate-400">Безналично</span>
                        <span className="text-lg font-black text-slate-900">{cardPaid.toLocaleString()} ₽</span>
                      </div>
                      <div className="flex items-center justify-between p-5 bg-red-50 rounded-2xl border border-red-100">
                        <span className="text-xs font-black uppercase text-red-500">К оплате</span>
                        <span className="text-lg font-black text-red-600">{unpaid.toLocaleString()} ₽</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}

        {showAdminEventModal && selectedEventForFinance && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAdminEventModal(false)}>
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-slate-900 rounded-[40px] p-8 max-w-md w-full shadow-2xl relative border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowAdminEventModal(false)}
                className="absolute right-6 top-6 p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>

              {(() => {
                // IMPORTANT: Find the latest state from the events array to avoid stale modal data
                const currentEvent = events.find(e => e.id === selectedEventForFinance.id) || selectedEventForFinance;
                
                const eventRegs = registrations.filter(r => r.eventId === currentEvent.id);
                const activeRegsForModal = eventRegs.filter(r => r.status === 'registered');
                const totalRegistered = activeRegsForModal.length;
                const totalPaidCount = activeRegsForModal.filter(r => r.paymentStatus === 'paid').length;
                const cashTotal = activeRegsForModal.reduce((sum, r) => sum + (r.paymentMethod === 'cash' ? r.amountPaid : 0), 0);
                const cardTotal = activeRegsForModal.reduce((sum, r) => sum + (r.paymentMethod === 'card' ? r.amountPaid : 0), 0);

                return (
                  <>
                    <div className="mb-8 pr-12">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-amber-500/20 rounded-xl text-amber-500">
                          <ShieldCheck size={20} />
                        </div>
                        <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Служебная информация</p>
                      </div>
                      <h3 className="text-xl font-black text-white leading-tight">{currentEvent.title}</h3>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                          <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Записано</p>
                          <p className="text-xl font-black text-white">{totalRegistered}</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                          <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Оплачено</p>
                          <p className="text-xl font-black text-white">{totalPaidCount}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                          <span className="text-xs font-bold text-slate-400">Наличные (итого)</span>
                          <span className="text-sm font-black text-green-400">{cashTotal.toLocaleString()} ₽</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                          <span className="text-xs font-bold text-slate-400">Безнал (итого)</span>
                          <span className="text-sm font-black text-blue-400">{cardTotal.toLocaleString()} ₽</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Дополнительные расходы</p>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isListening && recognitionRef.current) {
                                  recognitionRef.current.abort();
                                  setIsListening(false);
                                  return;
                                }
                                const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                                if (!SpeechRecognition) return;
                                const recognition = new SpeechRecognition();
                                recognitionRef.current = recognition;
                                recognition.lang = 'ru-RU';
                                recognition.onstart = () => setIsListening(true);
                                recognition.onend = () => {
                                  setIsListening(false);
                                  recognitionRef.current = null;
                                };
                                recognition.onresult = async (ev: any) => {
                                  const transcript = ev.results[0][0].transcript;
                                  const matches = transcript.match(/(\d+)/g);
                                  if (matches) {
                                    const amount = Number(matches[matches.length - 1]);
                                    const name = transcript.replace(matches[matches.length - 1], '').trim() || 'Расход';
                                    const currentList = currentEvent.expenseList || [];
                                    const newList = [...currentList, { name, amount }];
                                    const total = newList.reduce((sum, e) => sum + e.amount, 0);
                                    try {
                                      await updateDoc(doc(db, 'events', currentEvent.id), { 
                                        expenseList: newList,
                                        additionalExpenses: total
                                      });
                                    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'events'); }
                                  }
                                };
                                recognition.start();
                              }}
                              className={`p-1.5 rounded-lg transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-white/10 text-red-500'}`}
                              title={isListening ? "Отменить запись" : "Добавить голосом (Название + Сумма)"}
                            >
                              {isListening ? <X size={14} /> : <Mic size={14} />}
                            </button>
                          </div>
                          <button 
                            onClick={async () => {
                              const newList = [...(currentEvent.expenseList || []), { name: '', amount: 0 }];
                              const total = newList.reduce((sum, e) => sum + e.amount, 0);
                              try {
                                await updateDoc(doc(db, 'events', currentEvent.id), { 
                                  expenseList: newList,
                                  additionalExpenses: total
                                });
                              } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'events'); }
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-hide mb-4">
                          {(currentEvent.expenseList || []).map((exp, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input 
                                type="text"
                                value={exp.name}
                                onChange={async (e) => {
                                  const newList = [...(currentEvent.expenseList || [])];
                                  newList[idx].name = e.target.value;
                                  const total = newList.reduce((sum, e) => sum + e.amount, 0);
                                  try {
                                    await updateDoc(doc(db, 'events', currentEvent.id), { 
                                      expenseList: newList,
                                      additionalExpenses: total
                                    });
                                  } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'events'); }
                                }}
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white flex-1 outline-none focus:border-red-400/50 transition-all"
                                placeholder="Название статьи"
                              />
                              <div className="flex items-center gap-2 w-[110px] shrink-0">
                                <input 
                                  type="number"
                                  value={exp.amount}
                                  onChange={async (e) => {
                                    const newList = [...(currentEvent.expenseList || [])];
                                    newList[idx].amount = Number(e.target.value);
                                    const total = newList.reduce((sum, e) => sum + e.amount, 0);
                                    try {
                                      await updateDoc(doc(db, 'events', currentEvent.id), { 
                                        expenseList: newList,
                                        additionalExpenses: total
                                      });
                                    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'events'); }
                                  }}
                                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-black text-white w-full outline-none focus:border-red-400/50 transition-all text-right"
                                  placeholder="0"
                                />
                                <button 
                                  onClick={async () => {
                                    const newList = currentEvent.expenseList?.filter((_, i) => i !== idx);
                                    const total = newList?.reduce((sum, e) => sum + e.amount, 0) || 0;
                                    try {
                                      await updateDoc(doc(db, 'events', currentEvent.id), { 
                                        expenseList: newList,
                                        additionalExpenses: total
                                      });
                                    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'events'); }
                                  }}
                                  className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Итого доп. расходов</span>
                          <span className="text-sm font-black text-red-400">
                            {(currentEvent.expenseList || []).reduce((sum, e) => sum + e.amount, 0).toLocaleString()} ₽
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}

        {/* --- MOBILE MENU OVERLAY --- */}
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-md lg:hidden"
          >
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-[85%] max-w-[320px] h-full bg-white p-6 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <Logo className="w-10 h-10" />
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <SidebarContent 
                  view={view} 
                  setView={(v) => {
                    setView(v);
                    setIsMobileMenuOpen(false);
                  }} 
                  profile={profile} 
                  user={user}
                  isAdmin={isAdmin}
                  PERIODS={PERIODS} 
                  filterPeriod={filterPeriod} 
                  setFilterPeriod={setFilterPeriod}
                  CATEGORIES={CATEGORIES}
                  filterCategory={filterCategory}
                  setFilterCategory={setFilterCategory}
                  filterTitle={filterTitle}
                  setFilterTitle={setFilterTitle}
                  filterSpeaker={filterSpeaker}
                  setFilterSpeaker={setFilterSpeaker}
                  filterBranch={filterBranch}
                  setFilterBranch={setFilterBranch}
                  BRANCHES={BRANCHES}
                  filterLocation={filterLocation}
                  setFilterLocation={setFilterLocation}
                  filterDateFrom={filterDateFrom}
                  setFilterDateFrom={setFilterDateFrom}
                  filterDateTo={filterDateTo}
                  setFilterDateTo={setFilterDateTo}
                  events={events}
                  seedMockData={seedMockData}
                  seedStatus={seedStatus}
                  handleLogin={handleLogin}
                  handleLogout={handleLogout}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function SidebarContent({ 
  view, setView, profile, user, isAdmin, PERIODS, filterPeriod, setFilterPeriod,
  CATEGORIES, filterCategory, setFilterCategory,
  filterTitle, setFilterTitle, filterSpeaker, setFilterSpeaker,
  filterBranch, setFilterBranch, BRANCHES,
  filterLocation, setFilterLocation,
  filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
  events, seedMockData, seedStatus, handleLogin, handleLogout
}: any) {
  return (
    <div className="flex flex-col h-full gap-8">
      <div className="space-y-3">
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-slate-200">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={20} className="text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{user.displayName}</p>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{profile?.role || 'Участник'}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <LogOut size={18} />
              </button>
            </div>
            {isAdmin && (
              <button 
                onClick={() => setView('admin')}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-50 text-amber-700 rounded-2xl font-bold text-sm border border-amber-100 hover:bg-amber-100 transition-all"
              >
                <ShieldCheck size={18} />
                <span>Админ</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-logo-blue text-white rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-logo-blue/20 transition-all active:scale-95"
            >
              <User size={18} />
              <span>Войти</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Период</h4>
          <div className="space-y-1">
            {PERIODS.map((p: string) => (
              <button 
                key={p}
                onClick={() => {
                  setFilterPeriod(p);
                  if (p !== 'Произвольный') {
                    setFilterDateFrom('');
                    setFilterDateTo('');
                  }
                }}
                className={`w-full text-left px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterPeriod === p ? 'bg-slate-100 text-logo-blue border border-slate-200' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {p}
              </button>
            ))}
          </div>

          {filterPeriod === 'Произвольный' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3"
            >
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">От</label>
                <input 
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 ring-logo-blue outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">До</label>
                <input 
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 ring-logo-blue outline-none"
                />
              </div>
            </motion.div>
          )}
        </div>

        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Направления</h4>
          <div className="space-y-1">
            {CATEGORIES.map((c: string) => (
              <button 
                key={c}
                onClick={() => setFilterCategory(c)}
                className={`w-full text-left px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterCategory === c ? 'bg-slate-100 text-logo-blue border border-slate-200' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 space-y-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Доп. фильтры</h4>
          
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Название события</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                type="text"
                placeholder="Поиск..."
                value={filterTitle}
                onChange={(e) => setFilterTitle(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 ring-logo-blue outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Спикер</label>
            <input 
              type="text"
              placeholder="Фамилия..."
              value={filterSpeaker}
              onChange={(e) => setFilterSpeaker(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 ring-logo-blue outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Филиал</label>
            <select 
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 ring-logo-blue outline-none appearance-none cursor-pointer transition-colors ${filterBranch === 'Все филиалы' ? 'text-slate-400' : 'text-slate-900'}`}
            >
              {BRANCHES.map((b: string) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Локация</label>
            <input 
              type="text"
              placeholder="Место..."
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 ring-logo-blue outline-none"
            />
          </div>

          {(filterTitle || filterSpeaker || filterDateFrom || filterDateTo || filterLocation || filterBranch !== 'Все филиалы') && (
            <button 
              onClick={() => {
                setFilterTitle('');
                setFilterSpeaker('');
                setFilterDateFrom('');
                setFilterDateTo('');
                setFilterLocation('');
                setFilterBranch('Все филиалы');
              }}
              className="w-full py-2 text-[10px] font-black text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
            >
              Сбросить всё
            </button>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-[10px] text-slate-400 uppercase font-bold mb-2">Отладка</div>
            <div className="text-xs text-slate-600">Всего событий в БД: {events.length}</div>
            <button 
              onClick={seedMockData}
              disabled={seedStatus !== null}
              className="w-full mt-2 py-2 text-[10px] font-black text-logo-blue bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={12} />
              {seedStatus || "ДОБАВИТЬ ТЕСТОВЫЕ ДАННЫЕ"}
            </button>
          </div>
        </div>

      {user && (
        <button 
          onClick={() => setView('profile')}
          className="mt-auto w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-xs hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
        >
          Личный кабинет
        </button>
      )}
    </div>
  );
}

interface EventRowProps {
  key?: string | number;
  event: Event;
  user: FirebaseUser | null;
  onRegister: () => void | Promise<void>;
  onCancelRegister?: () => void | Promise<void>;
  onShowFinance?: () => void;
  onShowAdminInfo?: () => void;
  isRegistering: boolean;
  isAdmin?: boolean;
  registrations?: Registration[];
  financeRecords?: FinanceRecord[];
}

function EventRow({ 
  event, 
  user,
  onRegister, 
  onCancelRegister,
  onShowFinance,
  onShowAdminInfo,
  isRegistering, 
  isAdmin, 
  registrations = [], 
  financeRecords = [] 
}: EventRowProps) {
  const date = getEventDate(event.startTime);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('ru', { month: 'short' });
  
  // 1. Single true source of truth for registration status
  const currentUserId = user?.uid;
  const activeRegistration = registrations.find(r => r.eventId === event.id && r.userId === currentUserId && r.status === 'registered');
  const isRegistered = !!activeRegistration;

  // 2. Base count calculation: Total participants except the current user if they are registered
  // This allows accurate display for non-admins who don't see others in the 'registrations' array
  const totalInDb = event.registeredCount || 0;
  const baseCount = isRegistered ? Math.max(0, totalInDb - 1) : totalInDb;

  // 3. Displayed count: baseCount + (isRegistered ? 1 : 0)
  const displayedCount = baseCount + (isRegistered ? 1 : 0);
  
  const isFull = !isRegistered && event.maxParticipants && displayedCount >= event.maxParticipants;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500';
      case 'partial': return 'bg-yellow-500';
      case 'unpaid': return 'bg-red-500';
      default: return 'bg-slate-300';
    }
  };

  // Service Info (Admin & Stats)
  const eventRegsForStats = registrations.filter(r => r.eventId === event.id && r.status === 'registered');
  const totalPaid = eventRegsForStats.filter(r => r.paymentStatus === 'paid').length;
  const cashTotal = eventRegsForStats.reduce((sum, r) => sum + (r.paymentMethod === 'cash' ? r.amountPaid : 0), 0);
  const cardTotal = eventRegsForStats.reduce((sum, r) => sum + (r.paymentMethod === 'card' ? r.amountPaid : 0), 0);
  
  // Дополнительные расходы (Manual + Computed if any)
  const additionalExpenses = (event.additionalExpenses || 0) + financeRecords
    .filter(f => f.eventId === event.id && f.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      onClick={() => { if (isAdmin) onShowAdminInfo?.(); }}
      className={`relative group bg-white border border-slate-100 rounded-[32px] p-5 md:p-6 flex flex-col md:grid md:grid-cols-[120px_1fr_200px] gap-4 md:gap-6 items-center transition-all hover:shadow-2xl hover:shadow-slate-200/50 ${isAdmin ? 'cursor-pointer' : ''}`}
    >
      <div className="flex md:flex-col items-center justify-center md:border-r border-slate-100 md:pr-6 w-full md:w-auto border-b md:border-b-0 pb-4 md:pb-0">
        <span className="text-4xl md:text-5xl font-black tracking-tighter leading-none">{day}</span>
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-3 md:ml-0 md:mt-1">{month}</span>
      </div>

      <div className="flex-1 w-full px-0 md:px-2">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: event.color || 'var(--color-logo-blue)' }}>
            {event.category}
          </span>
          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
            <MapPin size={10} /> {event.location} {event.format && `— ${event.format}`}
          </span>
          {event.price !== undefined && (
            <span className="text-[10px] font-black text-logo-blue bg-blue-50 px-2 py-1 rounded-lg">
              {event.price === 0 ? 'БЕСПЛАТНО' : `${event.price.toLocaleString()} ₽`}
            </span>
          )}
        </div>
        <h3 className="text-xl md:text-2xl font-black tracking-tight group-hover:text-logo-blue transition-colors leading-tight">{event.title}</h3>
        {event.description && (
          <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{event.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
          <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
            <User size={14} className="text-slate-300" /> {event.speakerName}
          </p>
          {event.branch && (
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              {event.branch}
            </p>
          )}
        </div>

        {/* Sessions Display */}
        {event.sessionsCount && event.sessionsCount > 1 && (
          <div className="mt-4 pt-4 border-t border-slate-50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <CalendarIcon size={12} /> Расписание занятий ({event.sessionsCount})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: event.sessionsCount }).map((_, idx) => {
                const sessionDate = event.sessionDates?.[idx];
                const formattedDate = sessionDate 
                  ? getEventDate(sessionDate).toLocaleString('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Дата не указана';
                
                return (
                  <div key={idx} className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                    <span className="text-[9px] font-black text-logo-blue bg-blue-50 w-5 h-5 flex items-center justify-center rounded-full shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600">
                      {formattedDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center md:items-end w-full md:w-auto pt-2 md:pt-0">
        {isRegistered && (
          <div className="mb-2 px-3 py-1 bg-green-50 rounded-lg flex items-center gap-1.5 border border-green-100 self-center md:self-end">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Вы записаны</span>
          </div>
        )}
        <button 
          id={`event-action-${event.id}`}
          onClick={(e) => { e.stopPropagation(); isRegistered ? onCancelRegister?.() : onRegister(); }}
          disabled={isRegistering || (!!user && isFull && !isRegistered)}
          className={`w-full md:w-auto px-10 py-5 md:py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-xl shadow-slate-200 disabled:opacity-50 ${
            isRegistered 
              ? 'bg-red-50 text-red-500 border border-red-100 hover:bg-red-100' 
              : 'bg-slate-900 text-white hover:bg-logo-blue'
          }`}
        >
          {isRegistering ? (isRegistered ? 'Отмена...' : 'Запись...') : isRegistered ? 'Отменить запись' : (isFull && user) ? 'Мест нет' : 'Записаться'}
        </button>
        {isRegistered && activeRegistration && (
          <button 
            onClick={(e) => { e.stopPropagation(); onShowFinance?.(); }}
            className="mt-3 flex items-center gap-2 hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-all border border-transparent hover:border-slate-200 group/status"
          >
            <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(activeRegistration.paymentStatus)} shadow-sm group-hover/status:scale-110 transition-transform`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
              {activeRegistration.paymentStatus === 'paid' ? 'Оплачено' : 
               activeRegistration.paymentStatus === 'partial' ? 'Частично' : 'Не оплачено'}
              <ChevronRight size={10} className="text-slate-300" />
            </span>
          </button>
        )}
        <div className="mt-4 md:mt-3 flex items-center gap-2 px-4 py-2 md:px-3 md:py-1.5 rounded-xl border relative">
          <div className={`flex items-center gap-2 flex-1 ${isFull ? 'text-red-600' : 'text-slate-500'}`}>
            <Users size={12} className={isFull ? 'text-red-400' : 'text-slate-400'} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isFull ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
              {displayedCount} / {event.maxParticipants || '∞'} ЗАПИСАНО
            </span>
          </div>
          {isAdmin && (
            <button 
              onClick={(e) => { e.stopPropagation(); onShowAdminInfo?.(); }}
              className={`p-1.5 rounded-lg transition-all hover:bg-slate-200 text-slate-400`}
              title="Показать статистику"
            >
              <Activity size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AdminPanel({ events, financeRecords, registrations, participantsCount, allUserProfiles, leads, user }: { 
  events: Event[], 
  financeRecords: FinanceRecord[], 
  registrations: Registration[], 
  participantsCount: number, 
  allUserProfiles: UserProfile[], 
  leads: any[],
  user: any
}) {
  const [subView, setSubView] = useState<'create-event' | 'event-analytics' | 'finance' | 'participants' | 'prompts'>('create-event');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [location, setLocation] = useState('');
  const [branch, setBranch] = useState('Все филиалы');
  const [sessionsCount, setSessionsCount] = useState(1);
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(2); // hours
  const [category, setCategory] = useState('Семинары');
  const [price, setPrice] = useState(0);
  const [discounts, setDiscounts] = useState('При оплате за весь курс - 10%');
  const [access, setAccess] = useState('Все желающие');
  const [rentExpense, setRentExpense] = useState(0);
  const [speakerFee, setSpeakerFee] = useState(0);
  const [format, setFormat] = useState<'Онлайн' | 'Оффлайн' | 'Смешанный'>('Оффлайн');
  const [maxParticipants, setMaxParticipants] = useState(25);
  const [additionalDates, setAdditionalDates] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Event[]>([]);
  const [manualAdditionalExpenses, setManualAdditionalExpenses] = useState(0);

  // Derived Metrics for Служебная информация
  const matchedEvent = events.find(e => e.title.toLowerCase() === title.toLowerCase() && e.speakerName.toLowerCase() === speakerName.toLowerCase());
  const eventRegs = matchedEvent ? registrations.filter(r => r.eventId === matchedEvent.id) : [];
  
  const activeRegsSummary = eventRegs.filter(r => r.status !== 'cancelled');
  const totalRegistered = activeRegsSummary.length;
  const totalPaid = activeRegsSummary.filter(r => r.paymentStatus === 'paid').length;
  const cashTotal = activeRegsSummary.reduce((sum, r) => sum + (r.paymentMethod === 'cash' ? r.amountPaid : 0), 0);
  const cardTotal = activeRegsSummary.reduce((sum, r) => sum + (r.paymentMethod === 'card' ? r.amountPaid : 0), 0);
  
  // Global Analytics calculations
  const globalCashRevenue = registrations
    .filter(r => r.status !== 'cancelled' && r.paymentMethod === 'cash' && r.paymentStatus === 'paid')
    .reduce((sum, r) => sum + (r.amountPaid || 0), 0);
  const globalCardRevenue = registrations
    .filter(r => r.status !== 'cancelled' && r.paymentMethod === 'card' && r.paymentStatus === 'paid')
    .reduce((sum, r) => sum + (r.amountPaid || 0), 0);
  const globalUnderpayments = registrations
    .filter(r => r.status !== 'cancelled')
    .reduce((sum, r) => {
      const event = events.find(e => e.id === r.eventId);
      const price = event?.price || 0;
      return sum + Math.max(0, price - (r.amountPaid || 0));
    }, 0);

  // Note: automatic expenses from financeRecords are no longer primary here as per user request for manual entry
  const computedAdditionalExpenses = matchedEvent 
    ? financeRecords.filter(f => f.eventId === matchedEvent.id && f.type === 'expense').reduce((sum, r) => sum + r.amount, 0)
    : 0;

  // Sync manual expenses when matched event changes
  useEffect(() => {
    if (matchedEvent?.additionalExpenses !== undefined) {
      setManualAdditionalExpenses(matchedEvent.additionalExpenses);
    }
  }, [matchedEvent?.id, matchedEvent?.additionalExpenses]);

  const locations = Array.from(new Set(events.map(e => e.location))).sort((a, b) => {
    const countA = events.filter(e => e.location === a).length;
    const countB = events.filter(e => e.location === b).length;
    return countB - countA;
  });

  const checkConflicts = (newStart: Date, newEnd: Date) => {
    return events.filter(event => {
      const eventStart = getEventDate(event.startTime);
      // Assume 2h duration if endTime is missing in legacy data
      const eventEnd = event.endTime ? getEventDate(event.endTime) : new Date(eventStart.getTime() + 2 * 60 * 60 * 1000);
      
      const overlaps = (newStart < eventEnd && newEnd > eventStart);
      const sameSpeaker = event.speakerName.toLowerCase() === speakerName.toLowerCase();
      const sameLocation = event.location.toLowerCase() === location.toLowerCase() && location.toLowerCase() !== 'онлайн';
      
      return overlaps && (sameSpeaker || sameLocation);
    });
  };

  const startVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.abort();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Ваш браузер не поддерживает голосовой ввод.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      
      // Intelligent Voice Assistant Logic
      // Example: "Семинар Второе рождение спикер Ольга Воротникова цена 5000"
      
      // 1. Title Extraction (everything before keywords)
      const keywords = ['спикер', 'цена', 'дата', 'локация', 'филиал', 'расходы'];
      let mainTitle = transcript;
      keywords.forEach(k => {
        const idx = mainTitle.indexOf(k);
        if (idx !== -1) mainTitle = mainTitle.substring(0, idx);
      });
      if (mainTitle.trim()) setTitle(mainTitle.trim().charAt(0).toUpperCase() + mainTitle.trim().slice(1));

      // 2. Speaker Extraction
      const speakerMatch = transcript.match(/спикер\s+([а-яё\s]+?)(?=\s+цена|\s+дата|\s+локация|\s+филиал|\s+расходы|$)/);
      if (speakerMatch) setSpeakerName(speakerMatch[1].trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));

      // 3. Price Extraction
      const priceMatch = transcript.match(/цена\s+(\d+)/);
      if (priceMatch) setPrice(Number(priceMatch[1]));

      // 4. Location Extraction
      const locationMatch = transcript.match(/локация\s+([а-яё\s]+?)(?=\s+спикер|\s+цена|\s+дата|\s+филиал|\s+расходы|$)/);
      if (locationMatch) setLocation(locationMatch[1].trim().charAt(0).toUpperCase() + locationMatch[1].trim().slice(1));

      // 5. Branch Extraction
      const branchMatch = transcript.match(/филиал\s+([а-яё\s]+?)(?=\s+спикер|\s+цена|\s+дата|\s+локация|\s+расходы|$)/);
      if (branchMatch) {
        const bName = branchMatch[1].trim();
        const found = BRANCHES.find(b => b.toLowerCase().includes(bName.toLowerCase()));
        if (found) setBranch(found);
      }

      // 6. Manual Expenses Extraction
      const expenseMatch = transcript.match(/расходы\s+(\d+)/);
      if (expenseMatch) setManualAdditionalExpenses(Number(expenseMatch[1]));
    };

    recognition.start();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60 * 60 * 1000);
    
    const foundConflicts = checkConflicts(start, end);
    if (foundConflicts.length > 0 && conflicts.length === 0) {
      setConflicts(foundConflicts);
      setStatus('Обнаружен конфликт расписания!');
      return;
    }

    setStatus('Сохранение...');
    try {
      // Map additional dates
      const sessionDates = [startTime, ...additionalDates.slice(0, sessionsCount - 1)];

      await addDoc(collection(db, 'events'), {
        title,
        description,
        speakerName,
        location,
        branch,
        sessionsCount: Number(sessionsCount),
        sessionDates,
        startTime: start,
        endTime: end,
        category,
        price: Number(price),
        discounts: discounts || 'Без скидок',
        access,
        format,
        maxParticipants: Number(maxParticipants),
        registeredCount: 0,
        additionalExpenses: Number(manualAdditionalExpenses),
        baseExpenses: {
          rent: Number(rentExpense),
          speakerFee: Number(speakerFee),
          marketing: 0,
          other: 0
        },
        totalRevenue: 0,
        totalExpenses: Number(rentExpense) + Number(speakerFee),
        netProfit: -(Number(rentExpense) + Number(speakerFee)),
        status: 'planned',
        createdAt: serverTimestamp()
      });
      setStatus('Событие добавлено!');
      setConflicts([]);
      // Reset form
      setTitle('');
      setDescription('');
      setSpeakerName('');
      setLocation('');
      setStartTime('');
      setManualAdditionalExpenses(0);
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'events');
      setStatus('Ошибка при сохранении');
    }
  };

  const syncAllEventCounts = async () => {
    setStatus('Синхронизация...');
    try {
      for (const event of events) {
        const trueCount = registrations.filter(r => r.eventId === event.id && r.status === 'registered').length;
        if (event.registeredCount !== trueCount) {
          await updateDoc(doc(db, 'events', event.id), {
            registeredCount: trueCount
          });
        }
      }
      setStatus('Синхронизация завершена!');
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'events');
      setStatus('Ошибка синхронизации');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-4xl font-black tracking-tight">Управление системой</h2>
        <button 
          onClick={syncAllEventCounts}
          disabled={status?.includes('Синхронизация')}
          className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all disabled:opacity-50"
          title="Синхронизировать счетчики участников всех мероприятий"
        >
          <RefreshCcw size={14} className={status?.includes('Синхронизация') ? 'animate-spin' : ''} />
          {status?.includes('Синхронизация') ? 'Синхронизация...' : 'Пересчитать счетчики'}
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-12">
        <button 
          onClick={() => setSubView('create-event')}
          className={`px-6 py-4 md:py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
            subView === 'create-event' 
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
          }`}
        >
          Создать мероприятие
        </button>
        <button 
          onClick={() => setSubView('event-analytics')}
          className={`px-6 py-4 md:py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
            subView === 'event-analytics' 
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
          }`}
        >
          Аналитика мероприятий
        </button>
        <button 
          onClick={() => setSubView('finance')}
          className={`px-6 py-4 md:py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
            subView === 'finance' 
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
          }`}
        >
          Финансы
        </button>
        <button 
          onClick={() => setSubView('participants')}
          className={`px-6 py-4 md:py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
            subView === 'participants' 
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
          }`}
        >
          Участники
        </button>
        {(user?.email?.toLowerCase() === 'il17184@gmail.com') && (
          <button 
            onClick={() => setSubView('prompts')}
            className={`px-6 py-4 md:py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              subView === 'prompts' 
                ? 'bg-logo-blue text-white shadow-lg shadow-logo-blue/20' 
                : 'bg-logo-blue/5 text-logo-blue hover:bg-logo-blue/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <Megaphone size={14} />
              <span>Публиковать</span>
            </div>
          </button>
        )}
      </div>

      {/* Tab Content */}
      {subView === 'participants' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">Реестр участников (Единый список)</h3>
              <div className="px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Всего участников</p>
                <p className="text-lg font-black text-slate-900">
                  {(() => {
                    const participantMapCount: Record<string, boolean> = {};
                    allUserProfiles.forEach(up => {
                      const ln = (up.lastName || '').trim();
                      const fn = (up.firstName || '').trim();
                      if (ln || fn) participantMapCount[`${ln} ${fn}`.toLowerCase()] = true;
                    });
                    leads.forEach(l => {
                      const full = l.fullName || `${l.lastName || ''} ${l.firstName || ''}`.trim();
                      if (full) participantMapCount[full.toLowerCase()] = true;
                    });
                    registrations.filter(r => r.status !== 'cancelled').forEach(reg => {
                      if (reg.participantName) participantMapCount[reg.participantName.trim().toLowerCase()] = true;
                    });
                    return Object.keys(participantMapCount).length;
                  })()}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {(() => {
                // Aggregate participants by FIO
                const participantMap: Record<string, { 
                  fullName: string, 
                  lastName: string, 
                  firstName: string, 
                  patronymic: string,
                  logins: Set<string>, 
                  roles: Set<string>, 
                  academyStatuses: Set<string>,
                  totalAttended: number,
                  upcomingRegistrations: Registration[]
                }> = {};

                // Helper to get FIO from profile
                const getFio = (profile: UserProfile) => {
                  const ln = (profile.lastName || '').trim();
                  const fn = (profile.firstName || '').trim();
                  const p = (profile.patronymic || '').trim();
                  if (!ln && !fn) return null;
                  return { ln, fn, p, full: `${ln} ${fn} ${p}`.trim() };
                };

                // 1. Process all user profiles
                allUserProfiles.forEach(up => {
                  const fio = getFio(up);
                  if (!fio) return;
                  
                  const key = fio.full.toLowerCase();
                  if (!participantMap[key]) {
                    participantMap[key] = {
                      fullName: fio.full,
                      lastName: fio.ln,
                      firstName: fio.fn,
                      patronymic: fio.p,
                      logins: new Set(),
                      roles: new Set(),
                      academyStatuses: new Set(),
                      totalAttended: 0,
                      upcomingRegistrations: []
                    };
                  }
                  participantMap[key].logins.add(up.email);
                  participantMap[key].roles.add(up.role);
                  if (up.academyStatus) participantMap[key].academyStatuses.add(up.academyStatus);
                });

                // 2. Process leads (manually added cards)
                leads.forEach(l => {
                  const ln = (l.lastName || '').trim();
                  const fn = (l.firstName || '').trim();
                  const p = (l.patronymic || '').trim();
                  const full = l.fullName || `${ln} ${fn} ${p}`.trim();
                  if (!full) return;

                  const key = full.toLowerCase();
                  if (!participantMap[key]) {
                    participantMap[key] = {
                      fullName: full,
                      lastName: ln || full.split(' ')[0] || '',
                      firstName: fn || full.split(' ')[1] || '',
                      patronymic: p || full.split(' ').slice(2).join(' ') || '',
                      logins: new Set(),
                      roles: new Set(),
                      academyStatuses: new Set(),
                      totalAttended: 0,
                      upcomingRegistrations: []
                    };
                  }
                  if (l.email) participantMap[key].logins.add(l.email);
                  if (l.participantStatus) participantMap[key].academyStatuses.add(l.participantStatus);
                });

                // 3. Process registrations to enrich map
                registrations.forEach(reg => {
                  let participantKey: string | null = null;
                  
                  // Try to find by UID first
                  const ownerProfile = allUserProfiles.find(up => up.uid === reg.userId);
                  if (ownerProfile) {
                    const fio = getFio(ownerProfile);
                    if (fio) participantKey = fio.full.toLowerCase();
                  }

                  // If not found by UID, try by participantName in reg
                  if (!participantKey && reg.participantName) {
                    participantKey = reg.participantName.trim().toLowerCase();
                    if (!participantMap[participantKey]) {
                      participantMap[participantKey] = {
                        fullName: reg.participantName,
                        lastName: reg.participantName.split(' ')[0] || '',
                        firstName: reg.participantName.split(' ')[1] || '',
                        patronymic: reg.participantName.split(' ').slice(2).join(' ') || '',
                        logins: new Set(),
                        roles: new Set(),
                        academyStatuses: new Set(),
                        totalAttended: 0,
                        upcomingRegistrations: []
                      };
                    }
                  }

                  if (participantKey && participantMap[participantKey]) {
                    const p = participantMap[participantKey];
                    if (reg.status === 'attended') {
                      p.totalAttended += 1;
                    } else if (reg.status !== 'cancelled') {
                      // Check if event is in the future
                      const event = events.find(e => e.id === reg.eventId);
                      if (event) {
                        const eventDate = getEventDate(event.startTime);
                        if (eventDate >= new Date()) {
                          p.upcomingRegistrations.push(reg);
                        } else {
                          // Past but not marked as attended? Still count as record but maybe not "attended" specifically
                        }
                      }
                    }
                  }
                });

                return Object.values(participantMap).sort((a, b) => a.lastName.localeCompare(b.lastName)).map((p, idx) => (
                  <div key={idx} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 hover:border-logo-blue/30 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                      <div className="flex items-start gap-5">
                        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-slate-300 group-hover:text-logo-blue transition-colors shadow-sm shrink-0">
                          <User size={32} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-xl font-black text-slate-900 leading-tight">{p.fullName}</h4>
                            <div className="flex gap-1">
                              {Array.from(p.roles).map(role => (
                                <span key={role} className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                                  {role === 'admin' ? 'Админ' : role === 'speaker' ? 'Спикер' : 'Пользователь'}
                                </span>
                              ))}
                              {Array.from(p.academyStatuses).map(status => (
                                <span key={status} className="px-2 py-0.5 bg-logo-blue/10 text-logo-blue rounded-full text-[8px] font-black uppercase tracking-widest">
                                  {status}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            {Array.from(p.logins).slice(0, 5).map(email => (
                              <p key={email} className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                                <Search size={10} className="text-slate-300" /> {email}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 md:text-right px-4 py-3 bg-white rounded-2xl shadow-sm border border-slate-100 md:bg-transparent md:border-0 md:shadow-none">
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Посещено</p>
                          <p className="text-xl font-black text-slate-900">{p.totalAttended}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Записи</p>
                          <p className="text-xl font-black text-slate-900">{p.upcomingRegistrations.length}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Оплаты (Текущие)</p>
                          <div className="flex gap-1">
                            {p.upcomingRegistrations.map((reg, rIdx) => (
                              <div 
                                key={rIdx} 
                                className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${
                                  reg.paymentStatus === 'paid' ? 'bg-green-500' :
                                  reg.paymentStatus === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                                }`} 
                                title={reg.paymentStatus === 'paid' ? 'Оплачено' : reg.paymentStatus === 'partial' ? 'Частично' : 'Не оплачено'}
                              />
                            ))}
                            {p.upcomingRegistrations.length === 0 && <span className="text-[10px] text-slate-300 font-bold italic">—</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {subView === 'create-event' && (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Block 1: Основная информация */}
          <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6 flex flex-col">
            <h3 className="text-xl font-black flex items-center gap-3">
              <Eye className="text-logo-blue" /> Публичная информация
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Название мероприятия</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all text-sm"
                      placeholder="Название..."
                      required
                    />
                    <button 
                      type="button"
                      onClick={startVoiceInput}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                        isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                      title={isListening ? "Отменить запись" : "Голосовой ввод"}
                    >
                      {isListening ? <X size={14} /> : <Mic size={14} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Имя и фамилия спикера</label>
                  <input 
                    type="text"
                    value={speakerName}
                    onChange={(e) => setSpeakerName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all text-sm"
                    placeholder="Имя..."
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Дата проведения</label>
                  <input 
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all text-[10px]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Количество часов</label>
                  <input 
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all text-sm"
                    min="0.5"
                    step="0.5"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Количество занятий</label>
                  <input 
                    type="number"
                    value={sessionsCount}
                    onChange={(e) => {
                      const val = Math.max(1, Number(e.target.value));
                      setSessionsCount(val);
                      // Pre-fill additional dates if needed
                      if (val > 1) {
                        const newDates = [...additionalDates];
                        while (newDates.length < val - 1) newDates.push('');
                        setAdditionalDates(newDates);
                      }
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all text-sm"
                    min="1"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Макс. мест</label>
                  <input 
                    type="number"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all text-sm"
                    min="1"
                    required
                  />
                </div>
              </div>

              {/* Dynamic Session Dates */}
              {sessionsCount > 1 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  {Array.from({ length: sessionsCount - 1 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-logo-blue ml-1">Дата занятия {i + 2}</label>
                      <input 
                        type="datetime-local"
                        value={additionalDates[i] || ''}
                        onChange={(e) => {
                          const newDates = [...additionalDates];
                          newDates[i] = e.target.value;
                          setAdditionalDates(newDates);
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all text-[10px]"
                        required
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Филиал</label>
                  <select 
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none text-sm appearance-none cursor-pointer"
                  >
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Категория</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none text-sm appearance-none cursor-pointer"
                  >
                    {CATEGORIES.filter(c => c !== 'Все направления').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Формат</label>
                  <select 
                    value={format}
                    onChange={(e) => setFormat(e.target.value as any)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none text-sm appearance-none cursor-pointer"
                  >
                    <option value="Оффлайн">Оффлайн</option>
                    <option value="Онлайн">Онлайн</option>
                    <option value="Смешанный">Смешанный (оффлайн + онлайн)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Место проведения</label>
                  <input 
                    type="text"
                    list="admin-locations-v4"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all text-sm"
                    placeholder="Локация..."
                    required
                  />
                  <datalist id="admin-locations-v4">
                    {locations.map(loc => <option key={loc} value={loc} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Цена за все занятия (₽)</label>
                  <input 
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all text-sm"
                    min="0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Скидка</label>
                  <input 
                    type="text"
                    value={discounts}
                    onChange={(e) => setDiscounts(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all text-sm"
                    placeholder="Напр. 10%..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Допуск</label>
                  <input 
                    type="text"
                    value={access}
                    onChange={(e) => setAccess(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all text-sm"
                    placeholder="Кто допущен..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Описание мероприятия</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none text-sm min-h-[42px]"
                    placeholder="Описание..."
                  />
                </div>
              </div>

              {conflicts.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 font-black uppercase tracking-widest text-[9px]">
                    <AlertCircle size={14} /> Конфликт расписания
                  </div>
                  <div className="space-y-1">
                    {conflicts.map(c => <div key={c.id} className="text-[10px] font-bold text-amber-800">• {c.title}</div>)}
                  </div>
                </div>
              )}

              <button 
                type="submit"
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg text-sm ${
                  conflicts.length > 0 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-100' 
                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-100'
                }`}
              >
                {status || (conflicts.length > 0 ? "Игнорировать и сохранить" : "Сохранить Мероприятие")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Block 4: Календарь */}
          <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6 overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black flex items-center gap-3">
                <CalendarIcon className="text-emerald-500" /> Календарь
              </h3>
              <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                {new Date().toLocaleDateString('ru', { day: 'numeric', month: 'short' })} — {new Date(new Date().getTime() + 29 * 24 * 60 * 60 * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            
            <div className="grid grid-cols-7 gap-2 text-center mb-2">
              {(() => {
                const now = new Date();
                return Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(now);
                  d.setDate(d.getDate() + i);
                  return (
                    <div key={i} className="text-[9px] font-black uppercase text-slate-400">
                      {d.toLocaleDateString('ru-RU', { weekday: 'short' })}
                    </div>
                  );
                });
              })()}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {(() => {
                const now = new Date();
                const days = [];

                for (let i = 0; i < 30; i++) {
                  const currentDayDate = new Date(now);
                  currentDayDate.setDate(now.getDate() + i);
                  currentDayDate.setHours(0, 0, 0, 0);
                  
                  const dayEnd = new Date(currentDayDate);
                  dayEnd.setHours(23, 59, 59, 999);

                  const isToday = i === 0;
                  
                  const hasEvent = events.some(e => {
                    const eventDate = getEventDate(e.startTime);
                    if (eventDate >= currentDayDate && eventDate <= dayEnd) return true;
                    if (e.sessionDates) {
                      return e.sessionDates.some(sd => {
                        const sDate = getEventDate(sd);
                        return sDate >= currentDayDate && sDate <= dayEnd;
                      });
                    }
                    return false;
                  });

                  days.push(
                    <div 
                      key={i} 
                      className={`h-10 md:h-12 flex flex-col items-center justify-center rounded-xl md:rounded-2xl border transition-all relative ${
                        isToday 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                          : hasEvent 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm' 
                            : 'bg-slate-50 border-slate-100 text-slate-500'
                      }`}
                    >
                      <span className="text-[9px] font-black opacity-50 mb-0.5">{currentDayDate.getDate()}</span>
                      <span className="text-[8px] font-bold uppercase truncate w-full text-center px-1">
                        {currentDayDate.toLocaleDateString('ru', { month: 'short' }).replace('.', '')}
                      </span>
                      {hasEvent && !isToday && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      )}
                    </div>
                  );
                }
                return days;
              })()}
            </div>

            <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                График на месяц вперед с сегодняшнего дня
              </p>
            </div>
          </div>
        </div>
      </form>
      )}
      {subView === 'finance' && (
        <FinanceView events={events} records={financeRecords} registrations={registrations} />
      )}

      {subView === 'event-analytics' && (
        <AnalyticsDashboard 
          events={events} 
          records={financeRecords} 
          registrations={registrations}
          participantsCount={participantsCount} 
        />
      )}

      {subView === 'prompts' && (
        <PromptsView events={events} financeRecords={financeRecords} registrations={registrations} />
      )}
    </div>
  );
}

function PromptsView({ events, financeRecords, registrations }: { events: Event[], financeRecords: FinanceRecord[], registrations: Registration[] }) {
  const [generatedPost, setGeneratedPost] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const generatePost = async () => {
    setLoading(true);
    setGeneratedPost(null);
    console.log("Starting post generation...");
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is missing");
        throw new Error("GEMINI_API_KEY is not set");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const recentEvents = events.filter(e => {
        if (!e.createdAt) return false;
        const created = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
        return !isNaN(created.getTime()) && created > yesterday;
      });

      const recentRegistrations = registrations.filter(r => {
        if (!r.registrationDate) return false;
        const regDate = r.registrationDate?.toDate ? r.registrationDate.toDate() : new Date(r.registrationDate);
        return !isNaN(regDate.getTime()) && regDate > yesterday;
      });

      const context = `
        New events in last 24h: ${recentEvents.map(e => `${e.title} (Speaker: ${e.speakerName}, Price: ${e.price} руб)`).join(', ') || 'None'}
        Total registrations in last 24h: ${recentRegistrations.length}
        Total participants in system: ${registrations.length}
        New revenue today (approx): ${recentRegistrations.reduce((sum, r) => sum + (r.amountPaid || 0), 0)} руб
      `;

      const prompt = `
        Ты — остроумный и живой разработчик (вайбкодер) этого проекта. 
        Твоя задача: написать пост в блог по правилам из BLOG_RULES.md на основе активности за последние 24 часа.

        ПРАВИЛА ИЗ BLOG_RULES.md:
        1. Тон: Легкий, человечный, с иронией и самоиронией. Никакого официоза.
        2. Язык: Короткие предложения, понятные слова. Если термин сложный — объясни его.
        3. Формат: Обязательно выдай 4 блока: [site], [telegram], [max], [vk].
        4. Если активности (новых событий/регистраций) нет — напиши смешной пост о том, что "вайбкодер спал" или "код отдыхает".
        5. Дата поста: ${new Date().toISOString().split('T')[0]}.

        КОНТЕКСТ ЗА ПОСЛЕДНИЕ 24 ЧАСА:
        ${context}

        Выдай результат строго в формате:
        [site]
        Текст для сайта...

        [telegram]
        Текст для телеграма...

        [max]
        Текст для MAX...

        [vk]
        Текст для VK...
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      setGeneratedPost(result.text || "Не удалось получить текст ответа.");
    } catch (error) {
      console.error("Post generation error:", error);
      setGeneratedPost("Ошибка генерации поста. Проверьте GEMINI_API_KEY в настройках.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    setCopied(platform);
    setTimeout(() => setCopied(null), 2000);
  };

  const parsePosts = (text: string) => {
    const sections: Record<string, string> = {};
    const platforms = ['site', 'telegram', 'max', 'vk'];
    platforms.forEach(p => {
      const match = text.match(new RegExp(`\\[${p}\\]([\\s\\S]*?)(?=\\[|$)`, 'i'));
      if (match) sections[p] = match[1].trim();
    });
    return sections;
  };

  const posts = generatedPost ? parsePosts(generatedPost) : {};
  const hasParsedPosts = Object.keys(posts).length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="text-xl font-black flex items-center gap-3">
              <Sparkles className="text-amber-500" /> Генератор контента
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              На основе BLOG_RULES.md и активности за 24ч
            </p>
          </div>
          <button 
            onClick={generatePost}
            disabled={loading}
            className="w-full md:w-auto px-8 py-4 bg-logo-blue text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:shadow-xl shadow-logo-blue/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Генерация...</span>
              </>
            ) : (
              <>
                <Zap size={14} />
                <span>Сформировать посты</span>
              </>
            )}
          </button>
        </div>

        {!generatedPost && !loading && (
          <div className="py-20 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
              <Sparkles className="text-slate-300" size={32} />
            </div>
            <p className="text-slate-400 font-bold text-sm">Нажмите кнопку выше, чтобы создать контент за последние сутки</p>
          </div>
        )}

        {generatedPost && !hasParsedPosts && (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-[32px] mb-6">
            <p className="text-[10px] font-black uppercase text-amber-600 mb-2">Ответ системы (не удалось распознать формат):</p>
            <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white p-4 rounded-xl border border-amber-100">
              {generatedPost}
            </div>
          </div>
        )}

        {generatedPost && hasParsedPosts && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {['site', 'telegram', 'max', 'vk'].map((platform) => {
              const content = posts[platform] || 'Контент не сгенерирован для данной площадки';
              return (
                <div key={platform} className="bg-slate-50 rounded-[32px] p-6 border border-slate-100 flex flex-col h-full hover:border-logo-blue/20 transition-colors group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center border border-slate-200 group-hover:border-logo-blue/20 transition-colors shadow-sm">
                        <FileText size={14} className="text-slate-400 group-hover:text-logo-blue transition-colors" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{platform}</span>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(content, platform)}
                      className="p-2.5 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                      title="Скопировать"
                    >
                      {copied === platform ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-slate-400" />}
                    </button>
                  </div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap flex-1 bg-white p-5 rounded-2xl border border-slate-100 overflow-y-auto max-h-[350px] leading-relaxed custom-scrollbar">
                    {content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsDashboard({ events, records, registrations, participantsCount }: { events: Event[], records: FinanceRecord[], registrations: Registration[], participantsCount: number }) {
  // 0. Revenue Metrics
  const cashRevenue = registrations
    .filter(r => r.status !== 'cancelled' && r.paymentMethod === 'cash' && r.paymentStatus === 'paid')
    .reduce((sum, r) => sum + (r.amountPaid || 0), 0);
  const cardRevenue = registrations
    .filter(r => r.status !== 'cancelled' && r.paymentMethod === 'card' && r.paymentStatus === 'paid')
    .reduce((sum, r) => sum + (r.amountPaid || 0), 0);
  const totalRevenue = cashRevenue + cardRevenue;
  const underpayments = registrations
    .filter(r => r.status !== 'cancelled')
    .reduce((sum, r) => {
      const event = events.find(e => e.id === r.eventId);
      const price = event?.price || 0;
      return sum + Math.max(0, price - (r.amountPaid || 0));
    }, 0);

  // 1. Revenue Over Time
  const revenueData = records
    .filter(r => r.type === 'income')
    .reduce((acc: any[], r) => {
      const date = r.date?.toDate ? r.date.toDate().toLocaleDateString() : 'Unknown';
      const existing = acc.find(item => item.date === date);
      if (existing) {
        existing.amount += r.amount;
      } else {
        acc.push({ date, amount: r.amount });
      }
      return acc;
    }, [])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 2. Category Distribution
  const categoryData = events.reduce((acc: any[], e) => {
    // Normalize category name to plural for distribution chart
    const name = e.category === 'Семинар' ? 'Семинары' :
                 e.category === 'Практика' ? 'Практики' :
                 e.category === 'Вебинар' ? 'Вебинары' :
                 e.category === 'Курс' ? 'Курсы' :
                 e.category === 'Ретрит' ? 'Ретриты' :
                 e.category === 'Путешествие' ? 'Путешествия' : e.category;

    const existing = acc.find(item => item.name === name);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name, value: 1 });
    }
    return acc;
  }, []);

  // 3. Branch Performance
  const branchData = BRANCHES.filter(b => b !== 'Все филиалы').map(branch => {
    const branchEvents = events.filter(e => e.branch === branch);
    const revenue = records
      .filter(r => r.type === 'income' && r.branch === branch)
      .reduce((sum, r) => sum + r.amount, 0);
    return {
      name: branch,
      events: branchEvents.length,
      revenue
    };
  });

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const totalPaidCount = registrations.filter(r => r.paymentStatus === 'paid' && r.status !== 'cancelled').length;
  const totalRegisteredCount = registrations.filter(r => r.status !== 'cancelled').length;

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 md:gap-6">
        <div className="bg-white p-5 md:p-6 rounded-[32px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Участники</p>
          <p className="text-xl md:text-2xl font-black text-slate-900">{participantsCount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-[32px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Мероприятия</p>
          <p className="text-xl md:text-2xl font-black text-slate-900">{events.length}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-[32px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Записалось</p>
          <p className="text-xl md:text-2xl font-black text-slate-900">{totalRegisteredCount}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-[32px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Оплатило</p>
          <p className="text-xl md:text-2xl font-black text-green-600">{totalPaidCount}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-[32px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Наличные</p>
          <p className="text-xl md:text-2xl font-black text-green-600">{cashRevenue.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-[32px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Безналичные</p>
          <p className="text-xl md:text-2xl font-black text-blue-600">{cardRevenue.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-[32px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Недоплаты</p>
          <p className="text-xl md:text-2xl font-black text-amber-600">{underpayments.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-[32px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Выручка</p>
          <p className="text-xl md:text-2xl font-black text-indigo-700">{totalRevenue.toLocaleString()} ₽</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
        {/* Revenue Chart */}
        <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-2xl">
          <h3 className="text-lg md:text-xl font-black mb-6 md:mb-8 flex items-center gap-3">
            <TrendingUp className="text-logo-blue" /> Динамика выручки
          </h3>
          <div className="h-[250px] md:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" fontSize={10} fontWeight="bold" />
                <YAxis fontSize={10} fontWeight="bold" />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={4} dot={{ r: 6, fill: '#3B82F6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Pie */}
        <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-2xl">
          <h3 className="text-lg md:text-xl font-black mb-6 md:mb-8 flex items-center gap-3">
            <PieChartIcon className="text-logo-purple" /> Направления
          </h3>
          <div className="h-[250px] md:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {categoryData.map((c: any, i: number) => (
              <div key={c.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Branch Performance */}
        <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-2xl lg:col-span-2">
          <h3 className="text-lg md:text-xl font-black mb-6 md:mb-8 flex items-center gap-3">
            <BarChart3 className="text-green-500" /> Эффективность филиалов
          </h3>
          <div className="h-[300px] md:h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} fontWeight="bold" />
                <YAxis fontSize={10} fontWeight="bold" />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" fill="#10B981" radius={[10, 10, 0, 0]} />
                <Bar dataKey="events" fill="#3B82F6" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinanceView({ events, records, registrations }: { events: Event[], records: FinanceRecord[], registrations: Registration[] }) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Прочие расходы');
  const [eventId, setEventId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [showUnderpaid, setShowUnderpaid] = useState(false);

  const totalIncome = records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
  const netProfit = totalIncome - totalExpense;

  const underpaidParticipants = registrations
    .filter(r => r.status !== 'cancelled')
    .map(r => {
      const event = events.find(e => e.id === r.eventId);
      const price = event?.price || 0;
      const balance = price - (r.amountPaid || 0);
      return { ...r, eventTitle: event?.title || 'Unknown', balance };
    })
    .filter(p => p.balance > 0);

  const totalUnderpayment = underpaidParticipants.reduce((sum, p) => sum + p.balance, 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('Сохранение...');
    try {
      await addDoc(collection(db, 'finance'), {
        type,
        amount: Number(amount),
        category,
        eventId: eventId || null,
        description,
        date: serverTimestamp(),
        branch: 'Екатеринбург', // Default for now
        managerId: auth.currentUser?.uid
      });
      setStatus('Запись добавлена!');
      setAmount('');
      setDescription('');
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'finance');
      setStatus('Ошибка');
    }
  };

  return (
    <div className="space-y-12">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
          <div className="flex items-center gap-3 text-green-500 mb-4">
            <ArrowUpRight size={24} />
            <span className="text-xs font-black uppercase tracking-widest">Доходы</span>
          </div>
          <p className="text-3xl font-black">{totalIncome.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
          <div className="flex items-center gap-3 text-red-500 mb-4">
            <ArrowDownRight size={24} />
            <span className="text-xs font-black uppercase tracking-widest">Расходы</span>
          </div>
          <p className="text-3xl font-black">{totalExpense.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
          <div className="flex items-center gap-3 text-amber-500 mb-4">
            <AlertCircle size={24} />
            <span className="text-xs font-black uppercase tracking-widest">Недоплаты</span>
          </div>
          <p className="text-3xl font-black">{totalUnderpayment.toLocaleString()} ₽</p>
        </div>
        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
          <div className="flex items-center gap-3 text-logo-blue mb-4">
            <TrendingUp size={24} />
            <span className="text-xs font-black uppercase tracking-widest">Чистая прибыль</span>
          </div>
          <p className="text-3xl font-black">{netProfit.toLocaleString()} ₽</p>
        </div>
      </div>

      {/* Underpaid Participants Section */}
      {underpaidParticipants.length > 0 && (
        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
          <button 
            onClick={() => setShowUnderpaid(!showUnderpaid)}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <Users size={24} />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-black">Участники с задолженностью</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Найдено {underpaidParticipants.length} чел.
                </p>
              </div>
            </div>
            <div className={`p-2 rounded-xl transition-all ${showUnderpaid ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
              {showUnderpaid ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </button>
          
          <AnimatePresence>
            {showUnderpaid && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-8 space-y-4">
                  {underpaidParticipants.map((participant, idx) => (
                    <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-amber-200 transition-colors">
                      <div>
                        <p className="font-black text-slate-900">{participant.participantName || participant.userId}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {participant.eventTitle}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-red-600">-{participant.balance.toLocaleString()} ₽</p>
                        <p className="text-[10px] text-slate-400 font-bold">Остаток долга</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-12">
        {/* Records List */}
        <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-2xl shadow-slate-200/50">
          <h3 className="text-2xl font-black mb-8">История операций</h3>
          <div className="space-y-4">
            {records.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-bold">Записей пока нет</div>
            ) : records.map(record => (
              <div key={record.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${record.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {record.type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{record.category}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      {record.eventId ? events.find(e => e.id === record.eventId)?.title : 'Общие расходы'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black ${record.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {record.type === 'income' ? '+' : '-'}{record.amount.toLocaleString()} ₽
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {record.date?.toDate ? record.date.toDate().toLocaleDateString() : '...'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Record Form */}
        <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 h-fit sticky top-8">
          <h4 className="text-lg font-black mb-6 flex items-center gap-2">
            <Plus size={20} className="text-logo-blue" /> Новая запись
          </h4>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button 
                type="button"
                onClick={() => { setType('expense'); setCategory('Прочие расходы'); }}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${type === 'expense' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400'}`}
              >
                Расход
              </button>
              <button 
                type="button"
                onClick={() => { setType('income'); setCategory('Оплата участия'); }}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${type === 'income' ? 'bg-white text-green-500 shadow-sm' : 'text-slate-400'}`}
              >
                Доход
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Сумма (₽)</label>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Категория</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all appearance-none cursor-pointer"
              >
                {type === 'expense' ? (
                  <>
                    <option value="Прочие расходы">Прочие расходы</option>
                    <option value="Аренда">Аренда</option>
                    <option value="Гонорар спикера">Гонорар спикера</option>
                    <option value="Маркетинг">Маркетинг</option>
                    <option value="Налоги">Налоги</option>
                    <option value="Хоз. расходы">Хоз. расходы</option>
                    <option value="Другое">Другое</option>
                  </>
                ) : (
                  <>
                    <option value="Оплата участия">Оплата участия</option>
                    <option value="Донат">Донат</option>
                    <option value="Спонсорство">Спонсорство</option>
                    <option value="Другое">Другое</option>
                  </>
                )}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Событие (опционально)</label>
              <select 
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="">Общие / Не указано</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Комментарий</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all min-h-[80px]"
                placeholder="Детали операции..."
              />
            </div>

            <button 
              type="submit"
              className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg ${
                type === 'income' ? 'bg-green-600 hover:bg-green-700 shadow-green-100' : 'bg-red-600 hover:bg-red-700 shadow-red-100'
              } text-white`}
            >
              {status || "Добавить запись"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend }: { label: string, value: string, trend?: string }) {
  return (
    <div className="p-4 bg-slate-50 rounded-2xl">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        {trend && <span className="text-[10px] font-black text-green-500">{trend}</span>}
      </div>
      <p className="text-xl font-black">{value}</p>
    </div>
  );
}

function UserProfileView({ user, profile }: { user: FirebaseUser, profile: UserProfile | null }) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [patronymic, setPatronymic] = useState(profile?.patronymic || '');
  const [academyStatus, setAcademyStatus] = useState(profile?.academyStatus || 'Ученик');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setLastName(profile.lastName || '');
      setFirstName(profile.firstName || '');
      setPatronymic(profile.patronymic || '');
      setAcademyStatus(profile.academyStatus || 'Ученик');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaveStatus('Сохранение...');
    try {
      await setDoc(doc(db, 'users', user.uid), {
        lastName,
        firstName,
        patronymic,
        academyStatus,
        displayName: `${lastName} ${firstName}`.trim() || user.displayName,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setSaveStatus('Сохранено!');
      setTimeout(() => {
        setSaveStatus(null);
        setIsEditing(false);
      }, 2000);
    } catch (error) {
      setSaveStatus('Ошибка');
    }
  };

  const referralLink = `${window.location.origin}${window.location.pathname}?ref=${user.uid}`;

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl w-full">
      <div className="bg-white rounded-[40px] p-12 border border-slate-100 shadow-2xl shadow-slate-200/50">
        <div className="flex flex-col md:flex-row items-center gap-8 mb-12">
          <div className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-logo-purple to-logo-blue flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-blue-200">
            {user.photoURL ? <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover rounded-[40px]" /> : (user.displayName?.[0] || 'U')}
          </div>
          <div className="text-center md:text-left flex-1">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
                {profile?.role === 'admin' ? 'Админ' : profile?.role === 'speaker' ? 'Спикер' : 'Пользователь'}
              </span>
              <span className="px-3 py-1 bg-logo-blue/10 rounded-full text-[10px] font-black uppercase tracking-widest text-logo-blue">
                {profile?.academyStatus || 'Ученик'}
              </span>
            </div>
            <h2 className="text-3xl font-black tracking-tight">{profile?.lastName} {profile?.firstName} {profile?.patronymic}</h2>
            {!profile?.lastName && <h2 className="text-3xl font-black tracking-tight text-slate-300 italic">{user.displayName || 'Имя не указано'}</h2>}
            <p className="text-slate-400 font-medium">{user.email}</p>
          </div>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="p-4 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all text-slate-600"
            title="Редактировать профиль"
          >
            <Edit3 size={20} />
          </button>
        </div>

        {isEditing ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Фамилия</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 ring-logo-blue/20" placeholder="Иванов" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Имя</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 ring-logo-blue/20" placeholder="Иван" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Отчество</label>
                <input type="text" value={patronymic} onChange={e => setPatronymic(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 ring-logo-blue/20" placeholder="Иванович" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Статус в Академии</label>
              <select 
                value={academyStatus} 
                onChange={e => setAcademyStatus(e.target.value as any)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none appearance-none cursor-pointer"
              >
                <option value="Мастер">Мастер</option>
                <option value="Магистр">Магистр</option>
                <option value="Ученик">Ученик</option>
                <option value="Новый">Новый</option>
                <option value="Постоянный">Постоянный</option>
                <option value="Слушатель">Слушатель</option>
                <option value="Студент">Студент</option>
                <option value="Выпускник">Выпускник</option>
              </select>
            </div>

            <button 
              onClick={handleSave}
              disabled={saveStatus !== null}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-logo-blue transition-all disabled:opacity-50"
            >
              {saveStatus || 'Сохранить изменения'}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-6 rounded-3xl">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Посещено</h5>
            <p className="text-2xl font-black">12</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Бонусы</h5>
            <p className="text-2xl font-black">{(profile?.bonusBalance || 0).toLocaleString()} ₽</p>
          </div>
        </div>

        <div className="mt-12 p-6 bg-blue-50 rounded-3xl border border-blue-100">
          <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3">Реферальная ссылка</h5>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white px-4 py-3 rounded-xl text-[10px] font-mono text-slate-600 truncate border border-blue-100">
              {referralLink}
            </div>
            <button 
              onClick={copyReferralLink}
              className={`p-3 rounded-xl transition-all ${copied ? 'bg-green-500 text-white' : 'bg-white text-blue-600 hover:bg-blue-100 border border-blue-100'}`}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
          <p className="mt-3 text-[10px] text-blue-600 font-bold">
            Приглашайте друзей и получайте 10% от стоимости их первого платного семинара!
          </p>
        </div>

        <div className="mt-12 space-y-4">
          <ProfileRow label="Филиал" value={profile?.branch || 'Не указан'} />
          <ProfileRow label="Наставник" value="Ольга Воротникова" />
          <ProfileRow label="Пригласил" value={profile?.referrerId ? 'По ссылке' : 'Прямой вход'} />
        </div>
      </>
    )}
  </div>
</div>
  );
}

function ProfileRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-slate-50 last:border-0">
      <span className="text-sm font-bold text-slate-400">{label}</span>
      <span className="text-sm font-extrabold">{value}</span>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
        active 
          ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function AuthRequiredModal({ 
  onClose, 
  onLogin, 
  recognizedIdentity, 
  onResetIdentity 
}: { 
  onClose: () => void, 
  onLogin: () => void,
  recognizedIdentity?: { fullName: string, email: string } | null,
  onResetIdentity?: () => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-[40px] p-8 md:p-12 max-w-md w-full shadow-2xl relative text-center"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
          <X size={20} />
        </button>
        
        <div className="w-20 h-20 bg-logo-blue/10 rounded-3xl flex items-center justify-center mx-auto mb-8 text-logo-blue">
          <ShieldCheck size={40} />
        </div>
        
        {recognizedIdentity ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-black mb-2 tracking-tight">Рады вас видеть снова!</h3>
            <p className="text-slate-500 font-medium mb-8">
              Мы узнали ваше устройство. Вы заходили как<br/>
              <strong className="text-slate-900 text-lg uppercase tracking-tight block mt-1">{recognizedIdentity.fullName}</strong>
            </p>

            <div className="space-y-3">
              <button 
                onClick={onLogin}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-logo-blue transition-all active:scale-95 shadow-xl shadow-slate-200"
              >
                Продолжить вход
              </button>
              <button 
                onClick={onResetIdentity}
                className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors block w-full text-center py-2"
              >
                Это не я / Другой аккаунт
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-black mb-4">Вначале необходимо авторизоваться</h3>
            
            <div className="space-y-4 text-slate-600 mb-10">
              <p className="text-sm leading-relaxed">
                Чтобы записаться на мероприятие, пожалуйста:
              </p>
              <ol className="text-sm text-left space-y-3 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-logo-blue text-white rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Нажмите кнопку <strong>«Авторизоваться»</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-logo-blue text-white rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Пройдите вход через Google</span>
                </li>
              </ol>
            </div>
            
            <button 
              onClick={onLogin}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-logo-blue transition-all active:scale-95"
            >
              Авторизоваться сейчас
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// --- New Public Components ---

function EventInputPublic({ events, onBack }: { events: Event[], onBack: () => void }) {
  const [title, setTitle] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [location, setLocation] = useState('');
  const [branch, setBranch] = useState('Все филиалы');
  const [sessionsCount, setSessionsCount] = useState(1);
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(2);
  const [price, setPrice] = useState(0);
  const [discounts, setDiscounts] = useState('');
  const [access, setAccess] = useState('');
  const [format, setFormat] = useState<'Онлайн' | 'Оффлайн'>('Оффлайн');
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [status, setStatus] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Event[]>([]);

  const locations = Array.from(new Set(events.map(e => e.location))).sort((a, b) => {
    const countA = events.filter(e => e.location === a).length;
    const countB = events.filter(e => e.location === b).length;
    return countB - countA;
  });

  const checkConflicts = (newStart: Date, newEnd: Date) => {
    return events.filter(event => {
      const eventStart = getEventDate(event.startTime);
      const eventEnd = event.endTime ? getEventDate(event.endTime) : new Date(eventStart.getTime() + 2 * 60 * 60 * 1000);
      const overlaps = (newStart < eventEnd && newEnd > eventStart);
      return overlaps && (event.location.toLowerCase() === location.toLowerCase() && location.toLowerCase() !== 'онлайн');
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60 * 60 * 1000);
    
    const foundConflicts = checkConflicts(start, end);
    if (foundConflicts.length > 0 && conflicts.length === 0) {
      setConflicts(foundConflicts);
      return;
    }

    setStatus('Сохранение...');
    try {
      await addDoc(collection(db, 'events'), {
        title,
        speakerName,
        location,
        branch,
        sessionsCount: Number(sessionsCount),
        startTime: start,
        endTime: end,
        category: 'Семинар',
        price: Number(price),
        discounts,
        access,
        format,
        maxParticipants: Number(maxParticipants),
        registeredCount: 0,
        status: 'planned',
        createdAt: serverTimestamp()
      });
      setStatus('Событие добавлено!');
      setTimeout(onBack, 2000);
    } catch (error) {
      setStatus('Ошибка при сохранении');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-4xl font-black mb-12">Ввод мероприятия</h2>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-12">
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Название события" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" required />
              <input type="text" value={speakerName} onChange={e => setSpeakerName(e.target.value)} placeholder="Спикер" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" required />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <input 
                  type="text" 
                  list="public-locations"
                  value={location} 
                  onChange={e => setLocation(e.target.value)} 
                  placeholder="Где будет проходить? (Место проведения)" 
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" 
                  required 
                />
                <datalist id="public-locations">
                  {locations.map(loc => <option key={loc} value={loc} />)}
                </datalist>
              </div>
              <select 
                value={branch} 
                onChange={e => setBranch(e.target.value)} 
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none appearance-none"
              >
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 px-6 py-4 bg-slate-50 rounded-2xl">
                <span className="text-xs font-black text-slate-400 uppercase">Занятий:</span>
                <input type="number" value={sessionsCount} onChange={e => setSessionsCount(Number(e.target.value))} className="flex-1 bg-transparent font-bold outline-none" min="1" required />
              </div>
              <select 
                value={format} 
                onChange={e => setFormat(e.target.value as any)} 
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none appearance-none"
              >
                <option value="Оффлайн">Оффлайн</option>
                <option value="Онлайн">Онлайн</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" required />
              <div className="flex items-center gap-2 px-6 py-4 bg-slate-50 rounded-2xl">
                <span className="text-xs font-black text-slate-400 uppercase">Цена:</span>
                <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="flex-1 bg-transparent font-bold outline-none" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" value={discounts} onChange={e => setDiscounts(e.target.value)} placeholder="Возможные скидки" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" />
              <div className="flex items-center gap-2 px-6 py-4 bg-slate-50 rounded-2xl">
                <span className="text-xs font-black text-slate-400 uppercase">Мест:</span>
                <input type="number" value={maxParticipants} onChange={e => setMaxParticipants(Number(e.target.value))} className="flex-1 bg-transparent font-bold outline-none" min="1" required />
              </div>
            </div>
            <input type="text" value={access} onChange={e => setAccess(e.target.value)} placeholder="Кто допускается (уровень доступа)" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" />
          </div>

          {conflicts.length > 0 && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold">
              ⚠️ Обнаружен конфликт времени! В этом месте уже есть событие.
            </div>
          )}

          <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest">
            {status || "Сохранить мероприятие"}
          </button>
        </form>

        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Календарь занятости</h4>
          <MiniCalendar events={events} />
        </div>
      </div>
    </div>
  );
}

function MiniCalendar({ events }: { events: Event[] }) {
  const now = new Date();
  
  // Create an array of 35 days starting from today to fill a 5-week grid
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    return d;
  });

  return (
    <div className="grid grid-cols-7 gap-2">
      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
        <div key={d} className="text-[10px] font-black text-slate-300 text-center">{d}</div>
      ))}
      {days.map((date, i) => {
        const hasEvent = events.some(e => {
          const ed = getEventDate(e.startTime);
          return ed.getDate() === date.getDate() && 
                 ed.getMonth() === date.getMonth() && 
                 ed.getFullYear() === date.getFullYear();
        });
        const isToday = date.getDate() === now.getDate() && 
                        date.getMonth() === now.getMonth() && 
                        date.getFullYear() === now.getFullYear();

        return (
          <div 
            key={i} 
            className={`aspect-square flex flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all ${
              hasEvent 
                ? 'bg-logo-orange text-white shadow-lg shadow-logo-orange/20' 
                : isToday 
                  ? 'bg-logo-blue text-white' 
                  : 'bg-slate-50 text-slate-400'
            }`}
          >
            <span>{date.getDate()}</span>
            <span className="text-[7px] opacity-60 uppercase">{date.toLocaleString('ru', { month: 'short' }).replace('.', '')}</span>
          </div>
        );
      })}
    </div>
  );
}


function BlogRulesView() {
  return (
    <div className="p-8 md:p-12 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-logo-blue/10 rounded-2xl text-logo-blue">
          <BookOpen size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black">Правила ведения блога</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Академия Развития Человека</p>
        </div>
      </div>

      <div className="space-y-10">
        <section className="space-y-4">
          <h3 className="text-xl font-black flex items-center gap-2">
            <div className="w-2 h-8 bg-logo-blue rounded-full" />
            1. Общие принципы
          </h3>
          <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-2">
            <p className="text-sm text-slate-700 font-bold flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-logo-blue rounded-full" /> Блог ведётся ежедневно. Минимум один пост в день.
            </p>
            <p className="text-sm text-slate-700 font-bold flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-logo-blue rounded-full" /> Пост — это живой рассказ, а не технический отчёт.
            </p>
            <p className="text-sm text-slate-700 font-bold flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-logo-blue rounded-full" /> Понятно любому человеку, даже далёкому от технологий.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black flex items-center gap-2">
            <div className="w-2 h-8 bg-logo-orange rounded-full" />
            2. Тон и стиль
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
              <p className="text-xs font-black text-logo-orange uppercase mb-2">Человечность</p>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                Пиши легко, иногда с иронией. Избегай сухого официального языка. Можно быть честным: «мы облажались» или «неожиданно сработало».
              </p>
            </div>
            <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
              <p className="text-xs font-black text-logo-orange uppercase mb-2">Динамика</p>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                Используй короткие предложения. Можно задавать вопросы читателю, шутить и делиться эмоциями.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
              <p className="text-[10px] font-black text-red-600 uppercase mb-1">❌ Плохо:</p>
              <p className="text-xs italic text-red-500">«Был произведён рефакторинг модульной архитектуры...»</p>
            </div>
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
              <p className="text-[10px] font-black text-green-600 uppercase mb-1">✅ Хорошо:</p>
              <p className="text-xs italic text-green-500">«Переписали внутренности движка. Стало быстрее. Заняло два дня вместо четырех часов...»</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black flex items-center gap-2">
            <div className="w-2 h-8 bg-blue-500 rounded-full" />
            3. Язык и термины
          </h3>
          <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              Запрещено использовать профессиональные термины без расшифровки. Объясняй их простым языком сразу же.
            </p>
            <div className="p-4 bg-white rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Пример:</p>
              <p className="text-xs italic text-slate-500">
                «Настроили автоматическую сборку и выкладку (CI/CD — это когда код сам себя собирает и публикует без участия человека).»
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black flex items-center gap-2">
            <div className="w-2 h-8 bg-purple-500 rounded-full" />
            4. Социальные сети
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: 'Сайт', style: 'Полный' },
              { name: 'Telegram', style: 'Живой' },
              { name: 'MAX', style: 'Короткий' },
              { name: 'VK', style: 'Визуальный' }
            ].map(platform => (
              <div key={platform.name} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <p className="text-xs font-black text-slate-900">{platform.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{platform.style}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-black flex items-center gap-2">
            <div className="w-2 h-8 bg-red-500 rounded-full" />
            5. Стоп-лист
          </h3>
          <div className="flex flex-wrap gap-2">
            {['БД', 'ТЗ', 'UI/UX', 'Деплой', 'CI/CD', 'Docker', 'Kubernetes', 'Рефакторинг', 'Канцеляризмы'].map(word => (
              <span key={word} className="px-4 py-2 bg-red-50 text-red-600 rounded-full text-xs font-black uppercase tracking-widest border border-red-100">
                {word}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-4 pt-10 border-t border-slate-100">
          <h3 className="text-xl font-black flex items-center gap-2">
            <div className="w-2 h-8 bg-logo-blue rounded-full" />
            Дополнение: Посты в дни без активности
          </h3>
          <div className="p-6 bg-blue-50 rounded-[32px] border border-blue-100 space-y-4">
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Если в будний день в приложении не было изменений, система создаёт шуточный пост.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-blue-100">
                <p className="text-[10px] font-black text-logo-blue uppercase mb-1">Примеры тем:</p>
                <p className="text-xs italic text-slate-500">«вайбкодер спал», «муза не пришла», «код решил отдохнуть».</p>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-blue-100">
                <p className="text-[10px] font-black text-logo-blue uppercase mb-1">Правило выходных:</p>
                <p className="text-xs italic text-slate-500">В субботу и воскресенье шуточные посты не создаются.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <button 
        onClick={() => window.print()}
        className="mt-12 w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-logo-blue transition-all flex items-center justify-center gap-3"
      >
        <Copy size={20} /> Распечатать правила
      </button>
    </div>
  );
}
function ParticipantCardPublic({ onBack, events }: { onBack: () => void, events: Event[] }) {
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [patronymic, setPatronymic] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [maxNumber, setMaxNumber] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [participantStatus, setParticipantStatus] = useState('Ученик');
  const [attendedEvents, setAttendedEvents] = useState('');
  const [autoAttendedEvents, setAutoAttendedEvents] = useState<string[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recognizedDevice, setRecognizedDevice] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const savedParticipant = localStorage.getItem('last_participant');
    if (savedParticipant) {
      try {
        const data = JSON.parse(savedParticipant);
        setRecognizedDevice(data);
      } catch (e) {
        localStorage.removeItem('last_participant');
      }
    } else {
      setShowForm(true);
    }
  }, []);

  const handleRecognizedSubmit = async () => {
    if (!recognizedDevice) return;
    setSubmissionStatus('Сохранение...');
    try {
      await addDoc(collection(db, 'participants'), {
        ...recognizedDevice,
        autoAttendedEvents,
        createdAt: serverTimestamp()
      });
      setSubmissionStatus('Карточка сохранена!');
      setTimeout(onBack, 2000);
    } catch (error) {
      setSubmissionStatus('Ошибка');
    }
  };

  const startNewRegistration = () => {
    setRecognizedDevice(null);
    setShowForm(true);
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!email || !email.includes('@')) return;
      
      setIsSearching(true);
      try {
        // 1. Find user by email
        const usersRef = collection(db, 'users');
        const qUser = query(usersRef, where('email', '==', email));
        onSnapshot(qUser, (snapshot) => {
          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const uid = userDoc.id;

            // 2. Find registrations for this user
            const regRef = collection(db, 'registrations');
            const qReg = query(regRef, where('userId', '==', uid), where('status', '==', 'attended'));
            
            onSnapshot(qReg, (regSnapshot) => {
              const attendedIds = regSnapshot.docs.map(d => d.data().eventId);
              const attendedTitles = events
                .filter(e => attendedIds.includes(e.id))
                .map(e => e.title);
              setAutoAttendedEvents(attendedTitles);
              setIsSearching(false);
            });
          } else {
            setAutoAttendedEvents([]);
            setIsSearching(false);
          }
        });
      } catch (error) {
        console.error("Error fetching attendance:", error);
        setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchAttendance, 1000);
    return () => clearTimeout(timer);
  }, [email, events]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmissionStatus('Сохранение...');
    const formData = {
      lastName, firstName, patronymic,
      fullName: `${lastName} ${firstName} ${patronymic}`.trim(),
      phone, telegram, whatsapp, maxNumber, city, email,
      participantStatus,
      attendedEvents,
    };

    try {
      await addDoc(collection(db, 'participants'), {
        ...formData,
        autoAttendedEvents,
        createdAt: serverTimestamp()
      });
      
      // Save to device memory
      const identityData = {
        fullName: formData.fullName,
        email: formData.email
      };
      localStorage.setItem('last_participant', JSON.stringify(formData));
      localStorage.setItem('app_user_identity', JSON.stringify(identityData));
      
      setSubmissionStatus('Карточка сохранена!');
      setTimeout(onBack, 2000);
    } catch (error) {
      setSubmissionStatus('Ошибка');
    }
  };

  if (recognizedDevice && !showForm) {
    return (
      <div className="p-8 md:p-12 text-center">
        <div className="w-20 h-20 bg-logo-blue/10 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-logo-blue">
          <ShieldCheck size={40} />
        </div>
        <h2 className="text-2xl font-black mb-2">С возвращением!</h2>
        <p className="text-slate-500 font-medium mb-8">
          Вы уже регистрировались на этом устройстве как<br/>
          <strong className="text-slate-900">{recognizedDevice.fullName}</strong>
        </p>

        <div className="space-y-3">
          <button 
            onClick={handleRecognizedSubmit}
            disabled={submissionStatus !== null}
            className="w-full py-5 bg-logo-blue text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {submissionStatus || "Продолжить"}
          </button>
          <button 
            onClick={startNewRegistration}
            className="w-full py-4 bg-slate-50 text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all"
          >
            Это не я / Другой человек
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 max-h-[90vh] overflow-y-auto">
      <h2 className="text-3xl font-black mb-8">Карточка участника</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Фамилия</span>
            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Иванов" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none mt-1" required />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Имя</span>
            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Иван" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none mt-1" required />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Отчество</span>
            <input type="text" value={patronymic} onChange={e => setPatronymic(e.target.value)} placeholder="Иванович" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none mt-1" />
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Телефон" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" required />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (для поиска истории)" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" required />
          </div>
        </div>

        <div className="space-y-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Мессенджеры и доп. данные</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="WhatsApp номер" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" />
            <input type="text" value={telegram} onChange={e => setTelegram(e.target.value)} placeholder="Telegram (имя пользователя)" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Город проживания" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" />
            <input type="text" value={maxNumber} onChange={e => setMaxNumber(e.target.value)} placeholder="Номер в системе (Макс. номер)" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" />
          </div>
        </div>

        <div className="space-y-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Статус в Академии</span>
          <select 
            value={participantStatus} 
            onChange={e => setParticipantStatus(e.target.value)} 
            className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none appearance-none"
          >
            <option value="Мастер">Статус: Мастер</option>
            <option value="Магистр">Статус: Магистр</option>
            <option value="Ученик">Статус: Ученик</option>
            <option value="Новый">Статус: Новый</option>
            <option value="Постоянный">Статус: Постоянный</option>
            <option value="Слушатель">Статус: Слушатель</option>
            <option value="Студент">Статус: Студент</option>
            <option value="Выпускник">Статус: Выпускник</option>
          </select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">История посещений</span>
            {isSearching && <span className="text-[10px] font-bold text-logo-blue animate-pulse">Поиск истории...</span>}
          </div>
          
          {autoAttendedEvents.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-[10px] font-black text-logo-blue uppercase mb-2">Найдено в системе:</p>
              <ul className="space-y-1">
                {autoAttendedEvents.map((title, i) => (
                  <li key={i} className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <div className="w-1 h-1 bg-logo-blue rounded-full" /> {title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <textarea 
            value={attendedEvents} 
            onChange={e => setAttendedEvents(e.target.value)} 
            placeholder="Другие мероприятия (которые вы посещали ранее или которых нет в списке выше)" 
            className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none min-h-[100px]"
          />
        </div>

        <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-logo-blue transition-all active:scale-95">
          {submissionStatus || "Сохранить карточку"}
        </button>
      </form>
    </div>
  );
}
