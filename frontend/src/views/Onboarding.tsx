
import React, { useState, useEffect, useMemo } from 'react';
import {
  Rocket, GraduationCap, Briefcase, User,
  ArrowRight, ArrowLeft, Lightbulb, Loader2, CheckCircle2, RefreshCw,
  Zap, Target, BookOpen, Sparkles
} from 'lucide-react';
import { UserProfile } from '../types';
import DreamDiscovery from './DreamDiscovery';
import { generateDreamSummary } from '../services/geminiService';

// ─── Career Taxonomy for Validation ──────────────────────────────────────────
const CAREER_TAXONOMY: string[] = [
  // Tech
  'Software Engineer', 'Data Scientist', 'Machine Learning Engineer', 'AI Engineer',
  'Web Developer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
  'Mobile App Developer', 'DevOps Engineer', 'Cloud Architect', 'Cybersecurity Analyst',
  'Game Developer', 'Blockchain Developer', 'UX Designer', 'UI Designer',
  'Product Manager', 'Data Analyst', 'Database Administrator', 'Systems Architect',
  // Medical
  'Doctor', 'Surgeon', 'Dentist', 'Pharmacist', 'Nurse', 'Veterinarian',
  'Physiotherapist', 'Psychologist', 'Psychiatrist', 'Biomedical Engineer',
  'Medical Researcher', 'Public Health Specialist',
  // Government / Civil Services
  'IAS Officer', 'IPS Officer', 'IFS Officer', 'UPSC Aspirant', 'Civil Servant',
  'District Collector', 'District Magistrate', 'Government Administrator',
  // Engineering
  'Mechanical Engineer', 'Civil Engineer', 'Electrical Engineer', 'Electronics Engineer',
  'Chemical Engineer', 'Aerospace Engineer', 'Robotics Engineer', 'Environmental Engineer',
  // Business & Finance
  'Chartered Accountant', 'Investment Banker', 'Financial Analyst', 'Economist',
  'Management Consultant', 'Entrepreneur', 'Business Analyst', 'Marketing Manager',
  'Human Resources Manager', 'Supply Chain Manager',
  // Creative & Arts
  'Graphic Designer', 'Animator', 'Film Director', 'Photographer', 'Musician',
  'Actor', 'Fashion Designer', 'Interior Designer', 'Architect', 'Writer', 'Journalist',
  // Science & Research
  'Scientist', 'Physicist', 'Chemist', 'Biologist', 'Astronomer', 'Geologist',
  'Research Scientist', 'Environmental Scientist',
  // Education & Law
  'Teacher', 'Professor', 'Lawyer', 'Judge', 'Legal Advisor',
  // Other
  'Pilot', 'Astronaut', 'Chef', 'Sports Coach', 'Athlete', 'Social Worker',
  'Content Creator', 'Digital Marketer', 'Ethical Hacker',
];

/** Simple Levenshtein distance for fuzzy matching */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
      );
  return dp[m][n];
}

/** Find the best matching career from taxonomy. Returns null if exact match or too far. */
function findClosestCareer(input: string): string | null {
  const lower = input.trim().toLowerCase();
  if (!lower || lower.length < 3) return null;

  // Check for exact match first (case insensitive)
  const exact = CAREER_TAXONOMY.find(c => c.toLowerCase() === lower);
  if (exact) return null; // perfect match, no suggestion needed

  // Check if any taxonomy entry contains the input or vice versa
  const contains = CAREER_TAXONOMY.find(c =>
    c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase())
  );
  if (contains) return null; // close enough

  // Fuzzy match
  let best = '', bestDist = Infinity;
  for (const career of CAREER_TAXONOMY) {
    const dist = levenshtein(lower, career.toLowerCase());
    const threshold = Math.max(2, Math.floor(career.length * 0.35)); // allow ~35% edits
    if (dist < bestDist && dist <= threshold) {
      bestDist = dist;
      best = career;
    }
  }
  return best || null;
}

/** Get autocomplete suggestions while typing */
function getAutocompleteSuggestions(input: string, max = 5): string[] {
  const lower = input.trim().toLowerCase();
  if (lower.length < 2) return [];
  return CAREER_TAXONOMY
    .filter(c => c.toLowerCase().includes(lower))
    .slice(0, max);
}

import { t, getCurrentLang } from '../i18n';

