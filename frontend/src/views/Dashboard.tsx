import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Flame, Target, RefreshCw, BookOpen, ArrowRight,
  Quote, Bot, TrendingUp, Star, Crown, Trophy
} from 'lucide-react';
import { UserProfile, Reward } from '../types';

import { getMotivationalQuote } from '../services/geminiService';
import { dbService } from '../services/dbService';
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
  const [quote, setQuote] = useState("");
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  const getRandomQuote = () => FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];

  const loadData = async () => {
    setLoading(true);
    try {
      const [quoteResult, rm, completed] = await Promise.allSettled([
        getMotivationalQuote(user.dream),
        dbService.getRoadmap(user.id),
        dbService.getCompletedStages(user.id)
      ]);
      setQuote(quoteResult.status === 'fulfilled' && quoteResult.value ? quoteResult.value : getRandomQuote());
      if (rm.status === 'fulfilled' && rm.value) {
        const completedList = completed.status === 'fulfilled' ? completed.value : [];
        const stages = rm.value.stages || [];
        setProgress(stages.length > 0 ? Math.round((completedList.length / stages.length) * 100) : 0);
      }
    } catch {
      setQuote(getRandomQuote());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user.dream]);

  const level = Math.floor((user.xp || 0) / 1000) + 1;
  const xpInLevel = (user.xp || 0) % 1000;
  const rewards: Reward[] = user.rewards || [];

  // ── Stat Card component ──────────────────────────────────────────────────────
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
        <div className="progress-track h-1.5">
          <div className={`h-full ${barClass}`} style={{ width: `${barPercent}%` }} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-7 fade-up">
      {/* Welcome */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-gold-400/50 text-sm mb-1 font-medium">{t('dash_welcome_back', lang)}</p>
          <h1 className="heading-gold font-cinzel text-4xl font-bold tracking-tight flex items-center gap-3">
            <span>{user.name || 'Explorer'}</span>
            <div className="relative w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition-transform"
              style={{ background: 'linear-gradient(135deg, rgba(255,140,66,0.15), rgba(234,88,12,0.3))', border: '1px solid rgba(255,140,66,0.4)', boxShadow: '0 0 15px rgba(255,140,66,0.2)' }}>
              <Crown size={22} className="text-gold-300 relative z-10" style={{ filter: 'drop-shadow(0 0 8px rgba(255,140,66,0.8))' }} strokeWidth={2.5} />
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

      {/* ── ROW 1: Stats + Rewards side by side ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 stagger">
        {/* Level */}
        <StatCard label={t('dash_level', lang)} value={level} sub={`${xpInLevel.toLocaleString()} / 1,000 XP`} icon={Star} iconColor="text-gold-400" barPercent={xpInLevel / 10} barClass="progress-bar-gold" accent="rgba(211,156,59,0.4)" />
        {/* Streak */}
        <StatCard label={t('dash_streak', lang)} value={user.streak || 0} sub={t('days', lang)} icon={Flame} iconColor="text-orange-400" accent="rgba(249,115,22,0.35)" />
        {/* Stage */}
        <StatCard label={t('dash_stage', lang)} value={user.currentStageIndex + 1} sub={`${t('of', lang)} roadmap`} icon={TrendingUp} iconColor="text-emerald-400" accent="rgba(34,197,94,0.3)" />
        {/* Progress */}
        <StatCard label={t('dash_progress', lang)} value={`${progress}%`} icon={Target} iconColor="text-purple-400" barPercent={progress} barClass="progress-bar-purple" accent="rgba(124,58,237,0.35)" />

        {/* ── REWARDS STAT CARD (5th in row) ─────────────────────────────────── */}
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
                <span key={r.id} className="text-base" title={r.title}>{REWARD_ICONS[r.type] || '⭐'}</span>
              ))}
              {rewards.length > 5 && <span className="text-[10px] text-gold-400/50 font-bold ml-1">+{rewards.length - 5}</span>}
            </div>
          )}
        </div>
      </div>


      {/* Daily Inspiration Quote */}
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
        <Link to="/planner" className="btn-primary py-4 flex items-center justify-center gap-2 text-sm font-bold">
          {t('dash_todays_tasks', lang)} <ArrowRight size={15} />
        </Link>
        <Link to="/resources" className="btn-secondary py-4 flex items-center justify-center gap-2 text-sm font-medium">
          <BookOpen size={14} /> {t('dash_study_center', lang)}
        </Link>
        <Link to="/mentor" className="btn-secondary py-4 flex items-center justify-center gap-2 text-sm font-medium">
          <Bot size={14} /> {t('dash_ask_mentor', lang)}
        </Link>
      </div>

      {/* Roadmap Progress Bar */}
      <div className="glass-card p-6" style={{ borderColor: "rgba(124,58,237,0.25)" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gold-200">{t('dash_roadmap_progress', lang)}</p>
          <Link to="/roadmap" className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium">{t('dash_view_plan', lang)}</Link>
        </div>
        <div className="progress-track h-2.5 mb-3">
          <div className="progress-bar-purple h-full" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-gold-500/40">{progress}% {t('complete', lang)} — Stage {user.currentStageIndex + 1} {t('of', lang)} your journey</p>
      </div>
    </div>
  );
}
