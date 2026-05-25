
import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, Check, Wand2 } from 'lucide-react';

/* ─── Tour Step Config ─── */
interface TourStep {
  targetId: string;
  title: string;
  description: string;
  tip: string;
  emoji: string;
  position: 'right' | 'left' | 'bottom' | 'top' | 'center';
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'nav-roadmap',
    title: 'My Plan — Your Roadmap',
    description: 'Your personalized career roadmap lives here. Click on any stage to see the subjects, skills, and projects you need to master. Complete stages to earn XP and level up!',
    tip: '📍 Start here to see your full learning path',
    emoji: '🗺️',
    position: 'right',
  },
  {
    targetId: 'nav-planner',
    title: 'Task List — Daily Tasks',
    description: 'Every day you get fresh tasks auto-generated from your roadmap. Complete them to build your streak and earn +25 XP per task. Use "Sync Roadmap" to get 5 unique tasks instantly.',
    tip: '✅ Complete tasks daily to build your streak',
    emoji: '📋',
    position: 'right',
  },
  {
    targetId: 'nav-resources',
    title: 'Study Center — Books, Videos & News',
    description: 'Access curated books, video lectures, and career news tailored to your current roadmap stage. Take AI-generated quizzes to test your knowledge and reinforce learning!',
    tip: '📚 Browse books, videos, and industry news',
    emoji: '📚',
    position: 'right',
  },
  {
    targetId: 'nav-mentor',
    title: 'AI Mentor — Ask Anything',
    description: 'Chat with your personal AI career mentor anytime. Ask about study plans, career advice, project ideas, or anything about becoming a professional in your field. Your history is saved!',
    tip: '🤖 Your mentor knows your dream and current stage',
    emoji: '🤖',
    position: 'right',
  },
  {
    targetId: 'user-profile-card',
    title: "You're Ready to Go! 🎉",
    description: 'Your profile, XP level, and streak are tracked here. Kalam Spark guides you step by step toward your career goal — complete stages, earn XP, and celebrate every milestone!',
    tip: '🚀 Complete stages to earn XP and level up!',
    emoji: '🏆',
    position: 'top',
  },
];

interface Rect {
  top: number; left: number; width: number; height: number;
}

interface AppTourProps {
  onComplete: () => void;
}