interface OnboardingProps {
  onComplete: (profile: Pick<UserProfile, 'name' | 'branch' | 'year' | 'dream' | 'educationLevel' | 'schoolBoard' | 'gradeOrSemester' | 'studyHoursPerDay' | 'targetYear' | 'city' | 'motivation'>) => void;
  isLight?: boolean;
}

export default function Onboarding({ onComplete, isLight = false }: OnboardingProps) {
  const lang = getCurrentLang();
  const [step, setStep] = useState(1);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [cameFromDiscovery, setCameFromDiscovery] = useState(false);
  const [dreamSummary, setDreamSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    educationLevel: '' as 'school' | 'college' | 'graduate' | 'self-learner' | '',
    schoolBoard: '',
    gradeOrSemester: '',
    branch: '',
    city: '',
    studyHoursPerDay: 3,
    targetYear: '',
    motivation: '',
    year: '',   // label built from educationLevel + gradeOrSemester
    dream: '',
  });

  // Dream validation state
  const [dreamSuggestion, setDreamSuggestion] = useState<string | null>(null);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [targetYearError, setTargetYearError] = useState('');
  const [bgError, setBgError] = useState('');

  const validateGradeInput = (level: string, grade: string) => {
    if (!level || !grade) {
      setBgError('');
      return;
    }
    const g = grade.toLowerCase();
    const numMatch = g.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0], 10) : 0;

    if (level === 'school') {
      if (num > 12 || g.includes('year') || g.includes('sem')) {
        setBgError('School students should enter a class between 1 and 12 (e.g., "Class 10").');
      } else {
        setBgError('');
      }
    } else if (level === 'college') {
      // For Undergraduates, 12 is definitely school class, not year.
      if (num >= 11 || g.includes('class')) {
        setBgError('Undergraduates should enter their Year (1-5) or Semester (1-10). "12th" belongs to School.');
      } else if (num > 0 && !g.includes('year') && !g.includes('sem')) {
        setBgError('Please specify if this is a "Year" or "Semester" (e.g., "2nd Year" or "Sem 4").');
      } else {
        setBgError('');
      }
    } else if (level === 'graduate') {
      if (num > 3 && g.includes('year')) {
        setBgError('Postgraduate degrees usually last 1-3 years.');
      } else if (num > 0 && !g.includes('year') && !g.includes('sem') && !g.includes('mtech') && !g.includes('mba') && !g.includes('ms')) {
        setBgError('Please specify your Degree and Year (e.g., "MBA 1st Year").');
      } else {
        setBgError('');
      }
    } else {
      setBgError('');
    }
  };

  const handleDreamChange = (val: string) => {
    setForm({ ...form, dream: val });
    // Live autocomplete
    const suggestions = getAutocompleteSuggestions(val, 5);
    setAutocompleteSuggestions(suggestions);
    setShowAutocomplete(suggestions.length > 0 && val.length >= 2);
    // Clear old suggestion
    setDreamSuggestion(null);
  };

  const handleDreamBlur = () => {
    setTimeout(() => setShowAutocomplete(false), 200);
    if (form.dream.trim().length >= 3) {
      const closest = findClosestCareer(form.dream);
      setDreamSuggestion(closest);
    }
  };

  const acceptSuggestion = (career: string) => {
    setForm({ ...form, dream: career });
    setDreamSuggestion(null);
    setShowAutocomplete(false);
  };

  const totalSteps = 5;

  const goToSummaryStep = async (newDream?: string, newBranch?: string, newYear?: string) => {
    setSummaryLoading(true);
    setStep(4);
    try {
      const d = newDream || form.dream;
      const b = newBranch || form.branch;
      const y = newYear || form.year;
      const summary = await generateDreamSummary(d, b, y);
      setDreamSummary(summary);
    } catch {
      const d = newDream || form.dream;
      setDreamSummary(
        `A ${d} is a skilled professional who drives innovation and solves real-world problems. Day-to-day, you'll design, build, and improve products or services that impact people's lives. Your core responsibilities will include planning projects, collaborating with teams, and delivering high-quality results.`
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 1) { setStep(2); return; }
    if (step === 2) {
      // Build year label from educationLevel + gradeOrSemester
      const yearLabel = form.gradeOrSemester || form.educationLevel;
      setForm(f => ({ ...f, year: yearLabel }));
      setStep(3);
      return;
    }
    if (step === 3) { setCameFromDiscovery(false); goToSummaryStep(); return; }
    if (step === 4) { setStep(5); return; }
    if (step === 5) {
      const yearLabel = form.gradeOrSemester || form.educationLevel;
      onComplete({ ...form, year: yearLabel });
    }
  };

  const handleBack = () => {
    if (step === 2) { setStep(1); return; }
    if (step === 3) { setStep(2); return; }
    if (step === 4) { 
      if (cameFromDiscovery) {
        setShowDiscovery(true);
      } else {
        setStep(3); 
      }
      setDreamSummary(''); 
      return; 
    }
    if (step === 5) { setStep(4); return; }
  };

  const isNextDisabled = () => {
    if (step === 1 && !form.name.trim()) return true;
    if (step === 2) {
      if (!form.educationLevel) return true;
      if (form.educationLevel !== 'self-learner' && !form.gradeOrSemester.trim()) return true;
      if (form.educationLevel === 'school' && !form.schoolBoard) return true;
      if (!form.branch.trim()) return true;
      if (!form.targetYear) return true;
      if (!!targetYearError || !!bgError) return true;
    }
    if (step === 3 && !form.dream.trim()) return true;
    if (step === 4 && summaryLoading) return true;
    return false;
  };

  // Dream Discovery mode
  const discoveryNode = (
    <div style={{ display: showDiscovery ? 'block' : 'none' }}>
      <DreamDiscovery
        isLight={isLight}
        onComplete={(dream, subjects) => {
          const branch = subjects[0] || form.branch;
          const yearLabel = form.gradeOrSemester || form.educationLevel;
          setForm({ ...form, dream, branch, year: yearLabel });
          setCameFromDiscovery(true);
          setShowDiscovery(false);
          goToSummaryStep(dream, branch, yearLabel);
        }}
        onSkip={() => {
          setShowDiscovery(false);
          setStep(3);
          setCameFromDiscovery(false);
        }}
      />
    </div>
  );

  const progressPercent = ((step - 1) / (totalSteps - 1)) * 100;

  // Input / select shared styles
  const inputClass = "w-full rounded-xl px-4 py-3.5 text-sm transition-all outline-none";
  const inputStyle = isLight
    ? { background: '#f9fafb', border: '1px solid #d1d5db', color: '#111827' }
    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(211,156,59,0.25)', color: '#fde68a' };
  const labelClr = isLight ? '#6b7280' : undefined;
  const headClr  = isLight ? '#111827' : undefined;
  const subClr   = isLight ? '#374151' : undefined;

  return (
    <>
      {discoveryNode}
      {!showDiscovery && (
    <div
      className="min-h-screen w-full overflow-y-auto overscroll-contain"
      style={{ background: isLight ? '#ffffff' : undefined }}
    >
      {/* Fixed ambient glows — don't affect document flow */}
      {!isLight && <div className="fixed top-1/3 left-1/4 w-96 h-96 bg-purple-900/20 blur-[140px] rounded-full pointer-events-none" style={{ zIndex: 0 }} />}
      {!isLight && <div className="fixed bottom-1/3 right-1/4 w-72 h-72 bg-yellow-900/10 blur-[120px] rounded-full pointer-events-none" style={{ zIndex: 0 }} />}
      {isLight && <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-orange-50 blur-[80px] rounded-full pointer-events-none opacity-60" style={{ zIndex: 0 }} />}
      {isLight && <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-sky-50 blur-[80px] rounded-full pointer-events-none opacity-40" style={{ zIndex: 0 }} />}

      {/* Page content — centred, scrollable */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8 lg:px-6 lg:py-12">
        <div className="w-full my-auto" style={{ maxWidth: 448 }}>

        {/* Logo + title */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-16 h-16 mb-3">
            <img src={isLight ? "/assets/logo-light.png" : "/assets/logo.png"} className="w-full h-full object-contain" alt="Kalam Spark Logo" />
          </div>
          <h1 className="heading-gold font-cinzel text-2xl font-bold tracking-widest">Kalam Spark</h1>
          <p className="text-sm mt-1" style={{ color: isLight ? '#9a3412' : undefined, opacity: isLight ? 0.7 : undefined }}>Let's set up your journey</p>
        </div>

        {/* Card — no height restriction, page itself scrolls */}
        <div
          className="glass-card glass-inner-shadow p-6 lg:p-8"
          style={{
            ...(isLight
              ? { background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 4px 32px rgba(0,0,0,0.08)' }
              : { borderColor: 'rgba(211,156,59,0.22)' }),
          }}
        >
          {/* Progress bar */}
          <div className="progress-track h-1.5 mb-8">
            <div className="progress-bar-gold h-full" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="space-y-6">
            {/* ── Step 1: Name ── */}
            {step === 1 && (
              <div className="space-y-4 fade-up">
                <div className="flex items-center gap-2 mb-1">
                  <User className="text-orange-500" size={15} />
                  <h2 className="text-sm font-semibold" style={{ color: headClr }}>What's your name?</h2>
                </div>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && !isNextDisabled() && handleNext()}
                  placeholder="Enter your name"
                  className={inputClass}
                  style={inputStyle}
                  autoFocus
                />
              </div>
            )}

            {/* ── Step 2: Background (rich questions) ── */}
            {step === 2 && (
              <div className="space-y-4 fade-up">
                <div className="flex items-center gap-2 mb-1">
                  <GraduationCap className="text-orange-500" size={15} />
                  <h2 className="text-sm font-semibold" style={{ color: headClr }}>{t('ob_your_background', lang)}</h2>
                </div>
                <div className="space-y-3">
                  {/* Education Level */}
                  <div>
                    <p className="text-xs mb-1.5 ml-1" style={{ color: labelClr ?? 'rgba(211,156,59,0.4)' }}>{t('ob_education_level', lang)}</p>
                    <select
                      value={form.educationLevel}
                      onChange={(e) => {
                        const level = e.target.value as any;
                        setForm({ ...form, educationLevel: level });
                        validateGradeInput(level, form.gradeOrSemester);
                      }}
                      className={inputClass}
                      style={{ ...inputStyle, color: form.educationLevel ? (isLight ? '#111827' : undefined) : (isLight ? '#9ca3af' : 'rgba(211,156,59,0.3)') }}
                    >
                      <option value="" style={{ color: isLight ? '#111827' : '#e2e8f0', background: isLight ? '#ffffff' : '#0f172a' }}>{t('ob_choose_level', lang)}</option>
                      <option value="school" style={{ color: isLight ? '#111827' : '#e2e8f0', background: isLight ? '#ffffff' : '#0f172a' }}>{t('ob_high_school', lang)}</option>
                      <option value="college" style={{ color: isLight ? '#111827' : '#e2e8f0', background: isLight ? '#ffffff' : '#0f172a' }}>{t('ob_college', lang)}</option>
                      <option value="graduate" style={{ color: isLight ? '#111827' : '#e2e8f0', background: isLight ? '#ffffff' : '#0f172a' }}>{t('ob_graduate', lang)}</option>
                      <option value="self-learner" style={{ color: isLight ? '#111827' : '#e2e8f0', background: isLight ? '#ffffff' : '#0f172a' }}>{t('ob_self_learner', lang)}</option>
                    </select>
                  </div>

                  {/* Conditional: School board */}
                  {form.educationLevel === 'school' && (
                    <div>
                      <p className="text-xs mb-1.5 ml-1" style={{ color: labelClr ?? 'rgba(211,156,59,0.4)' }}>{t('ob_school_board', lang)}</p>
                      <select
                        value={form.schoolBoard}
                        onChange={(e) => setForm({ ...form, schoolBoard: e.target.value })}
                        className={inputClass}
                        style={{ ...inputStyle, color: form.schoolBoard ? (isLight ? '#111827' : undefined) : (isLight ? '#9ca3af' : 'rgba(211,156,59,0.3)') }}
                      >
                        <option value="" style={{ color: isLight ? '#111827' : '#e2e8f0', background: isLight ? '#ffffff' : '#0f172a' }}>{t('ob_choose_board', lang)}</option>
                        {['CBSE', 'State Board (Tamil Nadu)', 'State Board (Karnataka)', 'State Board (Andhra Pradesh)', 'State Board (Kerala)', 'State Board (Maharashtra)', 'State Board (UP)', 'ICSE / ISC', 'IB (International)', 'Other'].map(b => (
                          <option key={b} value={b} style={{ color: isLight ? '#111827' : '#e2e8f0', background: isLight ? '#ffffff' : '#0f172a' }}>{b}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Grade / Semester / Year */}
                  {form.educationLevel !== 'self-learner' && (
                    <div>
                      <p className="text-xs mb-1.5 ml-1" style={{ color: labelClr ?? 'rgba(211,156,59,0.4)' }}>
                        {form.educationLevel === 'school' ? 'Class' : 
                         form.educationLevel === 'college' ? 'Year / Semester' : 
                         form.educationLevel === 'graduate' ? 'Degree & Year' : 
                         t('ob_grade_semester', lang)}
                      </p>
                      <input
                        type="text"
                        value={form.gradeOrSemester}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm({ ...form, gradeOrSemester: val });
                          validateGradeInput(form.educationLevel, val);
                        }}
                        placeholder={
                          form.educationLevel === 'school' ? 'e.g. Class 10' :
                          form.educationLevel === 'college' ? 'e.g. 2nd Year or Sem 4' :
                          form.educationLevel === 'graduate' ? 'e.g. MBA 1st Year' :
                          t('ob_enter_grade', lang)
                        }
                        className={inputClass}
                        style={bgError ? { ...inputStyle, borderColor: '#ef4444' } : inputStyle}
                      />
                      {bgError && (
                        <p className="text-[11px] mt-1.5 ml-1 text-red-500 flex items-center gap-1 leading-tight">
                          ⚠️ {bgError}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Subject */}
                  <div>
                    <p className="text-xs mb-1.5 ml-1" style={{ color: labelClr ?? 'rgba(211,156,59,0.4)' }}>{t('ob_study_field', lang)}</p>
                    <input
                      type="text"
                      value={form.branch}
                      onChange={(e) => setForm({ ...form, branch: e.target.value })}
                      placeholder={t('ob_field_placeholder', lang)}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>

                  {/* Study Hours */}
                  <div>
                    <p className="text-xs mb-1.5 ml-1" style={{ color: labelClr ?? 'rgba(211,156,59,0.4)' }}>{t('ob_study_hours', lang)}: <span className="font-bold" style={{ color: isLight ? '#92400e' : undefined }}>{form.studyHoursPerDay}h / day</span></p>
                    <input
                      type="range" min={1} max={10} value={form.studyHoursPerDay}
                      onChange={(e) => setForm({ ...form, studyHoursPerDay: Number(e.target.value) })}
                      className="w-full accent-orange-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-gold-500/30">
                      <span>1h</span><span>5h</span><span>10h</span>
                    </div>
                  </div>

                  {/* Target Year */}
                  <div>
                    <p className="text-xs mb-1.5 ml-1" style={{ color: labelClr ?? 'rgba(211,156,59,0.4)' }}>{t('ob_target_year', lang)}</p>
                    <input
                      type="number"
                      value={form.targetYear}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({ ...form, targetYear: val });
                        const yr = parseInt(val, 10);
                        const currentYear = new Date().getFullYear();
                        const maxYear = currentYear + 50;
                        if (val) {
                          if (isNaN(yr) || yr < currentYear) {
                            setTargetYearError(`Please enter a future year (${currentYear} or later).`);
                          } else if (yr > maxYear) {
                            setTargetYearError(`Goal must be achievable within 50 years (by ${maxYear}).`);
                          } else {
                            setTargetYearError('');
                          }
                        } else {
                          setTargetYearError('');
                        }
                      }}
                      min={new Date().getFullYear()}
                      max={new Date().getFullYear() + 50}
                      placeholder={`e.g. ${new Date().getFullYear() + 2}`}
                      className={inputClass}
                      style={targetYearError
                        ? { ...inputStyle, borderColor: '#ef4444' }
                        : inputStyle}
                    />
                    {targetYearError && (
                      <p className="text-[11px] mt-1.5 ml-1 text-red-500 flex items-center gap-1 leading-tight">
                        ⚠️ {targetYearError}
                      </p>
                    )}
                  </div>

                  {/* City */}
                  <div>
                    <p className="text-xs mb-1.5 ml-1" style={{ color: labelClr ?? 'rgba(211,156,59,0.4)' }}>{t('ob_city', lang)}</p>
                    <input
                      type="text" value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder={t('ob_city_placeholder', lang)}
                      className={inputClass} style={inputStyle}
                    />
                  </div>

                  {/* Motivation */}
                  <div>
                    <p className="text-xs mb-1.5 ml-1" style={{ color: labelClr ?? 'rgba(211,156,59,0.4)' }}>{t('ob_motivation', lang)}</p>
                    <textarea
                      value={form.motivation}
                      onChange={(e) => setForm({ ...form, motivation: e.target.value })}
                      placeholder={t('ob_motivation_placeholder', lang)}
                      className={`${inputClass} min-h-[70px] resize-none`}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Dream (with validation) ── */}
            {step === 3 && (
              <div className="space-y-4 fade-up">
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase className="text-orange-500" size={15} />
                  <h2 className="text-sm font-semibold" style={{ color: headClr }}>Your dream career</h2>
                </div>
                <div className="relative">
                  <textarea
                    value={form.dream}
                    onChange={(e) => handleDreamChange(e.target.value)}
                    onBlur={handleDreamBlur}
                    onFocus={() => {
                      if (autocompleteSuggestions.length > 0) setShowAutocomplete(true);
                    }}
                    placeholder="What do you want to become? e.g. Doctor, Software Engineer, Artist..."
                    className={`${inputClass} min-h-[100px] resize-none`}
                    style={inputStyle}
                  />

                  {/* Autocomplete Dropdown */}
                  {showAutocomplete && autocompleteSuggestions.length > 0 && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-20"
                      style={isLight
                        ? { background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }
                        : { background: 'rgba(6,3,18,0.95)', border: '1px solid rgba(211,156,59,0.30)', backdropFilter: 'blur(12px)' }}
                    >
                      {autocompleteSuggestions.map((s, i) => (
                        <button
                          key={i}
                          className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
                          style={{ color: isLight ? '#374151' : '#fde68a' }}
                          onMouseDown={(e) => { e.preventDefault(); acceptSuggestion(s); }}
                        >
                          <Sparkles size={11} className="text-purple-400 shrink-0" />
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fuzzy Match Suggestion */}
                {dreamSuggestion && (
                  <div
                    className="flex items-center gap-2 p-3 rounded-xl animate-fade-in"
                    style={{ background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.25)' }}
                  >
                    <Sparkles size={13} className="text-orange-400 shrink-0" />
                    <p className="text-xs text-gold-300/70 flex-1">
                      Did you mean <button
                        onClick={() => acceptSuggestion(dreamSuggestion)}
                        className="text-orange-400 font-semibold underline underline-offset-2 hover:text-orange-300 transition-colors"
                      >
                        {dreamSuggestion}
                      </button>?
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setShowDiscovery(true)}
                  className="w-full py-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 text-purple-300"
                  style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}
                >
                  <Lightbulb size={13} /> Not sure? Take the Dream Discovery Quiz
                </button>
              </div>
            )}

            {/* ── Step 4: Career Description (AI) ── */}
            {step === 4 && (
              <div className="space-y-5 fade-up">
                <div className="text-center">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.30)' }}
                  >
                    <Rocket size={22} className="text-purple-400" />
                  </div>
                  <h2 className="font-cinzel text-lg font-bold text-gold-100 mb-1">About Your Dream Career</h2>
                  <p className="text-xs text-gold-400/40">Here's what it means to be a <span className="text-purple-400 font-medium">{form.dream}</span></p>
                </div>

                <div
                  className="space-y-3 p-5 rounded-xl"
                  style={isLight
                    ? { background: '#f9fafb', border: '1px solid #e5e7eb' }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(124,58,237,0.20)' }}
                >
                  <div className="flex items-center gap-3 pb-3" style={{ borderBottom: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
                      <Briefcase size={15} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium" style={{ color: labelClr ?? 'rgba(211,156,59,0.4)' }}>Your Dream Role</p>
                      <p className="text-sm font-bold" style={{ color: isLight ? '#111827' : undefined }}>{form.dream}</p>
                    </div>
                  </div>

                  {summaryLoading ? (
                    <div className="flex items-center gap-3 py-6 justify-center">
                      <Loader2 size={18} className="animate-spin text-purple-400" />
                      <p className="text-xs text-gold-400/40">AI is analysing this career for you...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dreamSummary.split(/(?<=[.!?])\s+/).filter(Boolean).map((sentence, i) => {
                        const icons = [<Target size={12} className="text-purple-400 shrink-0 mt-0.5" />, <Zap size={12} className="text-gold-400 shrink-0 mt-0.5" />, <BookOpen size={12} className="text-emerald-400 shrink-0 mt-0.5" />];
                        const labels = ['What this career is', 'Day-to-day work', 'Your responsibilities'];
                        const colors = ['text-purple-400', 'text-gold-400', 'text-emerald-400'];
                        return (
                          <div key={i} className="flex gap-2.5 p-3 rounded-xl"
                            style={isLight
                              ? { background: '#ffffff', border: '1px solid #e5e7eb' }
                              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                          >
                            {icons[i] || icons[2]}
                            <div>
                              <p className={`text-[10px] font-semibold mb-0.5 ${colors[i] || colors[2]}`}>{labels[i] || ''}</p>
                              <p className="text-xs leading-relaxed" style={{ color: isLight ? '#374151' : 'rgba(211,156,59,0.6)' }}>{sentence}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)' }}>
                  <p className="text-xs text-gold-300/60 leading-relaxed">
                    ✅ <span className="text-emerald-400 font-medium">Sounds like you!</span> Click "Accept & Build Roadmap" to generate your personalized career plan.
                  </p>
                </div>

                {!summaryLoading && (
                  <button
                    onClick={() => { 
                      if (cameFromDiscovery) {
                        setShowDiscovery(true);
                      } else {
                        setStep(3);
                      }
                      setDreamSummary(''); 
                    }}
                    className="flex items-center gap-1.5 text-xs text-gold-500/40 hover:text-gold-300 transition-colors mx-auto"
                  >
                    <RefreshCw size={11} /> Change my dream career
                  </button>
                )}
              </div>
            )}

            {/* ── Step 5: Final Confirm ── */}
            {step === 5 && (
              <div className="space-y-5 text-center fade-up py-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.35)' }}
                >
                  <CheckCircle2 size={28} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="font-cinzel text-xl font-bold text-gold-100">You're all set!</h2>
                  <p className="text-sm text-gold-400/50 mt-2 leading-relaxed">
                    <span className="text-purple-400 font-medium">{form.name}</span>, your personalized plan to become a{' '}
                    <span className="text-gold-300 font-medium">{form.dream}</span> is ready!
                  </p>
                </div>
                <div className="text-left p-4 rounded-xl space-y-2"
                style={isLight
                  ? { background: '#f9fafb', border: '1px solid #e5e7eb' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(211,156,59,0.18)' }}
              >
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: labelClr ?? 'rgba(211,156,59,0.4)' }}>Summary</p>
                {[['Name', form.name], ['Dream', form.dream], ['Level', form.year], ['Subject', form.branch]].map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span style={{ color: isLight ? '#9ca3af' : 'rgba(211,156,59,0.4)' }}>{label}</span>
                    <span style={{ color: label === 'Dream' ? (isLight ? '#92400e' : undefined) : (isLight ? '#374151' : 'rgba(211,156,59,0.7)'), fontWeight: label === 'Dream' ? 600 : 500 }}>{val}</span>
                  </div>
                ))}
              </div>
              </div>
            )}

            {/* ── Navigation ── */}
            <div className="flex items-center gap-3">
              {step > 1 && (
                <button
                  onClick={handleBack}
                  disabled={summaryLoading}
                  className="btn-secondary flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium shrink-0 disabled:opacity-40"
                >
                  <ArrowLeft size={15} />
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={isNextDisabled()}
                className={`flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all ${
                  isNextDisabled()
                    ? 'cursor-not-allowed text-gold-500/20'
                    : 'btn-primary'
                }`}
                style={isNextDisabled() ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' } : {}}
              >
                {summaryLoading && step === 4
                  ? <><Loader2 size={14} className="animate-spin" /> Analysing Career...</>
                  : step === 4
                  ? <><CheckCircle2 size={14} /> Accept & Build Roadmap</>
                  : step === 5
                  ? <>View My Roadmap <ArrowRight size={15} /></>
                  : <>Continue <ArrowRight size={15} /></>
                }
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] mt-4" style={{ color: isLight ? '#9ca3af' : 'rgba(211,156,59,0.25)' }}>Step {step} of {totalSteps}</p>
      </div>
    </div>
    </div>
      )}
    </>
  );
}
