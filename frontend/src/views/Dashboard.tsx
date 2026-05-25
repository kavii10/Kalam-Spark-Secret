import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Flame, Target, RefreshCw, BookOpen, ArrowRight,
  Quote, Bot, TrendingUp, Star, Crown, Trophy,
  BarChart2, CheckSquare, Brain, Clock, Layers, Award,
  ThumbsUp, AlertCircle, Sparkles, CheckCircle2, ChevronRight
} from 'lucide-react';
import { UserProfile, Reward } from '../types';

import { getMotivationalQuote } from '../services/geminiService';
import { dbService } from '../services/dbService';
import { taskRevisionService } from '../services/taskRevisionService';
import { flashcardService } from '../services/flashcardService';
import { t, getCurrentLang } from '../i18n';

const FALLBACK_QUOTES = [
  "The expert in anything was once a beginner. Start today.",
  "Success is the sum of small efforts, repeated day in and day out.",
  "Your limitation—it's only your imagination.",
  "Dream big, start small, act now.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "Don't watch the clock; do what it does. Keep going.",
  "Every champion was once a contender that refused to give up.",
];

const REWARD_ICONS: Record<Reward['type'], string> = {
  stage_complete: '🗺️', daily_tasks_complete: '✅',
  perfect_quiz: '🎯', streak_milestone: '🔥',
  first_roadmap: '🚀', custom: '⭐',
};