export default function AppTour({ onComplete }: AppTourProps) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const TW = 360;

  /* Measure the target element and update spotlight */
  useEffect(() => {
    setVisible(false);
    const measure = () => {
      const el = document.getElementById(current.targetId);
      if (el) {
        const r = el.getBoundingClientRect();
        setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setTargetRect(null);
      }
      setTimeout(() => setVisible(true), 100);
    };
    const t = setTimeout(measure, 80);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [step]);

  const handleNext = () => {
    if (isLast) {
      setVisible(false);
      setTimeout(onComplete, 250);
    } else {
      setVisible(false);
      setTimeout(() => setStep(s => s + 1), 160);
    }
  };

  const handleSkip = () => {
    setVisible(false);
    setTimeout(onComplete, 200);
  };

  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
    }
    const PAD = 18;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    switch (current.position) {
      case 'right': {
        const left = Math.min(targetRect.left + targetRect.width + PAD, viewW - TW - PAD);
        const top = Math.max(PAD, Math.min(targetRect.top + targetRect.height / 2 - 120, viewH - 340));
        return { position: 'fixed', top, left };
      }
      case 'left': {
        const left = Math.max(PAD, targetRect.left - TW - PAD);
        const top = Math.max(PAD, targetRect.top + targetRect.height / 2 - 120);
        return { position: 'fixed', top, left };
      }
      case 'bottom': {
        const top = Math.min(targetRect.top + targetRect.height + PAD, viewH - 320);
        const left = Math.max(PAD, Math.min(targetRect.left, viewW - TW - PAD));
        return { position: 'fixed', top, left };
      }
      case 'top': {
        const top = Math.max(PAD, targetRect.top - 320);
        const left = Math.max(PAD, Math.min(targetRect.left, viewW - TW - PAD));
        return { position: 'fixed', top, left };
      }
      default:
        return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
    }
  };

  const getArrow = () => {
    if (!targetRect || !tooltipRef.current || !visible) return null;
    const tr = tooltipRef.current.getBoundingClientRect();
    if (tr.width === 0) return null;

    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

    switch (current.position) {
      case 'right':
        x1 = tr.left; y1 = tr.top + tr.height / 2;
        x2 = targetRect.left + targetRect.width; y2 = targetRect.top + targetRect.height / 2;
        break;
      case 'left':
        x1 = tr.right; y1 = tr.top + tr.height / 2;
        x2 = targetRect.left; y2 = targetRect.top + targetRect.height / 2;
        break;
      case 'top':
        x1 = tr.left + tr.width / 2; y1 = tr.bottom;
        x2 = targetRect.left + targetRect.width / 2; y2 = targetRect.top;
        break;
      case 'bottom':
        x1 = tr.left + tr.width / 2; y1 = tr.top;
        x2 = targetRect.left + targetRect.width / 2; y2 = targetRect.bottom;
        break;
      default: return null;
    }

    const dx = x2 - x1, dy = y2 - y1;
    const cx1 = x1 + dx * 0.4, cy1 = y1;
    const cx2 = x2 - dx * 0.4, cy2 = y2;
    const pathD = `M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;

    return (
      <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 260 }}>
        <defs>
          <marker id="arrowhead-tour" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
          </marker>
        </defs>
        <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth="2.5"
          strokeDasharray="7 4" markerEnd="url(#arrowhead-tour)" opacity="0.85" />
      </svg>
    );
  };

  const tooltipStyle = getTooltipStyle();

  return (
    <>
      {/* Dark overlay with spotlight cutout */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 249, pointerEvents: 'none' }}>
        {targetRect && (
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={targetRect.left - 8} y={targetRect.top - 8}
                  width={targetRect.width + 16} height={targetRect.height + 16}
                  rx="12" fill="black"
                />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#spotlight-mask)" />
          </svg>
        )}

        {/* Glow ring around target */}
        {targetRect && (
          <div style={{
            position: 'fixed',
            top: targetRect.top - 8, left: targetRect.left - 8,
            width: targetRect.width + 16, height: targetRect.height + 16,
            borderRadius: 12,
            border: '2px solid rgba(139,92,246,0.9)',
            boxShadow: '0 0 0 4px rgba(139,92,246,0.15), 0 0 30px rgba(139,92,246,0.5)',
            pointerEvents: 'none',
            transition: 'all 0.3s ease',
            animation: 'pulse-glow-tour 1.5s ease-in-out infinite',
          }} />
        )}
      </div>

      {/* Click blocker */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 250, cursor: 'default' }}
        onClick={e => e.stopPropagation()} />

      {/* Curved arrow SVG */}
      {visible && getArrow()}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        style={{
          ...tooltipStyle,
          zIndex: 270,
          width: TW,
          opacity: visible ? 1 : 0,
          transform: visible
            ? (tooltipStyle.transform || 'scale(1) translateY(0)')
            : 'scale(0.88) translateY(10px)',
          transition: 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: 'all',
        }}
      >
        <div style={{
          background: 'linear-gradient(135deg, #0f0f1a 0%, #160a28 100%)',
          border: '1px solid rgba(139,92,246,0.4)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(139,92,246,0.1), 0 0 40px rgba(139,92,246,0.2), 0 24px 60px rgba(0,0,0,0.6)',
        }}>
          {/* Gradient top bar */}
          <div style={{ height: 3, background: 'linear-gradient(to right, #7c3aed, #db2777, #7c3aed)' }} />

          {/* Header */}
          <div style={{
            padding: '16px 20px 12px',
            background: 'linear-gradient(to bottom, rgba(139,92,246,0.08), transparent)',
            borderBottom: '1px solid rgba(139,92,246,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>{current.emoji}</div>
              <div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {TOUR_STEPS.map((_, i) => (
                    <div key={i} style={{
                      height: 4,
                      width: i === step ? 18 : 6,
                      borderRadius: 99,
                      background: i <= step ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
                      transition: 'width 0.3s ease, background 0.3s',
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, marginBottom: 0 }}>
                  Step {step + 1} of {TOUR_STEPS.length}
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: 'rgba(255,255,255,0.3)',
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                borderRadius: 8, transition: 'color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
            >
              <X size={11} /> Skip tour
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '16px 20px 14px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'white', margin: '0 0 8px', lineHeight: 1.3 }}>
              {current.title}
            </h3>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, margin: '0 0 12px' }}>
              {current.description}
            </p>

            <div style={{
              padding: '9px 12px',
              background: 'rgba(139,92,246,0.07)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Wand2 size={12} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <p style={{ fontSize: 11.5, color: '#a78bfa', fontWeight: 600, margin: 0 }}>
                {current.tip}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: '0 20px 18px', display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                onClick={() => { setVisible(false); setTimeout(() => setStep(s => s - 1), 160); }}
                style={{
                  padding: '10px 14px', borderRadius: 12, fontSize: 13,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = 'white';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                }}
              >←</button>
            )}
            <button
              onClick={handleNext}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                color: 'white', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: '0 4px 16px rgba(139,92,246,0.35)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(139,92,246,0.5)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(139,92,246,0.35)';
              }}
            >
              {isLast ? <><Check size={14} /> Let's Go!</> : <>Next Step <ArrowRight size={13} /></>}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-glow-tour {
          0%, 100% { box-shadow: 0 0 0 4px rgba(139,92,246,0.15), 0 0 20px rgba(139,92,246,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(139,92,246,0.2), 0 0 40px rgba(139,92,246,0.65); }
        }
      `}</style>
    </>
  );
}
