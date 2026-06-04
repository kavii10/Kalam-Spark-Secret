
import React, { useState } from 'react';
import { Compass, ArrowRight, ArrowLeft, Check, Target, Brain, Palette, Code, Wrench, Users, Camera, Stethoscope, Scale, BarChart3, Mic, BookOpen, Rocket, Plus } from 'lucide-react';

interface DreamDiscoveryProps {
  onComplete: (dream: string, subjects: string[]) => void;
  onSkip: () => void;
  isLight?: boolean;
}

const INTEREST_AREAS = [
  { id: 'tech', label: 'Technology & Coding', icon: Code, color: 'text-blue-400' },
  { id: 'science', label: 'Science & Research', icon: Brain, color: 'text-emerald-400' },
  { id: 'art', label: 'Art & Design', icon: Palette, color: 'text-pink-400' },
  { id: 'business', label: 'Business & Finance', icon: BarChart3, color: 'text-amber-400' },
  { id: 'health', label: 'Healthcare & Medicine', icon: Stethoscope, color: 'text-red-400' },
  { id: 'engineering', label: 'Engineering', icon: Wrench, color: 'text-orange-400' },
  { id: 'media', label: 'Media & Communication', icon: Camera, color: 'text-cyan-400' },
  { id: 'law', label: 'Law & Justice', icon: Scale, color: 'text-violet-400' },
  { id: 'teaching', label: 'Teaching & Education', icon: BookOpen, color: 'text-teal-400' },
  { id: 'music', label: 'Music & Performance', icon: Mic, color: 'text-fuchsia-400' },
  { id: 'social', label: 'Social Work & NGOs', icon: Users, color: 'text-lime-400' },
  { id: 'space', label: 'Space & Aviation', icon: Rocket, color: 'text-indigo-400' },
];

const PERSONALITY_QUESTIONS = [
  { question: "When you have free time, what do you enjoy most?", options: [{ text: "Building or fixing things", tags: ['engineering', 'tech'] }, { text: "Reading or learning something new", tags: ['science', 'teaching'] }, { text: "Drawing, designing, or creating", tags: ['art', 'media'] }, { text: "Helping or talking to people", tags: ['social', 'health'] }] },
  { question: "Which school subject excites you the most?", options: [{ text: "Math & Physics", tags: ['engineering', 'tech', 'space'] }, { text: "Biology & Chemistry", tags: ['health', 'science'] }, { text: "Language & Literature", tags: ['media', 'law', 'teaching'] }, { text: "Business Studies & Economics", tags: ['business'] }] },
  { question: "How would your friends describe you?", options: [{ text: "Logical and analytical", tags: ['tech', 'science', 'engineering'] }, { text: "Creative and expressive", tags: ['art', 'media', 'music'] }, { text: "Caring and empathetic", tags: ['health', 'social', 'teaching'] }, { text: "Leader and organized", tags: ['business', 'law'] }] },
  { question: "What kind of impact do you want to make?", options: [{ text: "Invent something that changes the world", tags: ['tech', 'engineering', 'space'] }, { text: "Save lives and help people heal", tags: ['health', 'science'] }, { text: "Inspire people through stories or art", tags: ['art', 'media', 'music'] }, { text: "Build companies or create jobs", tags: ['business'] }] },
];

import { discoverDream } from '../services/geminiService';

// Fallback just in case, removed the unused map array




const getGlassCard = (isLight: boolean): React.CSSProperties => ({
  background: isLight ? '#ffffff' : 'rgba(6,3,18,0.50)',
  backdropFilter: isLight ? undefined : 'blur(22px)',
  border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,140,66,0.22)',
  boxShadow: isLight ? '0 8px 32px rgba(0,0,0,0.08)' : undefined,
  borderRadius: 18
});

