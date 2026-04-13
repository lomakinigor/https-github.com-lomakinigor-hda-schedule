import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  LayoutDashboard,
  Settings,
  Search,
  X,
  ChevronDown,
  AlertCircle,
  Copy,
  Check
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

const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
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
const CATEGORIES = ['Все направления', 'Семинары', 'Вебинары', 'Практики'];
const PERIODS = ['Апрель 2026', 'Май 2026', 'Июнь 2026', 'Весь год'];

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

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'schedule' | 'admin' | 'profile' | 'event-input' | 'participant-card'>('schedule');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<'List' | 'Calendar'>('List');

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
    setFilterCategory('Все направления');
    setFilterPeriod('Весь год');
    setFilterDateFrom('');
    setFilterDateTo('');
  };
  const [filterLocation, setFilterLocation] = useState('');
  const [filterBranch, setFilterBranch] = useState('Все филиалы');
  const [filterCategory, setFilterCategory] = useState('Все направления');
  const [filterPeriod, setFilterPeriod] = useState('Весь год');
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
      setUser(u);
      if (u) {
        try {
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
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Firestore Listener for Events
  useEffect(() => {
    try {
      const q = query(collection(db, 'events'), orderBy('startTime', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const evs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
        setEvents(evs);
        setGlobalError(null);
      }, (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setGlobalError(`Ошибка загрузки событий: ${msg}`);
        logger.log('Firestore List Error', err);
      });
      return unsubscribe;
    } catch (err) {
      setGlobalError(`Критическая ошибка: ${err instanceof Error ? err.message : String(err)}`);
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
    if (!user || !profile) {
      alert('Пожалуйста, войдите в систему, чтобы записаться на событие.');
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
        amountPaid: event.price || 0,
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
      const matchesCategory = filterCategory === 'Все направления' || 
                             (filterCategory === 'Семинары' && event.category === 'Семинар') ||
                             (filterCategory === 'Вебинары' && event.category === 'Вебинар') ||
                             (filterCategory === 'Практики' && event.category === 'Практика');
      
      let matchesPeriod = true;
      if (filterPeriod !== 'Весь год') {
        const eventMonth = eventDate.getMonth();
        const eventYear = eventDate.getFullYear();
        
        // Explicit month/year matching for reliability
        if (filterPeriod === 'Апрель 2026') {
          matchesPeriod = eventMonth === 3 && eventYear === 2026;
        } else if (filterPeriod === 'Май 2026') {
          matchesPeriod = eventMonth === 4 && eventYear === 2026;
        } else if (filterPeriod === 'Июнь 2026') {
          matchesPeriod = eventMonth === 5 && eventYear === 2026;
        } else {
          // Fallback to string matching if period is unknown
          const monthNames = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
          const eventMonthName = monthNames[eventMonth];
          const fp = filterPeriod.toLowerCase();
          matchesPeriod = fp.includes(eventMonthName) && fp.includes(eventYear.toString());
        }
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
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-[5%] py-4 flex items-center justify-between sticky top-0 z-[100] shadow-sm">
        <div className="flex items-center gap-4">
          <Logo className="w-14 h-14" />
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-orange-500 leading-none">
            Академия Развития Человека
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold">{user.displayName}</p>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{profile?.role}</p>
              </div>
              <button 
                onClick={() => setView(view === 'profile' ? 'schedule' : 'profile')}
                className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 hover:border-logo-blue transition-all"
              >
                {user.photoURL ? <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" /> : <User size={20} />}
              </button>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-logo-blue transition-all active:scale-95 shadow-lg shadow-slate-200"
            >
              Войти
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex max-w-[1600px] mx-auto w-full overflow-hidden">
        {/* --- SIDEBAR --- */}
        <aside className="w-[280px] bg-white border-r border-slate-200 p-8 flex flex-col gap-8 overflow-y-auto scrollbar-hide hidden lg:flex">
          <div className="space-y-6">
            <div className="space-y-2 mb-8">
              <SidebarItem 
                icon={<Calendar size={18} />} 
                label="Расписание" 
                active={view === 'schedule'} 
                onClick={() => setView('schedule')} 
              />
              <SidebarItem 
                icon={<Plus size={18} />} 
                label="Ввод мероприятия" 
                active={view === 'event-input'} 
                onClick={() => setView('event-input')} 
              />
              <SidebarItem 
                icon={<User size={18} />} 
                label="Карточка участника" 
                active={view === 'participant-card'} 
                onClick={() => setView('participant-card')} 
              />
              {profile?.role === 'admin' && (
                <SidebarItem 
                  icon={<Settings size={18} />} 
                  label="Админ-панель" 
                  active={view === 'admin'} 
                  onClick={() => setView('admin')} 
                />
              )}
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Период</h4>
              <div className="space-y-1">
                {PERIODS.map(p => (
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
                {CATEGORIES.map(c => (
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
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
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
          </div>

          <button 
            onClick={() => setView('profile')}
            className="mt-auto w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-xs hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            Личный кабинет
          </button>
        </aside>

        {/* --- MAIN CONTENT --- */}
        <main className="flex-1 flex flex-col overflow-hidden p-8 md:p-12">
          <div className="flex items-end justify-between mb-8">
            <h2 className="text-4xl font-black tracking-tight">Расписание</h2>
            
            <div className="flex bg-slate-200 p-1 rounded-2xl">
              {['List', 'Calendar'].map((v) => (
                <button 
                  key={v}
                  onClick={() => setCalendarView(v as any)}
                  className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${calendarView === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {v === 'List' ? 'Список' : 'Календарь'}
                </button>
              ))}
            </div>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-white p-12 overflow-y-auto">
            <button onClick={() => setView('schedule')} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={24} /></button>
            <AdminPanel onBack={() => setView('schedule')} events={events} />
          </motion.div>
        )}
        {view === 'profile' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-white p-12 overflow-y-auto flex items-center justify-center">
            <button onClick={() => setView('schedule')} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={24} /></button>
            <UserProfileView user={user!} profile={profile} />
          </motion.div>
        )}
        {view === 'event-input' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-white p-12 overflow-y-auto">
            <button onClick={() => setView('schedule')} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={24} /></button>
            <EventInputPublic events={events} onBack={() => setView('schedule')} />
          </motion.div>
        )}
        {view === 'participant-card' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-white p-12 overflow-y-auto">
            <button onClick={() => setView('schedule')} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={24} /></button>
            <ParticipantCardPublic onBack={() => setView('schedule')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

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

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="group bg-white border border-slate-100 rounded-[32px] p-6 flex flex-col md:grid md:grid-cols-[120px_1fr_200px] gap-6 items-center transition-all hover:shadow-2xl hover:shadow-slate-200/50"
    >
      <div className="flex md:flex-col items-center justify-center md:border-r border-slate-100 md:pr-6 w-full md:w-auto">
        <span className="text-4xl font-black tracking-tighter leading-none">{day}</span>
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-2 md:ml-0 md:mt-1">{month}</span>
      </div>

      <div className="flex-1 w-full px-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: event.color || 'var(--color-logo-blue)' }}>
            {event.category}
          </span>
          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
            <MapPin size={10} /> {event.location} {event.format && `(${event.format})`}
          </span>
          {event.price !== undefined && (
            <span className="text-[10px] font-black text-logo-blue bg-blue-50 px-2 py-1 rounded-lg">
              {event.price === 0 ? 'БЕСПЛАТНО' : `${event.price.toLocaleString()} ₽`}
            </span>
          )}
        </div>
        <h3 className="text-2xl font-black tracking-tight group-hover:text-logo-blue transition-colors">{event.title}</h3>
        {event.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{event.description}</p>
        )}
        <div className="flex items-center gap-4 mt-2">
          <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
            <User size={14} className="text-slate-300" /> {event.speakerName}
          </p>
          {event.branch && (
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              {event.branch}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center md:items-end w-full md:w-auto">
        <button 
          onClick={onRegister}
          disabled={isRegistering}
          className="w-full md:w-auto bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold text-sm hover:bg-logo-blue transition-all active:scale-95 shadow-xl shadow-slate-200 disabled:opacity-50"
        >
          {isRegistering ? 'Запись...' : 'Записаться'}
        </button>
        <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-400">
          <Users size={12} />
          <span>{event.registeredCount || 0} / {event.maxParticipants || '∞'} мест</span>
        </div>
      </div>
    </motion.div>
  );
}

function AdminPanel({ onBack, events }: { onBack: () => void, events: Event[] }) {
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
      const transcript = event.results[0][0].transcript;
      setTitle(transcript);
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
      <div className="flex items-center justify-between mb-12">
        <h2 className="text-4xl font-black tracking-tight">Панель администратора</h2>
        <button onClick={onBack} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
          <X size={24} />
        </button>
      </div>

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
              <StatCard label="Всего участников" value="1,240" trend="+12%" />
              <StatCard label="Выручка" value="450,000 ₽" trend="+8%" />
              <StatCard label="Активные события" value="8" />
            </div>
          </div>
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
        maxParticipants: 50,
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
                  placeholder="Локация (выберите или введите)" 
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

            <input type="text" value={discounts} onChange={e => setDiscounts(e.target.value)} placeholder="Возможные скидки" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" />
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
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: (firstDay + 6) % 7 }, (_, i) => i);

  return (
    <div className="grid grid-cols-7 gap-2">
      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
        <div key={d} className="text-[10px] font-black text-slate-300 text-center">{d}</div>
      ))}
      {blanks.map(b => <div key={`b-${b}`} />)}
      {days.map(d => {
        const hasEvent = events.some(e => {
          const ed = getEventDate(e.startTime);
          return ed.getDate() === d && ed.getMonth() === now.getMonth() && ed.getFullYear() === now.getFullYear();
        });
        return (
          <div key={d} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold ${hasEvent ? 'bg-logo-orange text-white' : 'bg-slate-50 text-slate-400'}`}>
            {d}
          </div>
        );
      })}
    </div>
  );
}

function ParticipantCardPublic({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [interests, setInterests] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('Сохранение...');
    try {
      await addDoc(collection(db, 'participants'), {
        name, phone, email, interests,
        createdAt: serverTimestamp()
      });
      setStatus('Карточка сохранена!');
      setTimeout(onBack, 2000);
    } catch (error) {
      setStatus('Ошибка');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="text-4xl font-black mb-12">Карточка участника</h2>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="ФИО" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" required />
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Телефон" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" required />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none" required />
        <textarea value={interests} onChange={e => setInterests(e.target.value)} placeholder="Интересы / Направления" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none min-h-[120px]" />
        <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest">
          {status || "Отправить"}
        </button>
      </form>
    </div>
  );
}