export default function Dashboard({ user }: { user: UserProfile }) {
  const lang = getCurrentLang();
  const [activeTab, setActiveTab] = useState<'goals' | 'analytics'>('goals');
  const [quote, setQuote] = useState("");
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  
  // Analytics States
  const [taskStats, setTaskStats] = useState({
    total: 0,
    completed: 0,
    theory: { total: 0, completed: 0 },
    handsOn: { total: 0, completed: 0 },
    review: { total: 0, completed: 0 },
    currentAffairs: { total: 0, completed: 0 }
  });
  const [revisionStats, setRevisionStats] = useState({
    total: 0,
    reviewed: 0,
    avgScore: 0,
    dueCount: 0
  });
  const [flashcardCount, setFlashcardCount] = useState(0);

  const getRandomQuote = () => FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
  const isLight = user.settings?.theme === 'light';

  const loadData = async () => {
    setLoading(true);
    try {
      const [quoteResult, rm, completed, tasksList, revisionsList, dueRevisions, dueCards] = await Promise.allSettled([
        getMotivationalQuote(user.dream),
        dbService.getRoadmap(user.id),
        dbService.getCompletedStages(user.id),
        dbService.getTasks(user.id),
        taskRevisionService.getAllRevisions(user.id),
        taskRevisionService.getDueTasks(user.id),
        flashcardService.getDueCards(user.id)
      ]);

      setQuote(quoteResult.status === 'fulfilled' && quoteResult.value ? quoteResult.value : getRandomQuote());

      if (rm.status === 'fulfilled' && rm.value) {
        const completedList = completed.status === 'fulfilled' ? completed.value : [];
        const stages = rm.value.stages || [];
        setProgress(stages.length > 0 ? Math.round((completedList.length / stages.length) * 100) : 0);
      }

      // Calculate task counts by type
      if (tasksList.status === 'fulfilled' && Array.isArray(tasksList.value)) {
        const list = tasksList.value;
        const stats = {
          total: list.length,
          completed: list.filter(t => t.completed).length,
          theory: { total: 0, completed: 0 },
          handsOn: { total: 0, completed: 0 },
          review: { total: 0, completed: 0 },
          currentAffairs: { total: 0, completed: 0 }
        };
        list.forEach(t => {
          const type = t.type || 'theory';
          if (type === 'theory') {
            stats.theory.total++;
            if (t.completed) stats.theory.completed++;
          } else if (type === 'hands-on') {
            stats.handsOn.total++;
            if (t.completed) stats.handsOn.completed++;
          } else if (type === 'review') {
            stats.review.total++;
            if (t.completed) stats.review.completed++;
          } else if (type === 'current-affairs') {
            stats.currentAffairs.total++;
            if (t.completed) stats.currentAffairs.completed++;
          }
        });
        setTaskStats(stats);
      }

      // Calculate revision counts
      if (revisionsList.status === 'fulfilled' && Array.isArray(revisionsList.value)) {
        const revs = revisionsList.value;
        const reviewedCount = revs.filter(r => r.totalReviews > 0);
        const avgScore = reviewedCount.length > 0 ? Math.round(reviewedCount.reduce((s, r) => s + (r.lastQuizScore || 0), 0) / reviewedCount.length) : 0;
        
        const dueCount = dueRevisions.status === 'fulfilled' && Array.isArray(dueRevisions.value) 
          ? dueRevisions.value.length 
          : 0;

        setRevisionStats({
          total: revs.length,
          reviewed: reviewedCount.length,
          avgScore,
          dueCount
        });
      }

      if (dueCards.status === 'fulfilled' && Array.isArray(dueCards.value)) {
        setFlashcardCount(dueCards.value.length);
      }
    } catch (e) {
      console.warn('[Dashboard] Stats fetch error:', e);
      setQuote(getRandomQuote());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user.dream]);

  const level = Math.floor((user.xp || 0) / 1000) + 1;
  const xpInLevel = (user.xp || 0) % 1000;
  const xpNeededForNext = 1000 - xpInLevel;
  const tasksNeededForNext = Math.ceil(xpNeededForNext / 25);
  const rewards: Reward[] = user.rewards || [];

  // Generate streak calendar mock values based on current streak
  const getStreakCalendar = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayIndex = (new Date().getDay() + 6) % 7; // Mon is 0, Sun is 6
    const streak = user.streak || 0;
    
    return days.map((day, idx) => {
      // If today is index, highlight. If index <= todayIndex and within streak length, it's active.
      const isActive = idx <= todayIndex && (todayIndex - idx) < streak;
      const isToday = idx === todayIndex;
      return { day, isActive, isToday };
    });
  };

  const StatCard = ({
    label, value, sub, icon: Icon, iconColor, barPercent, barClass, accent,
  }: {
    label: string; value: string | number; sub?: string; icon: any;
    iconColor: string; barPercent?: number; barClass?: string; accent?: string;
  }) => (
    <div
      className="glass-card glass-inner-shadow p-5 flex flex-col gap-3 relative overflow-hidden"
      style={accent ? { borderColor: accent, boxShadow: `0 0 20px ${accent}22` } : {}}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gold-400/60 uppercase tracking-wider">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <Icon size={15} className={iconColor} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gold-100">{value}</p>
      {sub && <p className="text-[11px] text-gold-500/40">{sub}</p>}
      {barPercent !== undefined && (
        <div className="progress-track h-1.5 mt-1">
          <div className={`h-full ${barClass}`} style={{ width: `${barPercent}%` }} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 fade-up">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-gold-400/50 text-sm mb-1 font-medium">{t('dash_welcome_back', lang)}</p>
          <h1 className="heading-gold font-cinzel text-4xl font-bold tracking-tight flex items-center gap-3">
            <span>{user.name || 'Explorer'}</span>
            <div className="relative w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-xl overflow-hidden shadow-lg"
              style={{ background: 'linear-gradient(135deg, rgba(255,140,66,0.15), rgba(234,88,12,0.3))', border: '1px solid rgba(255,140,66,0.4)', boxShadow: '0 0 15px rgba(255,140,66,0.2)' }}>
              <Crown size={22} className="text-gold-300 relative z-10 animate-pulse" strokeWidth={2.5} />
            </div>
          </h1>
          <p className="text-gold-300/50 text-sm mt-2">
            {t('dash_working_towards', lang)}{' '}
            <span className="text-purple-400 font-semibold">{user.dream || 'your dream'}</span>
          </p>
        </div>
        <button onClick={loadData} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-xs font-medium">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {t('dash_refresh', lang)}
        </button>
      </div>

      {/* Tab Switcher */}
      <div className={`flex border-b pb-px ${isLight ? 'border-orange-200' : 'border-gold-500/20'}`}>
        <button 
          onClick={() => setActiveTab('goals')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-cinzel font-bold text-sm transition-all ${
            activeTab === 'goals' 
              ? 'border-orange-500 text-orange-500' 
              : isLight ? 'border-transparent text-zinc-500 hover:text-zinc-800' : 'border-transparent text-gold-400/50 hover:text-gold-300'
          }`}
        >
          <Target size={15} /> My Goals
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-cinzel font-bold text-sm transition-all ${
            activeTab === 'analytics' 
              ? 'border-orange-500 text-orange-500' 
              : isLight ? 'border-transparent text-zinc-500 hover:text-zinc-800' : 'border-transparent text-gold-400/50 hover:text-gold-300'
          }`}
        >
          <BarChart2 size={15} /> Progress Analytics
        </button>
      </div>

      {activeTab === 'goals' ? (
        <>
          {/* Stats & Rewards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 stagger">
            <StatCard label={t('dash_level', lang)} value={level} sub={`${xpInLevel.toLocaleString()} / 1,000 XP`} icon={Star} iconColor="text-gold-400" barPercent={xpInLevel / 10} barClass="progress-bar-gold" accent="rgba(211,156,59,0.4)" />
            <StatCard label={t('dash_streak', lang)} value={user.streak || 0} sub={t('days', lang)} icon={Flame} iconColor="text-orange-400" accent="rgba(249,115,22,0.35)" />
            <StatCard label={t('dash_stage', lang)} value={user.currentStageIndex + 1} sub={`${t('of', lang)} roadmap`} icon={TrendingUp} iconColor="text-emerald-400" accent="rgba(34,197,94,0.3)" />
            <StatCard label={t('dash_progress', lang)} value={`${progress}%`} icon={Target} iconColor="text-purple-400" barPercent={progress} barClass="progress-bar-purple" accent="rgba(124,58,237,0.35)" />

            {/* Rewards Badge Card */}
            <div
              className="glass-card glass-inner-shadow p-5 flex flex-col gap-2 col-span-2 lg:col-span-1 relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-all"
              style={{ borderColor: 'rgba(255,215,0,0.35)', boxShadow: '0 0 20px rgba(255,215,0,0.08)' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gold-400/60 uppercase tracking-wider">{t('dash_rewards', lang)}</p>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.25)" }}>
                  <Trophy size={15} className="text-yellow-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gold-100">{rewards.length}</p>
              {rewards.length === 0 ? (
                <p className="text-[10px] text-gold-500/30 leading-tight">Complete tasks & stages to earn badges</p>
              ) : (
                <div className="flex gap-1 flex-wrap mt-1">
                  {rewards.slice(0, 5).map(r => (
                    <span key={r.id} className="text-base animate-[bounce_1s_infinite]" title={r.title}>{REWARD_ICONS[r.type] || '⭐'}</span>
                  ))}
                  {rewards.length > 5 && <span className="text-[10px] text-gold-400/50 font-bold ml-1">+{rewards.length - 5}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Motivation Quote */}
          <div className="glass-card glass-inner-shadow p-8 relative overflow-hidden" style={{ borderColor: "rgba(211,156,59,0.20)" }}>
            <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/6 blur-[90px] rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 mb-5">
              <Quote size={15} className="text-gold-400" />
              <span className="text-xs text-gold-400/70 font-semibold uppercase tracking-widest">{t('dash_daily_inspiration', lang)}</span>
            </div>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-5 bg-white/5 rounded-lg w-full" />
                <div className="h-5 bg-white/5 rounded-lg w-3/4" />
              </div>
            ) : (
              <p className="text-xl lg:text-2xl font-medium text-gold-100/90 leading-relaxed italic relative z-10 font-cinzel">
                "{quote}"
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link to="/planner" className="btn-primary py-4 flex items-center justify-center gap-2 text-sm font-bold shadow-[0_4px_15px_rgba(234,88,12,0.2)]">
              {t('dash_todays_tasks', lang)} <ArrowRight size={15} />
            </Link>
            <Link to="/resources" className="btn-secondary py-4 flex items-center justify-center gap-2 text-sm font-semibold hover:border-purple-400/40">
              <BookOpen size={14} className="text-purple-400" /> {t('dash_study_center', lang)}
            </Link>
            <Link to="/mentor" className="btn-secondary py-4 flex items-center justify-center gap-2 text-sm font-semibold hover:border-orange-400/40">
              <Bot size={14} className="text-orange-400" /> {t('dash_ask_mentor', lang)}
            </Link>
          </div>

          {/* Roadmap Summary */}
          <div className="glass-card p-6" style={{ borderColor: "rgba(124,58,237,0.25)" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gold-200">{t('dash_roadmap_progress', lang)}</p>
              <Link to="/roadmap" className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-semibold flex items-center">{t('dash_view_plan', lang)} <ChevronRight size={12} /></Link>
            </div>
            <div className="progress-track h-2.5 mb-3">
              <div className="progress-bar-purple h-full" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gold-500/40">{progress}% {t('complete', lang)} — Stage {user.currentStageIndex + 1} {t('of', lang)} your journey</p>
          </div>
        </>
      ) : (
        // ── PROGRESS ANALYTICS VIEW ──
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
          
          {/* Column 1: Gamified XP Wheel & Level info */}
          <div className="glass-card p-6 flex flex-col items-center text-center justify-between h-fit" style={{ borderColor: 'rgba(211,156,59,0.22)' }}>
            <div className="w-full flex items-center gap-2 mb-6 border-b border-white/5 pb-3">
              <Sparkles size={16} className="text-gold-400" />
              <h3 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-zinc-800' : 'text-gold-100'}`}>Level Progress</h3>
            </div>

            {/* Circular XP Progress Wheel */}
            <div className="relative w-40 h-40 flex items-center justify-center mb-6">
              {/* Outer SVG ring */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  className={isLight ? "stroke-zinc-200" : "stroke-white/5"}
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  className="stroke-orange-500"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={440}
                  strokeDashoffset={440 - (440 * (xpInLevel / 1000))}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-gold-400/60">Level</span>
                <span className="text-5xl font-black heading-gold font-cinzel leading-none">{level}</span>
                <span className={`text-[11px] font-medium mt-1.5 ${isLight ? 'text-zinc-600' : 'text-gold-200/50'}`}>{xpInLevel}/1000 XP</span>
              </div>
            </div>

            <div className={`w-full p-4 rounded-xl text-xs space-y-2 text-left leading-relaxed ${isLight ? 'bg-orange-50 border border-orange-100' : 'bg-white/5 border border-gold-500/10'}`}>
              <p className={isLight ? 'text-orange-950/80' : 'text-gold-200/70'}><span className="font-bold text-orange-400">🔥 Level Milestone:</span> You are <span className="font-bold">{xpNeededForNext} XP</span> away from Level {level + 1}.</p>
              <p className={isLight ? 'text-orange-900/60' : 'text-gold-500/40'}><span className="font-bold">🎯 Tip:</span> Complete approximately <span className={isLight ? 'text-orange-600 font-bold' : 'text-orange-400 font-bold'}>{tasksNeededForNext} tasks</span> (+25 XP each) to level up your expertise!</p>
            </div>
          </div>

          {/* Column 2: Productivity & Task Variety Charts */}
          <div className="glass-card p-6 md:col-span-2 space-y-6" style={{ borderColor: 'rgba(124,58,237,0.22)' }}>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare size={16} className="text-purple-400" />
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-zinc-800' : 'text-gold-100'}`}>Task Variety & Efficiency</h3>
              </div>
              {taskStats.total > 0 && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isLight ? 'bg-purple-50 text-purple-600' : 'bg-purple-500/10 text-purple-300'}`}>
                  {Math.round((taskStats.completed / taskStats.total) * 100)}% Completed Today
                </span>
              )}
            </div>

            {taskStats.total === 0 ? (
              <div className="py-14 text-center rounded-xl border border-dashed border-white/10 flex flex-col items-center gap-2">
                <CheckCircle2 size={32} className="text-gold-500/30" />
                <p className="text-xs text-gold-500/50">No tasks generated today</p>
                <Link to="/planner" className="btn-primary py-2 px-5 text-xs font-bold mt-2">Go to Task Planner</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Circular Efficiency Indicator */}
                <div className="flex flex-col items-center justify-center p-4 border border-white/5 rounded-2xl bg-black/10">
                  <div className="text-4xl font-extrabold text-emerald-400 font-cinzel">{taskStats.completed} <span className="text-lg text-gold-400/50">/ {taskStats.total}</span></div>
                  <p className={`text-[10px] uppercase font-bold tracking-wider mt-2 ${isLight ? 'text-zinc-500' : 'text-gold-500/50'}`}>Tasks Complete</p>
                  
                  {/* Small progress meter */}
                  <div className="w-full progress-track h-2 mt-4">
                    <div className="progress-bar-gold h-full" style={{ width: `${(taskStats.completed / taskStats.total) * 100}%` }} />
                  </div>
                  <p className={`text-[10px] mt-2 italic text-center ${isLight ? 'text-zinc-400' : 'text-gold-500/30'}`}>Archive completed tasks at midnight to generate new ones.</p>
                </div>

                {/* Task Categories Progress */}
                <div className="space-y-3.5">
                  {[
                    { label: 'Theory Learning', key: 'theory', color: '#60a5fa', stats: taskStats.theory },
                    { label: 'Hands-on Practice', key: 'hands-on', color: '#fb923c', stats: taskStats.handsOn },
                    { label: 'Milestone Review', key: 'review', color: '#4ade80', stats: taskStats.review },
                    { label: 'Current Affairs', key: 'current-affairs', color: '#f87171', stats: taskStats.currentAffairs },
                  ].map(cat => {
                    const pct = cat.stats.total > 0 ? Math.round((cat.stats.completed / cat.stats.total) * 100) : 0;
                    return (
                      <div key={cat.key}>
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <span style={{ color: cat.color }} className="font-semibold">{cat.label}</span>
                          <span className={isLight ? 'text-zinc-700' : 'text-gold-200'}>{cat.stats.completed} / {cat.stats.total}</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
                          <div className="h-full rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Column 3: Streak Habit Builder */}
          <div className="glass-card p-6 md:col-span-3 space-y-6" style={{ borderColor: 'rgba(255,140,66,0.22)' }}>
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Flame size={16} className="text-orange-400" />
              <h3 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-zinc-800' : 'text-gold-100'}`}>Study Habit Calendar</h3>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <p className={`text-3xl font-black ${isLight ? 'text-orange-600' : 'text-orange-400'} font-cinzel`}>{user.streak || 0} Day Streak</p>
                <p className={`text-xs mt-1 max-w-sm leading-relaxed ${isLight ? 'text-zinc-500' : 'text-gold-500/50'}`}>
                  Streak tracks the consecutive days you logged XP in Kalam Spark. Keep completing daily planner tasks to protect your streak milestones!
                </p>
              </div>

              {/* 7 Day calendar nodes */}
              <div className="flex gap-2 sm:gap-3 flex-wrap">
                {getStreakCalendar().map((day, idx) => (
                  <div 
                    key={idx} 
                    className={`w-11 h-14 rounded-xl flex flex-col items-center justify-center border transition-all duration-300 ${
                      day.isActive 
                        ? 'bg-orange-500/10 border-orange-500/60 shadow-[0_0_10px_rgba(249,115,22,0.15)]' 
                        : day.isToday 
                          ? isLight ? 'bg-zinc-200 border-zinc-400' : 'bg-white/10 border-white/30'
                          : isLight ? 'bg-zinc-100 border-zinc-200 opacity-60' : 'bg-black/30 border-white/5 opacity-40'
                    }`}
                  >
                    <span className={`text-[9px] uppercase tracking-wider font-semibold ${day.isActive ? 'text-orange-400' : isLight ? 'text-zinc-500' : 'text-gold-500/50'}`}>
                      {day.day}
                    </span>
                    <div className="mt-1">
                      {day.isActive ? (
                        <Flame size={16} className="text-orange-500 fill-orange-500 animate-pulse" />
                      ) : (
                        <div className={`w-1.5 h-1.5 rounded-full ${day.isToday ? 'bg-gold-500' : isLight ? 'bg-zinc-400' : 'bg-white/20'}`} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 4: Spaced Repetition (FSRS / Ebisu) Cognitive Mastery */}
          <div className="glass-card p-6 md:col-span-3 space-y-6" style={{ borderColor: 'rgba(34,197,94,0.22)' }}>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-emerald-400" />
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-zinc-800' : 'text-gold-100'}`}>Cognitive Memory Vault</h3>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-300'}`}>
                FSRS & Ebisu Algorithms
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Vault Size", val: revisionStats.total, sub: "Flashcards created", icon: <Layers size={15} className="text-blue-400" /> },
                { label: "Due for Review", val: revisionStats.dueCount, sub: "Cards due now", icon: <Clock size={15} className="text-red-400" /> },
                { label: "Memory Recall", val: `${revisionStats.avgScore}%`, sub: "Avg Quiz Score", icon: <ThumbsUp size={15} className="text-emerald-400" /> },
                { label: "Reviewed Items", val: revisionStats.reviewed, sub: "Active revision cycles", icon: <Award size={15} className="text-purple-400" /> }
              ].map((metric, i) => (
                <div key={i} className={`p-4 rounded-xl border ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-white/5 border-white/5'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-zinc-500' : 'text-gold-500/50'}`}>{metric.label}</span>
                    {metric.icon}
                  </div>
                  <p className="text-2xl font-bold text-gold-100 font-cinzel">{metric.val}</p>
                  <p className={`text-[10px] mt-0.5 ${isLight ? 'text-zinc-400' : 'text-gold-500/30'}`}>{metric.sub}</p>
                </div>
              ))}
            </div>

            <div className={`p-4 rounded-xl text-xs flex items-start gap-2.5 ${isLight ? 'bg-emerald-50 text-emerald-950/80 border border-emerald-100' : 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-200/80'}`}>
              <AlertCircle size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Automatic Spaced Repetition Active</p>
                <p className="mt-0.5 leading-relaxed">
                  Your completed planner tasks are automatically imported into the Revision Engine. Over time, the Ebisu model tracks your cognitive decay curves and schedules optimal micro-quizzes to ensure maximum information retention.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