export default function DreamDiscovery({ onComplete, onSkip, isLight = false }: DreamDiscoveryProps) {
  const [step, setStep] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [personalityAnswers, setPersonalityAnswers] = useState<(number | string)[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [isOtherInterestSelected, setIsOtherInterestSelected] = useState(false);
  const [isOtherPersonalitySelected, setIsOtherPersonalitySelected] = useState(false);
  const [customPersonalityText, setCustomPersonalityText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const totalSteps = 2 + PERSONALITY_QUESTIONS.length;

  const toggleInterest = (id: string) => {
    if (id === 'other') {
      setIsOtherInterestSelected(!isOtherInterestSelected);
      if (isOtherInterestSelected) {
        setSelectedInterests(prev => prev.filter(i => i !== 'other'));
        setCustomInterest("");
      } else {
        if (selectedInterests.length < 3) {
          setSelectedInterests(prev => [...prev, 'other']);
        }
      }
      return;
    }
    setSelectedInterests(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 3 ? [...prev, id] : prev);
  };

  const answerPersonality = async (optionIdx: number | 'other') => {
    if (optionIdx === 'other') {
      setIsOtherPersonalitySelected(true);
      return;
    }

    const finalAnswer = isOtherPersonalitySelected ? customPersonalityText : optionIdx;
    if (isOtherPersonalitySelected && !customPersonalityText.trim()) return;

    const newAnswers = [...personalityAnswers, finalAnswer];
    setPersonalityAnswers(newAnswers);
    setIsOtherPersonalitySelected(false);
    setCustomPersonalityText("");
    
    if (step < totalSteps - 1) {
      setTimeout(() => setStep(step + 1), 300);
    } else {
      // Last question answered! Call AI
      setStep(totalSteps);
      setLoading(true);
      try {
        const selectedInterestLabels = INTEREST_AREAS.filter(a => selectedInterests.includes(a.id)).map(a => a.label);
        if (isOtherInterestSelected && customInterest) {
          selectedInterestLabels.push(customInterest);
        }
        
        const personalityTexts = newAnswers.map((ans, qIdx) => {
          const ansText = typeof ans === 'string' ? ans : PERSONALITY_QUESTIONS[qIdx].options[ans].text;
          return `${PERSONALITY_QUESTIONS[qIdx].question} -> ${ansText}`;
        });
        const aiResults = await discoverDream(selectedInterestLabels, personalityTexts);
        setResults(Array.isArray(aiResults) ? aiResults : []);
      } catch (err) {
        console.error('Dream discovery failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const isLastPersonalityQ = step === totalSteps;
  const progressPercent = (step / totalSteps) * 100;

  const wrapper = (content: React.ReactNode) => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch' as any,
        background: isLight ? '#ffffff' : '#070e20',
        zIndex: 100,
      }}
    >
      {/* Ambient glows — absolute so they scroll with content but don't block */}
      {!isLight && <div style={{ position: 'fixed', top: '33%', left: '25%', width: 384, height: 384, borderRadius: '50%', background: 'rgba(80,40,160,0.15)', filter: 'blur(140px)', pointerEvents: 'none', zIndex: 0 }} />}
      {!isLight && <div style={{ position: 'fixed', bottom: '33%', right: '25%', width: 288, height: 288, borderRadius: '50%', background: 'rgba(60,30,120,0.12)', filter: 'blur(120px)', pointerEvents: 'none', zIndex: 0 }} />}
      {isLight && <div style={{ position: 'fixed', top: 0, right: 0, width: 500, height: 500, borderRadius: '50%', background: '#fff7ed', filter: 'blur(80px)', pointerEvents: 'none', opacity: 0.6, zIndex: 0 }} />}
      {isLight && <div style={{ position: 'fixed', bottom: 0, left: 0, width: 400, height: 400, borderRadius: '50%', background: '#f0f9ff', filter: 'blur(80px)', pointerEvents: 'none', opacity: 0.4, zIndex: 0 }} />}

      {/* Content — centred with safe vertical padding so it can scroll */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: step === 1 ? 560 : isLastPersonalityQ ? 800 : 440 }}>
          {content}
        </div>
      </div>
    </div>
  );

  // Intro
  if (step === 0) return wrapper(
    <div className="text-center space-y-8 fade-up" style={getGlassCard(isLight)}>
      <div className="p-10 pb-0">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(255,140,66,0.12)', border: '1px solid rgba(255,140,66,0.30)' }}>
          <Compass size={30} className={isLight ? "text-orange-500" : "text-gold-400"} />
        </div>
        <h1 className="heading-gold font-cinzel text-3xl font-bold tracking-tight mb-3">Discover Your Dream</h1>
        <p className="text-sm leading-relaxed" style={{ color: isLight ? '#4b5563' : 'rgba(255,179,128,0.55)' }}>
          Not sure which career is right for you? Take this quick quiz to discover your strengths and find your ideal career path.
        </p>
      </div>
      <div className="space-y-3 p-10 pt-0">
        <button onClick={() => setStep(1)} className="btn-primary w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
          Start Discovery <ArrowRight size={16} />
        </button>
        <button onClick={onSkip} className="w-full py-3 text-sm font-medium transition-colors" style={{ color: isLight ? '#9ca3af' : 'rgba(255,140,66,0.40)' }}
          onMouseEnter={e => (e.currentTarget.style.color = isLight ? '#4b5563' : 'rgba(255,140,66,0.70)')}
          onMouseLeave={e => (e.currentTarget.style.color = isLight ? '#9ca3af' : 'rgba(255,140,66,0.40)')}>
          I already know my dream career
        </button>
      </div>
    </div>
  );

  // Interest Selection
  if (step === 1) return wrapper(
    <div className="space-y-7 fade-up">
      <div style={getGlassCard(isLight)} className="p-6 pb-4">
        <div className="progress-track h-1.5 mb-6" style={isLight ? { background: '#f3f4f6' } : undefined}>
          <div className="progress-bar-gold h-full" style={{ width: `${(1 / totalSteps) * 100}%` }} />
        </div>
        <p className="text-xs font-medium mb-1" style={{ color: isLight ? '#9ca3af' : 'rgba(211,156,59,0.4)' }}>Step 1 of {totalSteps}</p>
        <h2 className="heading-gold font-cinzel text-xl font-bold">Pick your top 3 interests</h2>
        <p className="text-sm mt-1" style={{ color: isLight ? '#6b7280' : 'rgba(255,140,66,0.45)' }}>Select the areas that excite you most</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {INTEREST_AREAS.map(area => {
          const Icon = area.icon;
          const selected = selectedInterests.includes(area.id);
          return (
            <button key={area.id} onClick={() => toggleInterest(area.id)}
              className="p-4 rounded-xl text-left transition-all"
              style={selected
                ? (isLight
                   ? { background: '#fff7ed', border: '2px solid #ea580c', boxShadow: '0 4px 12px rgba(234,88,12,0.1)' }
                   : { background: 'rgba(255,140,66,0.15)', border: '2px solid rgba(255,140,66,0.65)', boxShadow: '0 0 16px rgba(255,140,66,0.20)' })
                : (isLight
                   ? { background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }
                   : { background: 'rgba(6,3,18,0.40)', border: '1px solid rgba(255,140,66,0.18)', backdropFilter: 'blur(12px)' })
              }>
              <Icon size={20} className={selected ? (isLight ? 'text-orange-600 mb-2' : 'text-gold-400 mb-2') : `${area.color} mb-2`} />
              <p className="text-xs font-medium" style={{ color: selected ? (isLight ? '#9a3412' : '#ff8c42') : (isLight ? '#4b5563' : 'rgba(255,179,128,0.60)') }}>{area.label}</p>
              {selected && <Check size={13} className={isLight ? "text-orange-600 mt-1" : "text-gold-400 mt-1"} />}
            </button>
          )
        })}
        {/* Other Interest Button */}
        <button onClick={() => toggleInterest('other')}
          className="p-4 rounded-xl text-left transition-all"
          style={isOtherInterestSelected
            ? (isLight
               ? { background: '#fff7ed', border: '2px solid #ea580c', boxShadow: '0 4px 12px rgba(234,88,12,0.1)' }
               : { background: 'rgba(255,140,66,0.15)', border: '2px solid rgba(255,140,66,0.65)', boxShadow: '0 0 16px rgba(255,140,66,0.20)' })
            : (isLight
               ? { background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }
               : { background: 'rgba(6,3,18,0.40)', border: '1px solid rgba(255,140,66,0.18)', backdropFilter: 'blur(12px)' })
          }>
          <Plus size={20} className={isOtherInterestSelected ? (isLight ? 'text-orange-600 mb-2' : 'text-gold-400 mb-2') : 'text-zinc-400 mb-2'} />
          <p className="text-xs font-medium" style={{ color: isOtherInterestSelected ? (isLight ? '#9a3412' : '#ff8c42') : (isLight ? '#4b5563' : 'rgba(255,179,128,0.60)') }}>Other Area</p>
          {isOtherInterestSelected && <Check size={13} className={isLight ? "text-orange-600 mt-1" : "text-gold-400 mt-1"} />}
        </button>
      </div>

      {isOtherInterestSelected && (
        <div className="fade-up">
          <input
            type="text"
            placeholder="Type your other interest here..."
            value={customInterest}
            onChange={(e) => setCustomInterest(e.target.value)}
            className="w-full p-4 rounded-xl text-sm outline-none transition-all"
            style={isLight
              ? { background: '#ffffff', border: '1px solid #ea580c', color: '#111827' }
              : { background: 'rgba(6,3,18,0.50)', border: '1px solid rgba(255,140,66,0.40)', color: '#fff', boxShadow: '0 0 12px rgba(255,140,66,0.10)' }
            }
          />
        </div>
      )}

      <button onClick={() => setStep(2)} disabled={selectedInterests.length < 1 || (isOtherInterestSelected && !customInterest.trim())}
        className="btn-primary w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
        Continue <ArrowRight size={16} />
      </button>
    </div>
  );

  // Personality Questions
  if (step >= 2 && step < totalSteps) {
    const qIdx = step - 2;
    const q = PERSONALITY_QUESTIONS[qIdx];
    return wrapper(
      <div className="space-y-6 fade-up" key={step}>
        <div style={getGlassCard(isLight)} className="p-6">
          <div className="progress-track h-1.5 mb-5" style={isLight ? { background: '#f3f4f6' } : undefined}>
            <div className="progress-bar-gold h-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="text-xs font-medium mb-2" style={{ color: isLight ? '#9ca3af' : 'rgba(211,156,59,0.4)' }}>Step {step} of {totalSteps}</p>
          <h2 className="text-lg font-bold leading-relaxed" style={{ color: isLight ? '#111827' : '#fde68a' }}>{q.question}</h2>
        </div>
        <div className="space-y-3">
          {!isOtherPersonalitySelected ? (
            <>
              {q.options.map((opt, oIdx) => (
                <button key={oIdx} onClick={() => answerPersonality(oIdx)}
                  className="w-full p-4 rounded-xl text-left text-sm transition-all"
                  style={isLight
                    ? { background: '#ffffff', border: '1px solid #e5e7eb', color: '#4b5563', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }
                    : { background: 'rgba(6,3,18,0.45)', border: '1px solid rgba(255,140,66,0.22)', color: 'rgba(255,179,128,0.75)', backdropFilter: 'blur(16px)' }
                  }
                  onMouseEnter={e => {
                    if (isLight) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#ea580c'; (e.currentTarget as HTMLButtonElement).style.color = '#111827'; }
                    else { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,140,66,0.55)'; (e.currentTarget as HTMLButtonElement).style.color = '#ffb380'; }
                  }}
                  onMouseLeave={e => {
                    if (isLight) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.color = '#4b5563'; }
                    else { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,140,66,0.22)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,179,128,0.75)'; }
                  }}>
                  {opt.text}
                </button>
              ))}
              <button onClick={() => answerPersonality('other')}
                className="w-full p-4 rounded-xl text-left text-sm transition-all italic opacity-80"
                style={isLight
                  ? { background: '#f9fafb', border: '1px dashed #d1d5db', color: '#6b7280' }
                  : { background: 'rgba(6,3,18,0.30)', border: '1px dashed rgba(255,140,66,0.20)', color: 'rgba(255,179,128,0.50)' }
                }
                onMouseEnter={e => {
                  if (isLight) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#ea580c'; (e.currentTarget as HTMLButtonElement).style.color = '#ea580c'; }
                  else { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,140,66,0.40)'; (e.currentTarget as HTMLButtonElement).style.color = '#ff8c42'; }
                }}
                onMouseLeave={e => {
                  if (isLight) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }
                  else { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,140,66,0.20)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,179,128,0.50)'; }
                }}>
                Other...
              </button>
            </>
          ) : (
            <div className="space-y-4 fade-up">
              <div className="relative">
                <textarea
                  autoFocus
                  placeholder="Tell us in your own words..."
                  value={customPersonalityText}
                  onChange={(e) => setCustomPersonalityText(e.target.value)}
                  className="w-full p-5 rounded-xl text-sm outline-none transition-all min-h-[120px] resize-none"
                  style={isLight
                    ? { background: '#ffffff', border: '2px solid #ea580c', color: '#111827', boxShadow: '0 8px 32px rgba(234,88,12,0.08)' }
                    : { background: 'rgba(6,3,18,0.60)', border: '2px solid rgba(255,140,66,0.45)', color: '#fff', boxShadow: '0 0 24px rgba(255,140,66,0.15)' }
                  }
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <button onClick={() => setIsOtherPersonalitySelected(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.4)' }}>
                    Cancel
                  </button>
                  <button onClick={() => answerPersonality(0)} disabled={!customPersonalityText.trim()}
                    className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold disabled:opacity-50">
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {!isOtherPersonalitySelected && step > 2 && (
          <button onClick={() => setStep(step - 1)} className="flex items-center gap-1 text-xs mx-auto transition-colors" style={{ color: isLight ? '#9ca3af' : 'rgba(255,140,66,0.35)' }}
            onMouseEnter={e => (e.currentTarget.style.color = isLight ? '#4b5563' : 'rgba(255,140,66,0.70)')}
            onMouseLeave={e => (e.currentTarget.style.color = isLight ? '#9ca3af' : 'rgba(255,140,66,0.35)')}>
            <ArrowLeft size={12} /> Back
          </button>
        )}
      </div>
    )
  }

  // Results
  if (isLastPersonalityQ) return wrapper(
    <div className="text-center space-y-7 fade-up">
      <div style={getGlassCard(isLight)} className="p-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(255,140,66,0.10)', border: '1px solid rgba(255,140,66,0.30)' }}>
          <Target size={30} className={isLight ? "text-orange-500" : "text-gold-400"} />
        </div>
        <p className="text-[10px] font-bold mb-2 uppercase tracking-[0.2em]" style={{ color: isLight ? '#ea580c' : '#fbbf24' }}>Discovery Complete!</p>
        <h2 className="heading-gold font-cinzel text-2xl font-bold mb-2">Your Career Matches</h2>
        <p className="text-xs mb-8" style={{ color: isLight ? '#6b7280' : 'rgba(255,179,128,0.45)' }}>
          {loading 
            ? "AI is analyzing your profile to find your perfect careers..." 
            : `We've found ${results.length} paths that perfectly match your personality and interests. Choose one to start your journey.`}
        </p>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <svg className="animate-spin w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
            {results.map((res, i) => (
            <div key={i} 
              className="p-5 rounded-2xl flex flex-col items-center justify-between text-center transition-all hover:scale-[1.03] cursor-pointer group"
              style={isLight
                ? { background: '#f9fafb', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }
                : { background: 'rgba(6,3,18,0.40)', border: '1px solid rgba(255,140,66,0.15)', backdropFilter: 'blur(16px)' }
              }
              onClick={() => onComplete(res.dream, res.subjects)}
            >
              <div className="w-full">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 mx-auto transition-colors"
                  style={isLight ? { background: '#fff7ed', color: '#ea580c' } : { background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
                >
                    <Compass size={16} />
                </div>
                <h3 className="text-sm font-bold mb-2 font-cinzel leading-tight" style={{ color: isLight ? '#111827' : '#fbbf24' }}>
                  {res.dream && res.dream.trim() ? res.dream : `Career Path ${i + 1}`}
                </h3>
                {res.description && res.description.trim() && (
                  <p className="text-[11px] mb-3 leading-relaxed font-medium" style={{ color: isLight ? '#4b5563' : 'rgba(255,255,255,0.6)' }}>
                    {res.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 justify-center mb-6">
                  {(Array.isArray(res.subjects) ? res.subjects : []).slice(0,3).map((s, si) => (
                    <span key={si} className="px-2 py-0.5 rounded-full text-[8px] font-medium"
                      style={isLight
                        ? { background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#4b5563' }
                        : { background: 'rgba(255,140,66,0.08)', border: '1px solid rgba(255,140,66,0.15)', color: 'rgba(255,179,128,0.6)' }
                      }>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onComplete(res.dream, res.subjects); }}
                className="w-full py-2.5 rounded-xl text-[10px] font-bold transition-all"
                style={isLight
                  ? { background: '#ffffff', border: '1px solid #ea580c', color: '#ea580c' }
                  : { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }
                }
                onMouseEnter={e => {
                  if (isLight) { (e.currentTarget as HTMLButtonElement).style.background = '#ea580c'; (e.currentTarget as HTMLButtonElement).style.color = '#ffffff'; }
                  else { (e.currentTarget as HTMLButtonElement).style.background = '#fbbf24'; (e.currentTarget as HTMLButtonElement).style.color = '#000000'; }
                }}
                onMouseLeave={e => {
                  if (isLight) { (e.currentTarget as HTMLButtonElement).style.background = '#ffffff'; (e.currentTarget as HTMLButtonElement).style.color = '#ea580c'; }
                  else { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,191,36,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#fbbf24'; }
                }}
              >
                Choose Path
              </button>
            </div>
            ))}
          </div>
        )}

      </div>
      
      <div className="flex flex-col items-center gap-4">
        <button onClick={onSkip} className="flex items-center gap-2 text-xs font-medium transition-colors" style={{ color: isLight ? '#9ca3af' : 'rgba(255,140,66,0.40)' }}
          onMouseEnter={e => (e.currentTarget.style.color = isLight ? '#4b5563' : 'rgba(255,140,66,0.70)')}
          onMouseLeave={e => (e.currentTarget.style.color = isLight ? '#9ca3af' : 'rgba(255,140,66,0.40)')}>
          <ArrowLeft size={12} /> These don't fit? Enter my own dream instead
        </button>
      </div>
    </div>
  );

  return null; // Fallback
}
