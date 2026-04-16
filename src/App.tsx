import React, { useState, useEffect, FormEvent, ErrorInfo, ReactNode } from 'react';
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
import { 
  Calendar, 
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
  X,
  Menu as MenuIcon,
  ShieldCheck,
  ChevronDown,
  AlertCircle,
  Copy,
  Check,
  BookOpen,
  BarChart3,
  PieChart as PieChartIcon,
  Activity
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
  increment
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
  baseExpenses?: {
    rent: number;
    speakerFee: number;
    marketing: number;
    other: number;
  };
  totalRevenue?: number;
  totalExpenses?: number;
  netProfit?: number;
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
  branch?: string;
  bonusBalance?: number;
  referrerId?: string;
}

const BRANCHES = ['Все филиалы', 'Екатеринбург', 'Москва', 'Санкт-Петербург', 'Новосибирск', 'Казань'];
const CATEGORIES = ['Семинары', 'Практики', 'Ретриты', 'Путешествия'];
const PERIODS = ['Месяц', 'Квартал', 'Год'];

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
  const [participantsCount, setParticipantsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<'List' | 'Calendar'>('List');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [sessionAnchorDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const isAdmin = profile?.role === 'admin' || user?.email === 'il17184@gmail.com';

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
          if (profileDoc.exists()) {
            const data = profileDoc.data() as UserProfile;
            // Force admin role for specific email
            if (u.email === 'il17184@gmail.com' && data.role !== 'admin') {
              const updatedProfile = { ...data, role: 'admin' as const };
              await setDoc(doc(db, 'users', u.uid), updatedProfile, { merge: true });
              setProfile(updatedProfile);
            } else {
              setProfile(data);
            }
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              displayName: u.displayName || 'Anonymous',
              email: u.email || '',
              role: u.email === 'il17184@gmail.com' ? 'admin' : 'participant',
              bonusBalance: 0,
              referrerId: referrerId || undefined
            };
            await setDoc(doc(db, 'users', u.uid), {
              ...newProfile,
              createdAt: serverTimestamp()
            });
            setProfile(newProfile);
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth profile error:", err);
        // We still want to stop loading even if profile fetch fails
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [referrerId]);

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
  }, []);

  // Firestore Listener for Participants Count
  useEffect(() => {
    try {
      const q = query(collection(db, 'participants'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setParticipantsCount(snapshot.size);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'participants');
      });
      return unsubscribe;
    } catch (err) {
      logger.log('Participants Listener Error', err);
      return () => {};
    }
  }, []);

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
      await signInWithPopup(auth, provider);
    } catch (err) {
      logger.log("Login failed", err);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleRegister = async (event: Event) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setRegisteringEventId(event.id);
    try {
      // 1. Create registration
      const regId = `${user.uid}_${event.id}`;
      const regDoc = await getDoc(doc(db, 'registrations', regId));
      
      if (regDoc.exists()) {
        alert('Вы уже записаны на это событие.');
        return;
      }

      await setDoc(doc(db, 'registrations', regId), {
        userId: user.uid,
        eventId: event.id,
        status: 'registered',
        paid: (event.price || 0) > 0,
        totalPrice: event.price || 0,
        amountPaid: event.price || 0,
        paymentStatus: 'paid',
        registrationDate: serverTimestamp()
      });

      // 2. Increment event count
      await updateDoc(doc(db, 'events', event.id), {
        registeredCount: increment(1)
      });

      // 3. Referral Bonus Logic
      if (profile.referrerId && (event.price || 0) > 0) {
        const bonusAmount = Math.floor((event.price || 0) * 0.1);
        if (bonusAmount > 0) {
          await updateDoc(doc(db, 'users', profile.referrerId), {
            bonusBalance: increment(bonusAmount)
          });
          logger.log(`Referral bonus of ${bonusAmount} awarded to ${profile.referrerId}`);
        }
      }

      alert('Вы успешно записались на событие!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `registrations/${user.uid}_${event.id}`);
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
      const matchesCategory = filterCategory === 'Seminars' ? event.category === 'Семинар' :
                             filterCategory === 'Practices' ? event.category === 'Практика' :
                             filterCategory === 'Retreats' ? event.category === 'Ретрит' :
                             filterCategory === 'Travels' ? event.category === 'Путешествие' : true;
      
      let matchesPeriod = true;
      const eventTime = eventDate.getTime();
      const anchorTime = sessionAnchorDate.getTime();

      if (filterPeriod === 'Month') {
        const oneMonthLater = new Date(sessionAnchorDate);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        matchesPeriod = eventTime >= anchorTime && eventTime < oneMonthLater.getTime();
      } else if (filterPeriod === 'Quarter') {
        const threeMonthsLater = new Date(sessionAnchorDate);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
        matchesPeriod = eventTime >= anchorTime && eventTime < threeMonthsLater.getTime();
      } else if (filterPeriod === 'Year') {
        const twelveMonthsLater = new Date(sessionAnchorDate);
        twelveMonthsLater.setFullYear(twelveMonthsLater.getFullYear() + 1);
        matchesPeriod = eventTime >= anchorTime && eventTime < twelveMonthsLater.getTime();
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
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-950 flex flex-col">
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
          <h1 className="flex-1 text-2xl md:text-6xl font-black uppercase tracking-tighter text-orange-500 leading-none cursor-pointer truncate py-2" onClick={() => setView('schedule')}>
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
                        onRegister={() => handleRegister(event)}
                        isRegistering={registeringEventId === event.id}
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
            <AdminPanel onBack={() => setView('schedule')} events={events} financeRecords={financeRecords} participantsCount={participantsCount} />
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
          <AuthRequiredModal onClose={() => setShowAuthModal(false)} onLogin={() => { setShowAuthModal(false); handleLogin(); }} />
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
            <button 
              disabled
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-50 text-slate-400 rounded-2xl font-bold text-sm border border-slate-100 cursor-not-allowed opacity-60"
            >
              <ShieldCheck size={18} />
              <span>Админ</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Период</h4>
          <div className="space-y-1">
            {PERIODS.map((p: string) => (
              <button 
                key={p}
                onClick={() => setFilterPeriod(p)}
                className={`w-full text-left px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterPeriod === p ? 'bg-slate-100 text-logo-blue border border-slate-200' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Направления</h4>
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
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Доп. фильтры</h4>
          
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
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 ring-logo-blue outline-none appearance-none cursor-pointer"
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

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Диапазон дат</label>
            <div className="grid grid-cols-2 gap-2">
              <input 
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold focus:ring-2 ring-logo-blue outline-none"
                placeholder="От"
              />
              <input 
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold focus:ring-2 ring-logo-blue outline-none"
                placeholder="До"
              />
            </div>
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
  onRegister: () => void | Promise<void>;
  isRegistering: boolean;
}

function EventRow({ event, onRegister, isRegistering }: EventRowProps) {
  const date = getEventDate(event.startTime);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('ru', { month: 'short' });
  const registeredCount = event.registeredCount || 0;
  const isFull = event.maxParticipants && registeredCount >= event.maxParticipants;

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="group bg-white border border-slate-100 rounded-[32px] p-5 md:p-6 flex flex-col md:grid md:grid-cols-[120px_1fr_200px] gap-4 md:gap-6 items-center transition-all hover:shadow-2xl hover:shadow-slate-200/50"
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
              <Calendar size={12} /> Расписание занятий ({event.sessionsCount})
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
        <button 
          onClick={onRegister}
          disabled={isRegistering || isFull}
          className="w-full md:w-auto bg-slate-900 text-white px-10 py-5 md:py-4 rounded-2xl font-bold text-sm hover:bg-logo-blue transition-all active:scale-95 shadow-xl shadow-slate-200 disabled:opacity-50"
        >
          {isRegistering ? 'Запись...' : isFull ? 'Мест нет' : 'Записаться'}
        </button>
        <div className={`mt-4 md:mt-3 flex items-center gap-2 px-4 py-2 md:px-3 md:py-1.5 rounded-xl border ${isFull ? 'bg-red-50 border-red-100 text-red-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
          <Users size={12} className={isFull ? 'text-red-400' : 'text-slate-400'} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {registeredCount} / {event.maxParticipants || '∞'} ЗАПИСАНО
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function AdminPanel({ onBack, events, financeRecords, participantsCount }: { onBack: () => void, events: Event[], financeRecords: FinanceRecord[], participantsCount: number }) {
  const [subView, setSubView] = useState<'events' | 'finance' | 'analytics'>('events');
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
  const [discounts, setDiscounts] = useState('');
  const [access, setAccess] = useState('');
  const [rentExpense, setRentExpense] = useState(0);
  const [speakerFee, setSpeakerFee] = useState(0);
  const [format, setFormat] = useState<'Онлайн' | 'Оффлайн'>('Оффлайн');
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [isListening, setIsListening] = useState(false);
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
      // Assume 2h duration if endTime is missing in legacy data
      const eventEnd = event.endTime ? getEventDate(event.endTime) : new Date(eventStart.getTime() + 2 * 60 * 60 * 1000);
      
      const overlaps = (newStart < eventEnd && newEnd > eventStart);
      const sameSpeaker = event.speakerName.toLowerCase() === speakerName.toLowerCase();
      const sameLocation = event.location.toLowerCase() === location.toLowerCase() && location.toLowerCase() !== 'онлайн';
      
      return overlaps && (sameSpeaker || sameLocation);
    });
  };

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Ваш браузер не поддерживает голосовой ввод.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      
      // Intelligent Voice Assistant Logic
      // Example: "Семинар Второе рождение спикер Ольга Воротникова цена 5000"
      
      // 1. Title Extraction (everything before keywords)
      const keywords = ['спикер', 'цена', 'дата', 'локация', 'филиал'];
      let mainTitle = transcript;
      keywords.forEach(k => {
        const idx = mainTitle.indexOf(k);
        if (idx !== -1) mainTitle = mainTitle.substring(0, idx);
      });
      if (mainTitle.trim()) setTitle(mainTitle.trim().charAt(0).toUpperCase() + mainTitle.trim().slice(1));

      // 2. Speaker Extraction
      const speakerMatch = transcript.match(/спикер\s+([а-яё\s]+?)(?=\s+цена|\s+дата|\s+локация|\s+филиал|$)/);
      if (speakerMatch) setSpeakerName(speakerMatch[1].trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));

      // 3. Price Extraction
      const priceMatch = transcript.match(/цена\s+(\d+)/);
      if (priceMatch) setPrice(Number(priceMatch[1]));

      // 4. Location Extraction
      const locationMatch = transcript.match(/локация\s+([а-яё\s]+?)(?=\s+спикер|\s+цена|\s+дата|\s+филиал|$)/);
      if (locationMatch) setLocation(locationMatch[1].trim().charAt(0).toUpperCase() + locationMatch[1].trim().slice(1));

      // 5. Branch Extraction
      const branchMatch = transcript.match(/филиал\s+([а-яё\s]+?)(?=\s+спикер|\s+цена|\s+дата|\s+локация|$)/);
      if (branchMatch) {
        const bName = branchMatch[1].trim();
        const found = BRANCHES.find(b => b.toLowerCase().includes(bName.toLowerCase()));
        if (found) setBranch(found);
      }
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
      await addDoc(collection(db, 'events'), {
        title,
        description,
        speakerName,
        location,
        branch,
        sessionsCount: Number(sessionsCount),
        startTime: start,
        endTime: end,
        category,
        price: Number(price),
        discounts,
        access,
        format,
        maxParticipants: Number(maxParticipants),
        registeredCount: 0,
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
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'events');
      setStatus('Ошибка при сохранении');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-black tracking-tight">Управление системой</h2>
        <button onClick={onBack} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="flex gap-4 mb-12 overflow-x-auto pb-2 scrollbar-hide">
        <button 
          onClick={() => setSubView('events')}
          className={`px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${
            subView === 'events' 
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
          }`}
        >
          Мероприятия
        </button>
        <button 
          onClick={() => setSubView('finance')}
          className={`px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${
            subView === 'finance' 
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
          }`}
        >
          Финансы
        </button>
        <button 
          onClick={() => setSubView('analytics')}
          className={`px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${
            subView === 'analytics' 
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
          }`}
        >
          Аналитика
        </button>
      </div>

      {subView === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12">
        <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-2xl shadow-slate-200/50">
          <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
            <Plus className="text-logo-blue" /> Новое событие
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Название события</label>
              <div className="relative">
                <input 
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                  placeholder="Введите название..."
                  required
                />
                <button 
                  type="button"
                  onClick={startVoiceInput}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${
                    isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  <Mic size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Спикер</label>
                <input 
                  type="text"
                  value={speakerName}
                  onChange={(e) => setSpeakerName(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                  placeholder="Имя спикера..."
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Дата и время</label>
                <input 
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Длительность (ч)</label>
                <input 
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                  min="0.5"
                  step="0.5"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Локация</label>
                <div className="relative">
                  <input 
                    type="text"
                    list="admin-locations"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                    placeholder="Выберите или введите..."
                    required
                  />
                  <datalist id="admin-locations">
                    {locations.map(loc => <option key={loc} value={loc} />)}
                  </datalist>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Филиал</label>
                <select 
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all appearance-none cursor-pointer"
                >
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Кол-во занятий</label>
                <input 
                  type="number"
                  value={sessionsCount}
                  onChange={(e) => setSessionsCount(Number(e.target.value))}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Формат</label>
                <select 
                  value={format}
                  onChange={(e) => setFormat(e.target.value as any)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="Оффлайн">Оффлайн</option>
                  <option value="Онлайн">Онлайн</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Категория</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all appearance-none cursor-pointer"
                >
                  {CATEGORIES.filter(c => c !== 'Все направления').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Цена (₽)</label>
                <input 
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Скидки</label>
                <input 
                  type="text"
                  value={discounts}
                  onChange={(e) => setDiscounts(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                  placeholder="Напр. '10% до 01.05'..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Допуск</label>
                <input 
                  type="text"
                  value={access}
                  onChange={(e) => setAccess(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                  placeholder="Напр. 'Все желающие'..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Аренда (₽)</label>
                <input 
                  type="number"
                  value={rentExpense}
                  onChange={(e) => setRentExpense(Number(e.target.value))}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Гонорар спикера (₽)</label>
                <input 
                  type="number"
                  value={speakerFee}
                  onChange={(e) => setSpeakerFee(Number(e.target.value))}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all"
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Описание</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-4 ring-logo-blue/20 outline-none transition-all min-h-[120px]"
                placeholder="Краткое описание события..."
              />
            </div>

            {conflicts.length > 0 && (
              <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl space-y-4">
                <div className="flex items-center gap-3 text-amber-700 font-black uppercase tracking-widest text-[10px]">
                  <AlertCircle size={16} /> Обнаружены конфликты
                </div>
                <div className="space-y-2">
                  {conflicts.map(c => (
                    <div key={c.id} className="text-xs font-bold text-amber-800 bg-white/50 p-3 rounded-xl border border-amber-100">
                      ⚠️ {c.title} ({getEventDate(c.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {c.endTime ? getEventDate(c.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'})
                    </div>
                  ))}
                </div>
                <p className="text-[10px] font-bold text-amber-600">
                  Нажмите «Опубликовать» еще раз, чтобы проигнорировать и сохранить.
                </p>
                <button 
                  type="button"
                  onClick={() => setConflicts([])}
                  className="text-[10px] font-black uppercase tracking-widest text-amber-700 hover:underline"
                >
                  Изменить данные
                </button>
              </div>
            )}

            <button 
              type="submit"
              className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl ${
                conflicts.length > 0 
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200' 
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200'
              }`}
            >
              {status || (conflicts.length > 0 ? "Проигнорировать и сохранить" : "Опубликовать событие")}
            </button>
          </form>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
            <h4 className="text-lg font-black mb-6">Статистика</h4>
            <div className="space-y-4">
              <StatCard label="Всего участников" value={participantsCount.toLocaleString()} />
              <StatCard label="Выручка" value={`${financeRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0).toLocaleString()} ₽`} />
              <StatCard label="Активные события" value={events.filter(e => e.status !== 'completed' && e.status !== 'cancelled').length.toString()} />
            </div>
          </div>
        </div>
      </div>
      )}
      {subView === 'finance' && (
        <FinanceView events={events} records={financeRecords} />
      )}

      {subView === 'analytics' && (
        <AnalyticsDashboard events={events} records={financeRecords} participantsCount={participantsCount} />
      )}
    </div>
  );
}

function AnalyticsDashboard({ events, records, participantsCount }: { events: Event[], records: FinanceRecord[], participantsCount: number }) {
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
    const existing = acc.find(item => item.name === e.category);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: e.category, value: 1 });
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

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-5 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Заполняемость</p>
          <p className="text-xl md:text-3xl font-black">
            {Math.round((events.reduce((sum, e) => sum + e.registeredCount, 0) / events.reduce((sum, e) => sum + (e.maxParticipants || 0), 0)) * 100) || 0}%
          </p>
        </div>
        <div className="bg-white p-5 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Средний чек</p>
          <p className="text-xl md:text-3xl font-black">
            {Math.round(records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0) / (events.reduce((sum, e) => sum + e.registeredCount, 0) || 1)).toLocaleString()} ₽
          </p>
        </div>
        <div className="bg-white p-5 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">База участников</p>
          <p className="text-xl md:text-3xl font-black">{participantsCount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">ROI (Средний)</p>
          <p className="text-xl md:text-3xl font-black text-green-500">+24%</p>
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

function FinanceView({ events, records }: { events: Event[], records: FinanceRecord[] }) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Аренда');
  const [eventId, setEventId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const totalIncome = records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
  const netProfit = totalIncome - totalExpense;

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          <div className="flex items-center gap-3 text-logo-blue mb-4">
            <TrendingUp size={24} />
            <span className="text-xs font-black uppercase tracking-widest">Чистая прибыль</span>
          </div>
          <p className="text-3xl font-black">{netProfit.toLocaleString()} ₽</p>
        </div>
      </div>

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
                onClick={() => setType('expense')}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${type === 'expense' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400'}`}
              >
                Расход
              </button>
              <button 
                type="button"
                onClick={() => setType('income')}
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
          <div className="text-center md:text-left">
            <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 inline-block">
              {profile?.role || 'Участник'}
            </span>
            <h2 className="text-3xl font-black tracking-tight">{user.displayName}</h2>
            <p className="text-slate-400 font-medium">{user.email}</p>
          </div>
        </div>

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

function AuthRequiredModal({ onClose, onLogin }: { onClose: () => void, onLogin: () => void }) {
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
        
        <h3 className="text-2xl font-black mb-4">Вначале необходимо авторизоваться</h3>
        
        <div className="space-y-4 text-slate-600 mb-10">
          <p className="text-sm leading-relaxed">
            Чтобы записаться на мероприятие, пожалуйста, выполните следующие действия:
          </p>
          <ol className="text-sm text-left space-y-3 bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-logo-blue text-white rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
              <span>Нажмите кнопку <strong>«Войти»</strong> в левом сайдбаре.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-logo-blue text-white rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
              <span>Пройдите авторизацию через Google.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-logo-blue text-white rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
              <span>После этого вернитесь и нажмите <strong>«Записаться»</strong> снова.</span>
            </li>
          </ol>
        </div>
        
        <button 
          onClick={onLogin}
          className="w-full py-4 bg-logo-blue text-white rounded-2xl font-black text-sm hover:shadow-xl hover:shadow-logo-blue/20 transition-all active:scale-95"
        >
          Авторизоваться сейчас
        </button>
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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [maxNumber, setMaxNumber] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [participantStatus, setParticipantStatus] = useState('Новый');
  const [attendedEvents, setAttendedEvents] = useState('');
  const [autoAttendedEvents, setAutoAttendedEvents] = useState<string[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

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
    try {
      await addDoc(collection(db, 'participants'), {
        name, phone, telegram, whatsapp, maxNumber, city, email,
        participantStatus,
        attendedEvents,
        autoAttendedEvents,
        createdAt: serverTimestamp()
      });
      setSubmissionStatus('Карточка сохранена!');
      setTimeout(onBack, 2000);
    } catch (error) {
      setSubmissionStatus('Ошибка');
    }
  };

  return (
    <div className="p-8 md:p-12 max-h-[90vh] overflow-y-auto">
      <h2 className="text-3xl font-black mb-8">Карточка участника</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Основная информация</span>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="ФИО" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none mt-1" required />
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
