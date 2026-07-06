import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Check, Brain, Palette, Code,
  Wrench, Users, Stethoscope, Scale, BarChart3, Mic, BookOpen,
  Rocket, Plus, Send, Loader2, AlertTriangle, ChevronLeft, ChevronRight,
  Sparkles, User, BrainCircuit, GraduationCap, CheckCircle2,
  RefreshCw, Atom, TrendingUp, Megaphone, Sparkle
} from 'lucide-react';
import { discoverDreamChatReply, discoverDreamAnalyze } from '../services/geminiService';
import { SUBJECTS, INTERESTS_LIST } from '../services/questions';


interface DreamDiscoveryProps {
  onComplete: (dream: string, subjects: string[]) => void;
  onSkip: () => void;
  isLight?: boolean;
  studentName: string;
  studentClass: string;
  studentStream: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

function getInterestIcon(interest: string, isOn: boolean, isLight: boolean) {
  const cls = 'w-4 h-4 shrink-0';
  let color = '';
  if (isOn) {
    color = isLight ? '#ea580c' : '#ffffff';
  } else {
    switch (interest) {
      case 'Technology & Coding':    color = isLight ? '#0284c7' : '#38bdf8'; break;
      case 'Science & Research':     color = isLight ? '#059669' : '#34d399'; break;
      case 'Art & Design':           color = isLight ? '#db2777' : '#f472b6'; break;
      case 'Business & Finance':     color = isLight ? '#d97706' : '#fbbf24'; break;
      case 'Healthcare & Medicine':  color = isLight ? '#dc2626' : '#f87171'; break;
      case 'Engineering':            color = isLight ? '#d97706' : '#ffd700'; break;
      case 'Media & Communication':  color = isLight ? '#0891b2' : '#22d3ee'; break;
      case 'Law & Justice':          color = isLight ? '#4f46e5' : '#818cf8'; break;
      case 'Teaching & Education':   color = isLight ? '#0d9488' : '#2dd4bf'; break;
      case 'Music & Performance':    color = isLight ? '#9333ea' : '#c084fc'; break;
      case 'Social Work & NGOs':     color = isLight ? '#b45309' : '#ffd700'; break;
      case 'Space & Aviation':       color = isLight ? '#7c3aed' : '#a78bfa'; break;
      default:                       color = isLight ? '#ea580c' : '#fb923c';
    }
  }

  switch (interest) {
    case 'Technology & Coding':    return <Code       className={cls} style={{ color }} />;
    case 'Science & Research':     return <Atom       className={cls} style={{ color }} />;
    case 'Art & Design':           return <Palette    className={cls} style={{ color }} />;
    case 'Business & Finance':     return <TrendingUp className={cls} style={{ color }} />;
    case 'Healthcare & Medicine':  return <Stethoscope className={cls} style={{ color }} />;
    case 'Engineering':            return <Wrench     className={cls} style={{ color }} />;
    case 'Media & Communication':  return <Megaphone  className={cls} style={{ color }} />;
    case 'Law & Justice':          return <Scale      className={cls} style={{ color }} />;
    case 'Teaching & Education':   return <BookOpen   className={cls} style={{ color }} />;
    case 'Music & Performance':    return <Mic        className={cls} style={{ color }} />;
    case 'Social Work & NGOs':     return <Users      className={cls} style={{ color }} />;
    case 'Space & Aviation':       return <Rocket     className={cls} style={{ color }} />;
    case 'Other Area':
    default:                       return <Plus       className={cls} style={{ color }} />;
  }
}

/* ── Cosmic decorative background wrapper ── */
function CosmicBG({ isLight }: { isLight: boolean }) {
  if (isLight) {
    return (
      <>
        {/* Soft light background */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0,
          background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)'
        }} />
        {/* Light ambient glows */}
        <div style={{ position: 'fixed', top: 0, right: 0, width: 500, height: 500, borderRadius: '50%', background: '#fff7ed', filter: 'blur(100px)', pointerEvents: 'none', opacity: 0.8, zIndex: 0 }} />
        <div style={{ position: 'fixed', bottom: 0, left: 0, width: 400, height: 400, borderRadius: '50%', background: '#f0f9ff', filter: 'blur(100px)', pointerEvents: 'none', opacity: 0.6, zIndex: 0 }} />
      </>
    );
  }
  return (
    <>
      {/* Deep space base */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: `
          radial-gradient(ellipse 80% 80% at 20% 10%, rgba(0,212,255,0.18) 0%, transparent 55%),
          radial-gradient(ellipse 100% 70% at 85% 5%, rgba(255,215,0,0.07) 0%, transparent 50%),
          radial-gradient(ellipse 90% 90% at 50% 90%, rgba(0,100,255,0.22) 0%, transparent 60%),
          radial-gradient(ellipse 60% 60% at 75% 50%, rgba(0,212,255,0.10) 0%, transparent 55%),
          linear-gradient(180deg, #020713 0%, #040d24 40%, #061130 70%, #020713 100%)
        `
      }} />
      {/* Star field */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          radial-gradient(1px 1px at  8% 12%, rgba(255,255,255,0.9), transparent),
          radial-gradient(1px 1px at 25% 35%, rgba(255,255,255,0.7), transparent),
          radial-gradient(2px 2px at 42%  8%, rgba(255,255,255,0.8), transparent),
          radial-gradient(1px 1px at 60% 65%, rgba(255,255,255,0.6), transparent),
          radial-gradient(1px 1px at 78% 22%, rgba(255,255,255,0.9), transparent),
          radial-gradient(2px 2px at 92% 48%, rgba(255,255,255,0.7), transparent),
          radial-gradient(1px 1px at 15% 75%, rgba(255,255,255,0.5), transparent),
          radial-gradient(1px 1px at 35% 85%, rgba(255,255,255,0.8), transparent),
          radial-gradient(2px 2px at 55% 45%, rgba(255,255,255,0.6), transparent),
          radial-gradient(1px 1px at 85% 80%, rgba(255,255,255,0.7), transparent),
          radial-gradient(1px 1px at 70% 15%, rgba(211,156,59,0.5), transparent),
          radial-gradient(1px 1px at 20% 55%, rgba(0,212,255,0.4), transparent)
        `,
        backgroundSize: '400px 400px, 600px 600px, 350px 350px, 500px 500px, 450px 450px, 700px 700px, 300px 300px, 550px 550px, 650px 650px, 480px 480px, 380px 380px, 420px 420px',
        animation: 'starTwinkle 8s ease-in-out infinite alternate',
        opacity: 0.6
      }} />
      {/* Nebula decorative blobs */}
      <div style={{ position: 'fixed', width: 600, height: 600, top: -150, left: -100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,80,140,0.22) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 500, height: 500, bottom: -100, right: -50, borderRadius: '50%', background: 'radial-gradient(circle, rgba(40,100,180,0.18) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 400, height: 400, top: '40%', left: '50%', transform: 'translateX(-50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(15,45,95,0.15) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
    </>
  );
}

export default function DreamDiscovery({
  onComplete, onSkip, isLight = false,
  studentName, studentClass, studentStream
}: DreamDiscoveryProps) {
  /* ── Screen state ── */
  const [screen, setScreen] = useState<'welcome' | 'chat' | 'loading' | 'results'>('welcome');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [formError, setFormError] = useState('');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ── Academic Preferences ── */
  const [favouriteSubject, setFavouriteSubject] = useState('');
  const [easiestSubject, setEasiestSubject]     = useState('');
  const [hardestSubject, setHardestSubject]     = useState('');
  const [localSubjects, setLocalSubjects]       = useState<string[]>(SUBJECTS);
  const [isEditingFav, setIsEditingFav]         = useState(false);
  const [isEditingEasy, setIsEditingEasy]       = useState(false);
  const [isEditingHard, setIsEditingHard]       = useState(false);
  const [interests, setInterests]               = useState<string[]>([]);
  const [customInterest, setCustomInterest]     = useState('');

  /* ── Chat ── */
  const [chatHistory, setChatHistory]             = useState<ChatMessage[]>([]);
  const [suggestedOptions, setSuggestedOptions]   = useState<string[]>([]);
  const [chatInputValue, setChatInputValue]       = useState('');
  const [isChatLoading, setIsChatLoading]         = useState(false);
  const [chatError, setChatError]                 = useState('');

  /* ── Loading ── */
  const [loadingText, setLoadingText]           = useState('Reading your answers carefully...');
  const [loadingError, setLoadingError]         = useState('');
  const [spinnerEmoji, setSpinnerEmoji]         = useState('🧬');

  /* ── Results ── */
  const [result, setResult]       = useState<any>(null);
  const [careerPage, setCareerPage] = useState(1);

  const chatEndRef      = useRef<HTMLDivElement>(null);
  const isAnalyzingRef  = useRef(false);
  const userAnswers     = chatHistory.filter(m => m.role === 'user').length;

  /* ── Theme Definitions based on isLight ── */
  const theme = {
    textMain: isLight ? '#374151' : '#ffb380',
    textBright: isLight ? '#111827' : '#ffffff',
    textMuted: isLight ? '#6b7280' : 'rgba(255,160,100,0.55)',
    gold: isLight ? '#b45309' : '#ffd700', // Deep amber vs gold
    orange: isLight ? '#ea580c' : '#ff8c42',
    orangeDim: isLight ? 'rgba(234,88,12,0.1)' : 'rgba(255,140,66,0.22)',
    glassCard: isLight 
      ? { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }
      : { background: 'rgba(4,13,36,0.65)', backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)', border: '1px solid rgba(255,140,66,0.22)', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)' },
    innerCard: isLight
      ? { background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 14 }
      : { background: 'rgba(3,8,22,0.50)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,140,66,0.15)', borderRadius: 14 },
    btnPrimary: isLight
      ? { background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#ffffff', border: 'none', borderRadius: 12, fontFamily: "'Inter', sans-serif", fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(234,88,12,0.2)' }
      : { background: 'linear-gradient(135deg, #ff8c42, #ea580c)', color: '#ffffff', border: 'none', borderRadius: 12, fontFamily: "'Inter', sans-serif", fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(234,88,12,0.35)' },
    btnGhost: isLight
      ? { background: '#ffffff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 12, fontFamily: "'Inter', sans-serif", fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
      : { background: 'rgba(255,140,66,0.07)', color: '#ffb380', border: '1px solid rgba(255,140,66,0.22)', borderRadius: 12, fontFamily: "'Inter', sans-serif", fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' },
    selectInput: isLight
      ? { background: '#ffffff', border: '1px solid #d1d5db', color: '#111827', borderRadius: 10, fontFamily: "'Inter', sans-serif", fontWeight: 600, outline: 'none', width: '100%' }
      : { background: 'rgba(4,13,36,0.80)', border: '1px solid rgba(255,140,66,0.28)', color: '#ffb380', borderRadius: 10, fontFamily: "'Inter', sans-serif", fontWeight: 600, outline: 'none', width: '100%' }
  };

  const leftPromoBg = isLight ? 'rgba(234,88,12,0.015)' : 'rgba(255,140,66,0.04)';
  const borderCol = isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)';

  /* scroll */
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, isChatLoading]);

  /* open chat */
  useEffect(() => {
    if (screen === 'chat' && chatHistory.length === 0 && !isChatLoading)
      fetchNext([]);
  }, [screen]);

  /* loading messages */
  useEffect(() => {
    if (screen !== 'loading') return;
    const msgs = [
      'Reading your chat history carefully...',
      'Analysing core strengths from your words...',
      'Matching interests to realistic professional tracks...',
      'Aligning with global educational boards & streams...',
      'Ensuring career suggestions match your preferences...',
      'Almost ready! Formulating your Career Report...'
    ];
    let i = 0;
    const t = setInterval(() => { i = (i + 1) % msgs.length; setLoadingText(msgs[i]); }, 2500);
    return () => clearInterval(t);
  }, [screen]);

  /* spinner */
  useEffect(() => {
    if (screen !== 'loading') return;
    const emojis = ['🧬', '⚙️', '🔬', '⚖️', '🎨', '💻', '🌱', '🏫', '📊', '🧠'];
    let i = 0;
    const t = setInterval(() => { i = (i + 1) % emojis.length; setSpinnerEmoji(emojis[i]); }, 600);
    return () => clearInterval(t);
  }, [screen]);

  /* ── Handlers ── */
  const handleStartJourney = (e: React.FormEvent) => {
    e.preventDefault();
    if (!favouriteSubject || !easiestSubject || !hardestSubject) {
      setFormError('Please select your Favourite, Easiest, and Hardest subjects.');
      return;
    }
    if (interests.length === 0) {
      setFormError('Please select at least 1 interest (up to 3).');
      return;
    }
    if (interests.includes('Other Area') && !customInterest.trim()) {
      setFormError('Please type your custom interest in the box.');
      return;
    }
    setFormError('');
    setScreen('chat');
    const finalInterests = interests.map(i => i === 'Other Area' ? `Other: ${customInterest.trim()}` : i);
    fetchNext([], finalInterests);
  };

  const toggleInterest = (item: string) => {
    if (interests.includes(item)) {
      setInterests(prev => prev.filter(d => d !== item));
      if (item === 'Other Area') setCustomInterest('');
    } else {
      if (interests.length >= 3) return;
      setInterests(prev => [...prev, item]);
    }
  };

  const fetchNext = async (history: ChatMessage[], dislikeList = interests) => {
    if (history.filter(m => m.role === 'user').length >= 15) {
      triggerAnalysis(history, dislikeList);
      return;
    }
    setIsChatLoading(true);
    setChatError('');
    try {
      const finalInterests = dislikeList.map(i => i === 'Other Area' ? `Other: ${customInterest.trim() || 'General'}` : i);
      const data = await discoverDreamChatReply(
        studentName, studentClass, studentStream,
        { favouriteSubject, easiestSubject, hardestSubject, interests: finalInterests },
        history
      );
      if (!data?.text) throw new Error('Invalid format received.');
      setIsOfflineMode(!!data.isOfflineFallback);
      setChatHistory([...history, { role: 'model', text: data.text }]);
      setSuggestedOptions(data.suggestedOptions || []);
    } catch (err: any) {
      console.error("[DreamDiscovery] fetchNext failed:", err);
      setChatError(err.message || 'Connection to Kalam Spark failed. Please click Retry below.');
    } finally {
      setIsChatLoading(false);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputValue.trim() || isChatLoading) return;
    const msg: ChatMessage = { role: 'user', text: chatInputValue.trim() };
    const next = [...chatHistory, msg];
    setChatHistory(next);
    setChatInputValue('');
    fetchNext(next);
  };

  const pickSuggestion = (opt: string) => {
    if (isChatLoading) return;
    const n = opt.toLowerCase();
    if (n.includes('restart') || n.includes('start over') || n.includes('retake') || n.includes('reset') || n.includes('🔄')) {
      handleReset(); return;
    }
    const msg: ChatMessage = { role: 'user', text: opt };
    const next = [...chatHistory, msg];
    setChatHistory(next);
    fetchNext(next);
  };

  const triggerAnalysis = async (historyToAnalyze?: ChatMessage[], dislikeList = interests) => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setScreen('loading');
    setLoadingError('');
    const finalMessages   = historyToAnalyze || chatHistory;
    const finalInterests  = dislikeList.map(i => i === 'Other Area' ? `Other: ${customInterest.trim() || 'General'}` : i);
    try {
      const data = await discoverDreamAnalyze(
        studentName, studentClass, studentStream,
        { favouriteSubject, easiestSubject, hardestSubject, interests: finalInterests },
        finalMessages
      );
      if (!data?.topFields || !data?.topCareers) throw new Error('Invalid response schema.');
      setIsOfflineMode(!!data.isOfflineFallback);
      setResult(data);
      setScreen('results');
    } catch (err: any) {
      setLoadingError(err.message || 'Failed to analyse. Please check your internet connection.');
    } finally {
      isAnalyzingRef.current = false;
    }
  };

  const handleReset = () => {
    setFavouriteSubject(''); setEasiestSubject(''); setHardestSubject('');
    setLocalSubjects(SUBJECTS);
    setInterests([]); setCustomInterest('');
    setChatHistory([]); setSuggestedOptions([]);
    setChatInputValue(''); setResult(null);
    setCareerPage(1); setIsOfflineMode(false);
    setScreen('welcome');
  };

  /* ─────────────────────────────────────────────
     RENDER — Full-page overlay
  ───────────────────────────────────────────── */
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: theme.textMain,
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Dynamic Cosmic backdrop */}
      <CosmicBG isLight={isLight} />

      {/* ─── WELCOME SCREEN ─── */}
      {screen === 'welcome' && (
        <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
          
          {/* Page title */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: isLight ? 'rgba(234,88,12,0.06)' : 'rgba(255,215,0,0.08)',
              border: `1px solid ${isLight ? 'rgba(234,88,12,0.2)' : 'rgba(255,215,0,0.22)'}`,
              borderRadius: 50, padding: '6px 16px', marginBottom: 16
            }}>
              <Sparkles style={{ width: 14, height: 14, color: theme.orange }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: theme.orange, letterSpacing: '0.1em', textTransform: 'uppercase' }}>AI Career Counsellor</span>
            </div>
            <h1 style={{
              fontFamily: "'Cinzel', Georgia, serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 900,
              color: theme.textBright, margin: '0 0 8px', letterSpacing: '0.04em', lineHeight: 1.2
            }}>
              Discover Your Career Path
            </h1>
            <p style={{ fontSize: 13, color: theme.textMuted, maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
              through interactive conversation with Kalam Spark
            </p>
          </div>

          {/* Main card — split layout */}
          <div style={{ ...theme.glassCard, width: '100%', maxWidth: 1300, display: 'grid', gridTemplateColumns: windowWidth > 768 ? '1fr 1fr' : '1fr', gap: 0, overflow: 'hidden' }}>

            {/* Left promo panel */}
            <div style={{
              padding: '36px 32px', background: leftPromoBg,
              borderRight: `1px solid ${borderCol}`, display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ fontFamily: "'Cinzel', Georgia, serif", fontSize: 20, fontWeight: 700, color: theme.gold, margin: '0 0 10px' }}>
                  through conversation
                </h2>
                <p style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.7, margin: 0 }}>
                  This interactive counselling tool suggests custom career paths based on your subject preferences, interests, and a personalised conversation with our AI counsellor.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { Icon: BrainCircuit, color: theme.gold, title: 'Adaptive Counsellor Chat', desc: 'Interactive follow-up questions adapted to your unique academic profile.' },
                  { Icon: CheckCircle2, color: '#34d399', title: 'Holland RIASEC Mapping', desc: 'High-accuracy profiling matching global curriculum standards and criteria.' },
                  { Icon: GraduationCap, color: '#38bdf8', title: 'Global Path Alignment', desc: 'Standardized exams, college streams, and subject requisites mapped to your goals.' },
                ].map(({ Icon, color, title, desc }) => (
                  <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: isLight ? '#f3f4f6' : 'rgba(4,13,36,0.7)',
                      border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <Icon style={{ width: 16, height: 16, color: isLight ? theme.orange : color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isLight ? '#374151' : '#e2e8f0', marginBottom: 2 }}>{title}</div>
                      <div style={{ fontSize: 10.5, color: theme.textMuted, lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={onSkip}
                style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left', fontFamily: "'Inter', sans-serif" }}
              >
                Skip quiz and enter dream career manually
              </button>
            </div>

            {/* Right form panel */}
            <div style={{ padding: '36px 32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                <User style={{ width: 16, height: 16, color: theme.orange }} />
                <h3 style={{ fontFamily: "'Cinzel', Georgia, serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 13, margin: 0, color: theme.gold }}>Initialize Your Preferences</h3>
              </div>

              <form onSubmit={handleStartJourney} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Subject selects */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <BookOpen style={{ width: 12, height: 12, color: theme.orange }} />
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: theme.orange, textTransform: 'uppercase', letterSpacing: '0.1em' }}>School Subject Preferences</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {([
                      { label: 'Favourite', val: favouriteSubject, set: setFavouriteSubject, isEditing: isEditingFav, setIsEditing: setIsEditingFav, id: 'fav-sub' },
                      { label: 'Easiest',   val: easiestSubject,   set: setEasiestSubject,   isEditing: isEditingEasy, setIsEditing: setIsEditingEasy, id: 'easy-sub' },
                      { label: 'Hardest',   val: hardestSubject,   set: setHardestSubject,   isEditing: isEditingHard, setIsEditing: setIsEditingHard, id: 'hard-sub' },
                    ] as const).map(({ label, val, set, isEditing, setIsEditing, id }) => (
                      <div key={id}>
                        <label htmlFor={id} style={{ display: 'block', fontSize: 9, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</label>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="Type subject..."
                            autoFocus
                            onBlur={(e) => {
                              const typedVal = e.target.value.trim();
                              if (typedVal) {
                                if (!localSubjects.includes(typedVal)) {
                                  setLocalSubjects(prev => {
                                    const list = [...prev];
                                    const otherIdx = list.indexOf('Other');
                                    if (otherIdx !== -1) {
                                      list.splice(otherIdx, 0, typedVal);
                                    } else {
                                      list.push(typedVal);
                                    }
                                    return list;
                                  });
                                }
                                (set as any)(typedVal);
                              } else {
                                (set as any)('');
                              }
                              (setIsEditing as any)(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                            }}
                            style={{ 
                              ...theme.textInput, 
                              padding: '9px 8px', 
                              fontSize: 10.5, 
                              width: '100%', 
                              boxSizing: 'border-box' 
                            }}
                            required
                          />
                        ) : (
                          <select
                            id={id}
                            value={val}
                            onChange={e => {
                              const selectedVal = e.target.value;
                              if (selectedVal === 'Other') {
                                (setIsEditing as any)(true);
                              } else {
                                (set as any)(selectedVal);
                              }
                            }}
                            style={{ ...theme.selectInput, padding: '9px 8px', fontSize: 10.5, appearance: 'auto' }}
                            required
                          >
                            <option value="" style={{ background: isLight ? '#ffffff' : '#070e20', color: isLight ? '#1f2937' : '#ffb380' }}>Select...</option>
                            {localSubjects.map((s, i) => (
                              <option key={i} value={s} style={{ background: isLight ? '#ffffff' : '#070e20', color: isLight ? '#1f2937' : '#ffb380' }}>{s}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interests */}
                <div style={{ borderTop: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.12)'}`, paddingTop: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles style={{ width: 12, height: 12, color: theme.orange }} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: theme.orange, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Top 3 Interests</span>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: theme.textMuted }}>{interests.length} / 3 selected</span>
                  </div>
                  <p style={{ fontSize: 10, color: theme.textMuted, margin: '0 0 12px' }}>Select the areas that excite you most</p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                    {INTERESTS_LIST.map((item, idx) => {
                      const isOn = interests.includes(item);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleInterest(item)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 12px',
                            borderRadius: 10,
                            border: isOn 
                              ? `1px solid ${theme.orange}` 
                              : `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.15)'}`,
                            background: isOn 
                              ? (isLight ? 'rgba(234,88,12,0.08)' : 'rgba(255,140,66,0.18)') 
                              : (isLight ? '#ffffff' : 'rgba(4,13,36,0.55)'),
                            color: isOn 
                              ? (isLight ? '#ea580c' : '#ffffff') 
                              : theme.textMain,
                            fontSize: 10.5, fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif",
                            transition: 'all 0.2s',
                            boxShadow: isOn ? `0 0 10px ${isLight ? 'rgba(234,88,12,0.12)' : 'rgba(255,140,66,0.22)'}` : 'none',
                            textAlign: 'left',
                            minHeight: 40
                          }}
                        >
                          {getInterestIcon(item, isOn, isLight)}
                          <span style={{ lineHeight: 1.3 }}>{item}</span>
                        </button>
                      );
                    })}
                  </div>

                  {interests.includes('Other Area') && (
                    <input
                      type="text"
                      value={customInterest}
                      onChange={e => setCustomInterest(e.target.value)}
                      placeholder="Type your other interest..."
                      style={{ ...theme.selectInput, padding: '9px 14px', fontSize: 11, marginTop: 10 }}
                    />
                  )}
                </div>

                {formError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isLight ? '#fef2f2' : 'rgba(239,68,68,0.08)', border: `1px solid ${isLight ? '#fca5a5' : 'rgba(239,68,68,0.3)'}`, borderRadius: 10, padding: '10px 14px' }}>
                    <AlertTriangle style={{ width: 13, height: 13, color: isLight ? '#991b1b' : '#f87171', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: isLight ? '#991b1b' : '#fca5a5', fontWeight: 600 }}>{formError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  style={{ ...theme.btnPrimary, padding: '13px 0', fontSize: 12, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', borderRadius: 12 }}
                >
                  Start Counselling Conversation
                  <ArrowRight style={{ width: 15, height: 15 }} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── CHAT SCREEN ─── */}
      {screen === 'chat' && (
        <div style={{
          position: 'relative', zIndex: 10,
          height: '100dvh',
          display: 'flex', flexDirection: 'column',
          padding: windowWidth < 680 ? '12px 12px' : '24px 16px',
          gap: windowWidth < 680 ? 12 : 20,
          alignItems: 'center',
          overflow: 'hidden'
        }}>
          
          {/* Header strip */}
          <div style={{
            width: '100%',
            maxWidth: 1300,
            display: 'flex',
            flexDirection: windowWidth < 680 ? 'column' : 'row',
            alignItems: windowWidth < 680 ? 'stretch' : 'center',
            justifyContent: 'space-between',
            ...theme.glassCard,
            padding: windowWidth < 680 ? '14px 16px' : '14px 22px',
            gap: windowWidth < 680 ? 14 : 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: isLight ? '#f3f4f6' : 'rgba(4,13,36,0.80)',
                border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
              }}>🤖</div>
              <div>
                <div style={{ fontFamily: "'Cinzel', Georgia, serif", fontSize: 13, fontWeight: 700, color: theme.textBright }}>Kalam Spark AI Counselor</div>
                {isOfflineMode
                  ? <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />Local Engine (Offline)</div>
                  : <div style={{ fontSize: 10, color: isLight ? '#059669' : '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: isLight ? '#059669' : '#34d399', display: 'inline-block', boxShadow: isLight ? 'none' : '0 0 6px #34d399' }} />Online Career Advisor</div>}
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: windowWidth < 680 ? 'space-between' : 'flex-end',
              gap: 10,
              width: windowWidth < 680 ? '100%' : 'auto'
            }}>
              {/* Progress */}
              <div style={{ textAlign: windowWidth < 680 ? 'left' : 'right' }}>
                <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 700, marginBottom: 4 }}>{Math.min(15, userAnswers)} / 15 answered</div>
                <div style={{ width: windowWidth < 380 ? 80 : 120, height: 4, background: isLight ? '#e5e7eb' : 'rgba(255,140,66,0.12)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.floor((userAnswers / 15) * 100))}%`, height: '100%', background: isLight ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'linear-gradient(135deg, #ff8c42, #ea580c)', borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
              </div>
              {/* Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => triggerAnalysis()}
                  disabled={userAnswers < 3}
                  style={{
                    ...theme.btnPrimary,
                    padding: '8px 12px', fontSize: 10.5,
                    opacity: userAnswers < 3 ? 0.4 : 1,
                    cursor: userAnswers < 3 ? 'not-allowed' : 'pointer'
                  }}
                >🌟 Get Results</button>
                <button
                  onClick={handleReset}
                  style={{ ...theme.btnGhost, padding: '8px 12px', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <RefreshCw style={{ width: 12, height: 12 }} /> Retake
                </button>
              </div>
            </div>
          </div>
          <div style={{
            ...theme.glassCard,
            width: '100%',
            maxWidth: 1300,
            flex: 1,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 200
          }}>
            
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {chatHistory.map((msg, i) => {
                const isKalam = msg.role === 'model';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexDirection: isKalam ? 'row' : 'row-reverse' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10,
                      background: isLight ? '#f3f4f6' : 'rgba(4,13,36,0.80)',
                      border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isKalam ? 17 : 13, flexShrink: 0
                    }}>
                      {isKalam ? '🤖' : '👤'}
                    </div>
                    <div style={{
                      maxWidth: '78%',
                      background: isKalam 
                        ? (isLight ? '#f3f4f6' : 'rgba(3,8,22,0.70)') 
                        : theme.btnPrimary.background,
                      border: isKalam 
                        ? (isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,140,66,0.18)') 
                        : 'none',
                      borderRadius: isKalam ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                      padding: '11px 15px',
                      fontSize: 12,
                      lineHeight: 1.7,
                      color: isKalam ? (isLight ? '#1f2937' : '#e2e8f0') : '#fff',
                      fontWeight: 500,
                      boxShadow: isKalam ? 'none' : (isLight ? 'none' : theme.btnPrimary.boxShadow)
                    }}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {isChatLoading && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: isLight ? '#f3f4f6' : 'rgba(4,13,36,0.80)',
                    border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17
                  }}>🤖</div>
                  <div style={{
                    background: isLight ? '#f3f4f6' : 'rgba(3,8,22,0.70)',
                    border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,140,66,0.18)',
                    borderRadius: '4px 16px 16px 16px', padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <Loader2 style={{ width: 13, height: 13, color: theme.orange, animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 11, color: theme.textMuted, fontStyle: 'italic' }}>Kalam Spark is thinking...</span>
                  </div>
                </div>
              )}

              {chatError && (
                <div style={{ background: isLight ? '#fef2f2' : 'rgba(239,68,68,0.08)', border: `1px solid ${isLight ? '#fca5a5' : 'rgba(239,68,68,0.3)'}`, borderRadius: 12, padding: '12px 16px', maxWidth: 380, alignSelf: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <AlertTriangle style={{ width: 13, height: 13, color: isLight ? '#991b1b' : '#f87171' }} />
                    <span style={{ fontSize: 11, color: isLight ? '#991b1b' : '#fca5a5', fontWeight: 600 }}>{chatError}</span>
                  </div>
                  <button onClick={() => fetchNext(chatHistory)} style={{ background: 'none', border: 'none', color: theme.orange, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Inter', sans-serif" }}>
                    Retry message
                  </button>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input panel */}
            <div style={{
              borderTop: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
              padding: '14px 22px', background: isLight ? '#ffffff' : 'rgba(2,6,18,0.75)',
              display: 'flex', flexDirection: 'column', gap: 12
            }}>
              
              {suggestedOptions.length > 0 && !isChatLoading && (
                <div>
                  <div style={{ fontSize: 8.5, color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Suggested Replies</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {suggestedOptions.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => pickSuggestion(opt)}
                        style={{ ...theme.btnGhost, padding: '7px 14px', fontSize: 10.5 }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={sendMessage} style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  value={chatInputValue}
                  onChange={e => setChatInputValue(e.target.value)}
                  placeholder="Type your reply here..."
                  disabled={isChatLoading}
                  style={{ ...theme.selectInput, flex: 1, padding: '11px 16px', fontSize: 12 }}
                  onFocus={() => {
                    setTimeout(() => {
                      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 300);
                  }}
                />
                <button
                  type="submit"
                  disabled={!chatInputValue.trim() || isChatLoading}
                  style={{
                    ...theme.btnPrimary,
                    width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    opacity: chatInputValue.trim() && !isChatLoading ? 1 : 0.35,
                    cursor: chatInputValue.trim() && !isChatLoading ? 'pointer' : 'not-allowed',
                    boxShadow: isLight ? 'none' : '0 4px 20px rgba(234,88,12,0.35)'
                  }}
                >
                  <Send style={{ width: 15, height: 15 }} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── LOADING SCREEN ─── */}
      {screen === 'loading' && (
        <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ ...theme.glassCard, width: '100%', maxWidth: 460, padding: '48px 36px', textAlign: 'center' }}>
            
            <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 28px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px dashed ${isLight ? 'rgba(234,88,12,0.25)' : 'rgba(255,140,66,0.35)'}`, animation: 'spin 10s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: `2px solid ${isLight ? 'rgba(234,88,12,0.1)' : 'rgba(255,140,66,0.15)'}`, animation: 'ping 2.5s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>{spinnerEmoji}</div>
            </div>

            <h2 style={{ fontFamily: "'Cinzel', Georgia, serif", fontSize: 18, fontWeight: 700, color: theme.textBright, margin: '0 0 10px' }}>
              Kalam Spark Counsellor Engine
            </h2>
            <p style={{ fontSize: 12, color: theme.orange, fontWeight: 600, margin: '0 0 24px', animation: 'pulse 2s ease-in-out infinite' }}>
              {loadingText}
            </p>

            {loadingError ? (
              <div style={{ background: isLight ? '#fef2f2' : 'rgba(239,68,68,0.08)', border: `1px solid ${isLight ? '#fca5a5' : 'rgba(239,68,68,0.3)'}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <AlertTriangle style={{ width: 14, height: 14, color: isLight ? '#991b1b' : '#f87171' }} />
                  <span style={{ fontSize: 12, color: isLight ? '#991b1b' : '#fca5a5', fontWeight: 700 }}>Analysis Failed</span>
                </div>
                <p style={{ fontSize: 11, color: theme.textMuted, margin: '0 0 12px', lineHeight: 1.6 }}>{loadingError}</p>
                <button
                  onClick={() => triggerAnalysis()}
                  style={{ ...theme.btnPrimary, padding: '8px 16px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto' }}
                >
                  <RefreshCw style={{ width: 12, height: 12 }} /> Retry Analysis
                </button>
              </div>
            ) : (
              <div style={{ height: 3, background: isLight ? '#e5e7eb' : 'rgba(255,140,66,0.12)', borderRadius: 4, overflow: 'hidden', maxWidth: 200, margin: '0 auto' }}>
                <div style={{ height: '100%', width: '80%', background: isLight ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'linear-gradient(135deg, #ff8c42, #ea580c)', borderRadius: 4 }} />
              </div>
            )}

            <p style={{ fontSize: 10, color: theme.textMuted, marginTop: 20 }}>
              Mapping your responses against RIASEC Holland parameters...
            </p>
          </div>
        </div>
      )}

      {/* ─── RESULTS SCREEN ─── */}
      {screen === 'results' && result && (
        <div style={{ position: 'relative', zIndex: 10, padding: '28px 16px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>

          {/* Header banner */}
          <div style={{ ...theme.glassCard, width: '100%', maxWidth: 1300, padding: '28px 32px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: isLight ? 'radial-gradient(circle at 70% 120%, rgba(234,88,12,0.02), transparent)' : 'radial-gradient(circle at 70% 120%, rgba(255,215,0,0.05), transparent)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, position: 'relative' }}>
              <div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: isLight ? 'rgba(234,88,12,0.08)' : 'rgba(255,215,0,0.08)',
                  border: `1px solid ${isLight ? 'rgba(234,88,12,0.25)' : 'rgba(255,215,0,0.22)'}`,
                  borderRadius: 50, padding: '4px 12px', marginBottom: 10
                }}>
                  <Sparkles style={{ width: 12, height: 12, color: theme.orange }} />
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: theme.orange, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Interactive Analysis Completed</span>
                </div>
                <h1 style={{ fontFamily: "'Cinzel', Georgia, serif", fontSize: 'clamp(18px, 3vw, 26px)', fontWeight: 900, color: theme.textBright, margin: '0 0 8px' }}>
                  Hey {studentName}! Here is your Career DNA Report 🌟
                </h1>
                {isOfflineMode && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: isLight ? 'rgba(217,119,6,0.08)' : 'rgba(251,191,36,0.08)', border: `1px solid ${isLight ? 'rgba(217,119,6,0.2)' : 'rgba(251,191,36,0.25)'}`, borderRadius: 8, padding: '4px 10px', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: theme.orange, fontWeight: 700 }}>⚠️ Offline Engine Fallback (Local computations active)</span>
                  </div>
                )}
                <p style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.7, margin: 0, maxWidth: 600 }}>
                  We've mapped your inputs to identify fields aligned with your personality and academic preferences. Click <strong style={{ color: theme.orange }}>"Choose Path"</strong> on any suggestion to set it in your profile!
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                <div style={{ ...theme.innerCard, padding: '14px 20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span style={{ fontSize: 10, color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dominant Match</span>
                  <span style={{ background: '#059669', color: '#fff', padding: '4px 14px', borderRadius: 50, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em' }}>
                    {result.topFields[0]?.matchPercent ? `${result.topFields[0].matchPercent}% Match` : '94% Match'}
                  </span>
                </div>
                <button
                  onClick={onSkip}
                  style={{
                    ...theme.btnGhost,
                    padding: '8px 16px',
                    fontSize: 10.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 10,
                    border: `1px solid ${isLight ? '#d1d5db' : 'rgba(255,140,66,0.2)'}`
                  }}
                >
                  <span>✍️</span> Give Manual Career
                </button>
              </div>
            </div>
          </div>

          {/* Body grid */}
          <div style={{ width: '100%', maxWidth: 1300, display: 'grid', gridTemplateColumns: windowWidth > 850 ? '350px 1fr' : '1fr', gap: 20 }}>

            {/* LEFT: Insights */}
            <div style={{ ...theme.glassCard, padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.12)'}`, paddingBottom: 14 }}>
                <span style={{ fontSize: 22 }}>📊</span>
                <h2 style={{ fontFamily: "'Cinzel', Georgia, serif", fontSize: 14, fontWeight: 700, color: theme.textBright, margin: 0 }}>Your Career Insights</h2>
              </div>

              {/* Kalam Spark's message */}
              <div style={{ ...theme.innerCard, padding: '16px', position: 'relative' }}>
                <div style={{ position: 'absolute', right: 10, top: 6, fontSize: 28, color: isLight ? 'rgba(234,88,12,0.06)' : 'rgba(255,215,0,0.08)', userSelect: 'none' }}>"</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Sparkle style={{ width: 11, height: 11, color: theme.orange }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: theme.gold, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Kalam Spark's Counsel</span>
                </div>
                <blockquote style={{ fontSize: 11, color: isLight ? '#374151' : '#cbd5e1', lineHeight: 1.7, margin: 0, fontStyle: 'italic', fontWeight: 500 }}>
                  "{result.personalMessage}"
                </blockquote>
              </div>

              {/* Reality check */}
              {result.realityCheckFlag?.career && result.realityCheckFlag?.issue !== 'N/A' && (
                <div style={{ background: isLight ? '#fef2f2' : 'rgba(239,68,68,0.06)', border: `1px solid ${isLight ? '#fca5a5' : 'rgba(239,68,68,0.25)'}`, borderRadius: 12, padding: '14px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <AlertTriangle style={{ width: 11, height: 11, color: isLight ? '#991b1b' : '#f87171' }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: isLight ? '#991b1b' : '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stream Feasibility Check</span>
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#7f1d1d' : '#fca5a5', margin: '0 0 4px' }}>Barrier for: {result.realityCheckFlag.career}</p>
                  <p style={{ fontSize: 10.5, color: theme.textMuted, margin: '0 0 8px', lineHeight: 1.6 }}>Reason: {result.realityCheckFlag.issue}</p>
                  <p style={{
                    fontSize: 10.5, color: isLight ? '#1f2937' : '#e2e8f0',
                    background: isLight ? '#ffffff' : 'rgba(4,13,36,0.7)',
                    border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
                    borderRadius: 8, padding: '8px 12px', lineHeight: 1.6, margin: 0
                  }}>
                    💡 {result.realityCheckFlag.suggestion}
                  </p>
                </div>
              )}

              {/* Holland code */}
              {result.hollandCode && result.riasecVector && (
                <div style={{ ...theme.innerCard, padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <BrainCircuit style={{ width: 11, height: 11, color: theme.orange }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: theme.gold, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Holland Code (RIASEC)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600 }}>Dominant Profile:</span>
                    <span style={{
                      background: isLight ? '#ffffff' : 'rgba(255,215,0,0.1)',
                      border: `1px solid ${isLight ? '#d1d5db' : 'rgba(255,215,0,0.25)'}`,
                      color: theme.gold, padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800, letterSpacing: '0.2em', fontFamily: 'monospace'
                    }}>
                      {result.hollandCode}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { key: 'R', label: 'Realistic', color: '#f87171' },
                      { key: 'I', label: 'Investigative', color: '#38bdf8' },
                      { key: 'A', label: 'Artistic', color: '#c084fc' },
                      { key: 'S', label: 'Social', color: '#34d399' },
                      { key: 'E', label: 'Enterprising', color: '#fbbf24' },
                      { key: 'C', label: 'Conventional', color: '#f472b6' },
                    ].map(({ key, label, color }) => {
                      const val = (result.riasecVector as any)[key] || 0;
                      const pct = Math.min(100, Math.floor((val / 15) * 100));
                      return (
                        <div key={key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: theme.textMuted, marginBottom: 3 }}>
                            <span>{label} ({key})</span>
                            <span>{val} pts</span>
                          </div>
                          <div style={{ height: 4, background: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 1s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strengths */}
              <div>
                <h3 style={{ fontSize: 9, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px', fontFamily: 'monospace' }}>Strengths Seen</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.strengthsSeen.map((s: string, i: number) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: isLight ? '#ffffff' : 'rgba(4,13,36,0.60)',
                      border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
                      borderRadius: 8, padding: '8px 12px'
                    }}>
                      <CheckCircle2 style={{ width: 13, height: 13, color: '#34d399', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: isLight ? '#374151' : '#cbd5e1', fontWeight: 600 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div style={{ borderTop: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`, paddingTop: 16 }}>
                <h3 style={{ fontSize: 9, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 10px', fontFamily: 'monospace' }}>Skills to Build</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {result.skillsToBuild.map((sk: string, i: number) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: isLight ? '#4b5563' : '#94a3b8', fontWeight: 500, lineHeight: 1.6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: theme.orange, marginTop: 6, flexShrink: 0 }} />
                      {sk}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* RIGHT: Fields + Careers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Top 3 Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                {result.topFields.slice(0, 3).map((f: any, i: number) => {
                  const isPrimary = i === 0;
                  return (
                    <div key={i} style={{
                      background: isPrimary 
                        ? (isLight ? '#f0fdf4' : 'rgba(4,13,36,0.85)') 
                        : (isLight ? '#ffffff' : 'rgba(4,13,36,0.65)'),
                      border: isPrimary 
                        ? (isLight ? '1px solid #a7f3d0' : '1px solid rgba(99,102,241,0.4)') 
                        : `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
                      borderRadius: 16,
                      padding: '18px',
                      boxShadow: isPrimary ? (isLight ? '0 4px 12px rgba(16,185,129,0.05)' : '0 0 20px rgba(99,102,241,0.15)') : 'none',
                      backdropFilter: 'blur(16px)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 26 }}>{f.emoji}</span>
                        <span style={{
                          fontSize: 8, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 50,
                          background: isPrimary ? (isLight ? '#d1fae5' : 'rgba(99,102,241,0.2)') : (isLight ? '#f3f4f6' : 'rgba(255,255,255,0.05)'),
                          border: isPrimary ? (isLight ? '1px solid #a7f3d0' : '1px solid rgba(99,102,241,0.4)') : `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
                          color: isPrimary ? (isLight ? '#065f46' : '#a5b4fc') : theme.textMuted, letterSpacing: '0.1em'
                        }}>
                          {i === 0 ? 'Primary' : i === 1 ? 'Secondary' : 'Tertiary'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: theme.textBright, marginBottom: 4, lineHeight: 1.3 }}>{f.field}</div>
                      <div style={{ fontSize: 10.5, color: theme.textMuted, lineHeight: 1.6, marginBottom: 14 }}>{f.oneLiner}</div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: theme.textMuted, marginBottom: 4, fontFamily: 'monospace' }}>
                          <span>Match Probability</span><span>{f.matchPercent}%</span>
                        </div>
                        <div style={{ height: 5, background: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${f.matchPercent}%`, background: isPrimary ? '#34d399' : theme.orange, borderRadius: 4 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Career cards header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.12)'}`, paddingBottom: 10 }}>
                <GraduationCap style={{ width: 14, height: 14, color: theme.textMuted }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recommended Career Paths</span>
              </div>

              {/* Career grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                {result.topCareers.slice((careerPage - 1) * 12, careerPage * 12).map((c: any, idx: number) => {
                  const accentColor = c.rank <= 2 ? '#34d399' : c.rank <= 4 ? theme.orange : (isLight ? '#cbd5e1' : 'rgba(255,140,66,0.4)');
                  return (
                    <div key={idx} style={{
                      background: isLight ? '#ffffff' : 'rgba(4,13,36,0.72)',
                      border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
                      borderTop: `3px solid ${accentColor}`,
                      borderRadius: 14,
                      padding: '16px',
                      backdropFilter: 'blur(16px)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.25s',
                      boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.03)' : 'none'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 24 }}>{c.emoji}</span>
                          <span style={{
                            fontSize: 8, fontWeight: 700, color: theme.textMuted,
                            background: isLight ? '#f3f4f6' : 'rgba(3,8,22,0.80)',
                            border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
                            padding: '2px 7px', borderRadius: 50, fontFamily: 'monospace'
                          }}>
                            #{c.rank}
                          </span>
                        </div>
                        <h4 style={{ fontSize: 12.5, fontWeight: 800, color: theme.textBright, margin: '0 0 3px', lineHeight: 1.3 }}>{c.title}</h4>
                        <span style={{ fontSize: 9, color: theme.orange, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>{c.field}</span>
                        <p style={{
                          fontSize: 10.5, color: theme.textMuted, lineHeight: 1.6, margin: 0, fontStyle: 'italic',
                          borderLeft: `2px solid ${isLight ? '#ea580c' : 'rgba(255,140,66,0.22)'}`, paddingLeft: 8
                        }}>
                          "{c.whyItFits}"
                        </p>
                      </div>

                      <div style={{ borderTop: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.12)'}`, marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <BookOpen style={{ width: 11, height: 11, color: theme.orange, flexShrink: 0 }} />
                          <span style={{ fontSize: 9.5, color: theme.textMuted, fontWeight: 600 }}>Exam: <strong style={{ color: isLight ? '#111827' : '#e2e8f0' }}>{c.entranceExam}</strong></span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {c.requiredSubjects.map((sub: string, si: number) => (
                            <span key={si} style={{
                              fontSize: 8.5, fontWeight: 700, color: theme.textMuted,
                              background: isLight ? '#f3f4f6' : 'rgba(4,13,36,0.80)',
                              border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.22)'}`,
                              padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace'
                            }}>{sub}</span>
                          ))}
                        </div>
                        <button
                          onClick={() => onComplete(c.title, c.requiredSubjects)}
                          style={{ ...theme.btnPrimary, padding: '9px', fontSize: 10.5, letterSpacing: '0.05em', width: '100%', borderRadius: 10 }}
                        >
                          Choose Path
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {(() => {
                const pageSize = 12;
                const totalPages = Math.ceil(result.topCareers.length / pageSize);
                const showStart = result.topCareers.length === 0 ? 0 : ((careerPage - 1) * pageSize) + 1;
                const showEnd = Math.min(result.topCareers.length, careerPage * pageSize);
                return (
                  <div style={{ borderTop: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,140,66,0.12)'}`, paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: theme.textMuted, fontWeight: 700, fontFamily: 'monospace' }}>
                      Page {careerPage} of {totalPages} · Showing {showStart}–{showEnd} of {result.topCareers.length}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {careerPage > 1 && (
                        <button onClick={() => setCareerPage(prev => Math.max(1, prev - 1))} style={{ ...theme.btnGhost, padding: '7px 14px', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ChevronLeft style={{ width: 13, height: 13, color: theme.orange }} /> Back
                        </button>
                      )}
                      {careerPage < totalPages && (
                        <button onClick={() => setCareerPage(prev => Math.min(totalPages, prev + 1))} style={{ ...theme.btnPrimary, padding: '7px 14px', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                          Next <ChevronRight style={{ width: 13, height: 13 }} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Footer */}
          <div style={{ ...theme.glassCard, width: '100%', maxWidth: 1300, padding: '18px 28px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: isLight ? '#4b5563' : '#94a3b8', fontWeight: 600 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: isLight ? 'none' : '0 0 8px #34d399', animation: 'pulse 2s infinite' }} />
              Career evaluation complete. Select a path above or retake the quiz.
            </div>
            <button
              onClick={handleReset}
              style={{ ...theme.btnGhost, padding: '10px 20px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <RefreshCw style={{ width: 13, height: 13 }} /> Retake Quiz
            </button>
          </div>
        </div>
      )}

      {/* Global animation keyframes */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ping { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.15); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        @keyframes starTwinkle { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.75; } }
      `}</style>
    </div>
  );
}
