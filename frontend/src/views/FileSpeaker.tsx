import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, Link, FileText, MessageSquare, Zap, Headphones,
  ChevronRight, Loader2, Play, Pause, Download, X,
  BookOpen, Lightbulb, HelpCircle, Target, FlaskConical, BookMarked,
  Plus, Volume2, SkipBack, SkipForward, Send, Pencil, Mic,
  Globe, Library, Languages, Clock, Trash2
} from 'lucide-react';
import { UserProfile } from '../types';
import { getCurrentLang } from '../i18n';
import { summarizeWebpage, askDocumentRag, transformDocument, generateText } from '../services/geminiService';
import { networkService } from '../services/networkService';
import { llamaPlugin } from '../services/llamaPlugin';
import { Capacitor } from '@capacitor/core';

// On native mobile, the backend at 127.0.0.1:8000 is NOT reachable
const IS_NATIVE_MOBILE = Capacitor.isNativePlatform();

const getBackendUrl = () => {
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  return "http://localhost:8000";
};
const BACKEND = IS_NATIVE_MOBILE ? '' : getBackendUrl();

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
interface Source {
  source_id: string;
  title: string;
  char_count: number;
  chunk_count: number;
  preview: string;
  text?: string;
  addedAt: number;
  detectedLang?: string;
}
interface ChatMsg { role: 'user' | 'ai'; text: string; }
interface TransformResult { type: string; label: string; result: string; }

/** Saved podcast entry for the library */
interface PodcastRecord {
  id: string;
  sourceTitle: string;
  topic: string;
  host1: string;
  host2: string;
  language: string;
  languageName: string;
  audioFilename: string;
  durationEst: string;
  linesCount: number;
  createdAt: number;
  script: string;
  lines: { speaker: string; text: string }[];
}

/* --- Supported podcast languages --- */
const PODCAST_LANGUAGES = [
  { code: 'en', label: 'English',          flag: '🇺🇸' },
  { code: 'ta', label: 'Tamil',            flag: '🇮🇳' },
  { code: 'hi', label: 'Hindi',            flag: '🇮🇳' },
  { code: 'te', label: 'Telugu',           flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada',          flag: '🇮🇳' },
  { code: 'ml', label: 'Malayalam',        flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali',          flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi',          flag: '🇮🇳' },
  { code: 'es', label: 'Espanol',          flag: '🇪🇸' },
  { code: 'fr', label: 'Francais',         flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',          flag: '🇩🇪' },
  { code: 'zh', label: 'Chinese',          flag: '🇨🇳' },
  { code: 'ar', label: 'Arabic',           flag: '🇸🇦' },
  { code: 'ru', label: 'Russian',          flag: '🇷🇺' },
  { code: 'pt', label: 'Portugues',        flag: '🇵🇹' },
  { code: 'ja', label: 'Japanese',         flag: '🇯🇵' },
  { code: 'ko', label: 'Korean',           flag: '🇰🇷' },
  { code: 'it', label: 'Italiano',         flag: '🇮🇹' },
  { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'tr', label: 'Turkce',           flag: '🇹🇷' },
  { code: 'vi', label: 'Tieng Viet',       flag: '🇻🇳' },
];

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Voice presets per language Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
const LANGUAGE_VOICE_PRESETS: Record<string, { host1: string; host2: string; rec_lang: string }> = {
  en: { host1: 'en-US-ChristopherNeural', host2: 'en-US-JennyNeural',     rec_lang: 'en-US' },
  ta: { host1: 'ta-IN-ValluvarNeural',    host2: 'ta-IN-PallaviNeural',   rec_lang: 'ta-IN' },
  hi: { host1: 'hi-IN-MadhurNeural',      host2: 'hi-IN-SwaraNeural',     rec_lang: 'hi-IN' },
  te: { host1: 'te-IN-MohanNeural',       host2: 'te-IN-ShrutiNeural',    rec_lang: 'te-IN' },
  kn: { host1: 'kn-IN-GaganNeural',       host2: 'kn-IN-SapnaNeural',     rec_lang: 'kn-IN' },
  ml: { host1: 'ml-IN-MidhunNeural',      host2: 'ml-IN-SobhanaNeural',   rec_lang: 'ml-IN' },
  bn: { host1: 'bn-IN-BashkarNeural',     host2: 'bn-IN-TanishaaNeural',  rec_lang: 'bn-IN' },
  mr: { host1: 'mr-IN-ManoharNeural',     host2: 'mr-IN-AarohiNeural',    rec_lang: 'mr-IN' },
  es: { host1: 'es-ES-AlvaroNeural',      host2: 'es-ES-ElviraNeural',    rec_lang: 'es-ES' },
  fr: { host1: 'fr-FR-HenriNeural',       host2: 'fr-FR-DeniseNeural',    rec_lang: 'fr-FR' },
  de: { host1: 'de-DE-KillianNeural',     host2: 'de-DE-KatjaNeural',     rec_lang: 'de-DE' },
  zh: { host1: 'zh-CN-YunxiNeural',       host2: 'zh-CN-XiaoxiaoNeural',  rec_lang: 'zh-CN' },
  ar: { host1: 'ar-SA-HamedNeural',       host2: 'ar-SA-ZariyahNeural',   rec_lang: 'ar-SA' },
  ru: { host1: 'ru-RU-DmitryNeural',      host2: 'ru-RU-SvetlanaNeural',  rec_lang: 'ru-RU' },
  pt: { host1: 'pt-BR-AntonioNeural',     'host2': 'pt-BR-FranciscaNeural', rec_lang: 'pt-BR' },
  ja: { host1: 'ja-JP-KeitaNeural',       host2: 'ja-JP-NanamiNeural',    rec_lang: 'ja-JP' },
  ko: { host1: 'ko-KR-InJoonNeural',      host2: 'ko-KR-SunHiNeural',     rec_lang: 'ko-KR' },
  it: { host1: 'it-IT-DiegoNeural',       host2: 'it-IT-ElsaNeural',      rec_lang: 'it-IT' },
  id: { host1: 'id-ID-ArdiNeural',        host2: 'id-ID-GadisNeural',     rec_lang: 'id-ID' },
  tr: { host1: 'tr-TR-AhmetNeural',       host2: 'tr-TR-EmelNeural',      rec_lang: 'tr-TR' },
  vi: { host1: 'vi-VN-NamMinhNeural',     host2: 'vi-VN-HoaiMyNeural',    rec_lang: 'vi-VN' },
};

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Simple Markdown renderer: bold, italic, code, lists, headings, and citations Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function renderMarkdown(raw: string): React.ReactNode[] {
  return raw.split('\n').map((line, lineIdx) => {
    // Handle headings
    const h3Match = line.match(/^###\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) return <React.Fragment key={lineIdx}><strong className="block text-base font-bold text-white mt-2 mb-1">{h1Match[1]}</strong></React.Fragment>;
    if (h2Match) return <React.Fragment key={lineIdx}><strong className="block text-sm font-bold text-white/90 mt-1.5 mb-0.5">{h2Match[1]}</strong></React.Fragment>;
    if (h3Match) return <React.Fragment key={lineIdx}><strong className="block text-sm font-semibold text-white/80 mt-1">{h3Match[1]}</strong></React.Fragment>;

    // Handle bullet/list items
    const bulletMatch = line.match(/^[-*\u2022]\s+(.+)/);
    if (bulletMatch) {
      return (
        <React.Fragment key={lineIdx}>
          <span className="flex gap-2 my-0.5">
            <span className="text-gold-400 shrink-0 mt-0.5">&bull;</span>
            <span>{renderInline(bulletMatch[1])}</span>
          </span>
        </React.Fragment>
      );
    }

    // Handle numbered list items
    const numMatch = line.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      return (
        <React.Fragment key={lineIdx}>
          <span className="flex gap-2 my-0.5">
            <span className="text-gold-400/70 shrink-0 font-mono text-xs mt-0.5">{line.match(/^(\d+)\./)?.[1]}.</span>
            <span>{renderInline(numMatch[1])}</span>
          </span>
        </React.Fragment>
      );
    }

    return (
      <React.Fragment key={lineIdx}>
        {line.trim() === '' ? <br /> : <span className="block">{renderInline(line)}</span>}
      </React.Fragment>
    );
  });
}

function renderInline(text: string): React.ReactNode[] {
  // Split by markdown tokens: **bold**, *italic*, `code`, [Source:...], [Page N], bare URLs
  const parts: React.ReactNode[] = [];
  let rest = text;
  let keyCounter = 0;

  const tokenRe = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[Source:\s*(https?:\/\/[^\]]+)\]|\[Page\s*(\d+)\]|(?:https?:\/\/[^\s\]]+))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  
  while ((match = tokenRe.exec(rest)) !== null) {
    if (match.index > lastIdx) {
      parts.push(rest.slice(lastIdx, match.index));
    }
    
    const fullMatch = match[0];
    
    if (fullMatch.startsWith('***')) {
      // bold+italic
      parts.push(<strong key={keyCounter++} className="font-semibold italic text-white">{match[2]}</strong>);
    } else if (fullMatch.startsWith('**')) {
      // bold
      parts.push(<strong key={keyCounter++} className="font-semibold text-white">{match[3]}</strong>);
    } else if (fullMatch.startsWith('*')) {
      // italic
      parts.push(<em key={keyCounter++} className="italic text-white/90">{match[4]}</em>);
    } else if (fullMatch.startsWith('`')) {
      // code
      parts.push(
        <code key={keyCounter++} className="font-mono text-xs bg-white/10 text-violet-300 px-1.5 py-0.5 rounded">{match[5]}</code>
      );
    } else if (fullMatch.startsWith('[Source:')) {
      const url = match[6];
      parts.push(
        <a key={keyCounter++} href={url} target="_blank" rel="noreferrer" 
          className="inline-flex items-center gap-1 text-[10px] bg-violet-600/20 text-violet-300 hover:bg-violet-600/40 hover:text-white px-1.5 py-0.5 rounded-md ml-1 transition-all">
          <Link size={10} /> source
        </a>
      );
    } else if (fullMatch.startsWith('[Page')) {
      const pageNum = match[7];
      parts.push(
        <span key={keyCounter++} className="inline-flex items-center gap-1 text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-1.5 py-0.5 rounded-md ml-1 hover:bg-zinc-700 transition-all cursor-default" title={`Cited from Page ${pageNum}`}>
          <BookOpen size={10} /> p.{pageNum}
        </span>
      );
    } else if (fullMatch.startsWith('http')) {
      parts.push(
        <a key={keyCounter++} href={fullMatch} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
          {fullMatch}
        </a>
      );
    }

    lastIdx = match.index + fullMatch.length;
  }
  
  if (lastIdx < rest.length) parts.push(rest.slice(lastIdx));
  return parts;
}


const TRANSFORMATIONS = [
  { key: 'summary',      label: 'Summary',     icon: BookOpen,     desc: '250-word overview' },
  { key: 'key_concepts', label: 'Key Concepts', icon: Lightbulb,    desc: 'Main ideas & terms' },
  { key: 'takeaways',    label: 'Takeaways',   icon: Target,       desc: 'Actionable lessons' },
  { key: 'questions',    label: 'Questions',   icon: HelpCircle,   desc: 'Critical thinking Qs' },
  { key: 'flashcards',   label: 'Flashcards',  icon: BookMarked,   desc: 'Q&A pairs for studying' },
  { key: 'methodology',  label: 'Methodology', icon: FlaskConical, desc: 'Research approach' },
];

const SELECT_DARK  = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/50 cursor-pointer";
const SELECT_LIGHT = "w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:border-violet-500/50 cursor-pointer";

/* --- All available TTS voices grouped by language --- */
const VOICES = [
  // English
  { value: 'en-US-ChristopherNeural', label: '🇺🇸 Christopher (Male, US)' },
  { value: 'en-US-JennyNeural',       label: '🇺🇸 Jenny (Female, US)' },
  { value: 'en-GB-RyanNeural',        label: '🇬🇧 Ryan (Male, UK)' },
  { value: 'en-GB-SoniaNeural',       label: '🇬🇧 Sonia (Female, UK)' },
  { value: 'en-IN-NeerjaNeural',      label: '🇮🇳 Neerja (Female, IN)' },
  { value: 'en-IN-PrabhatNeural',     label: '🇮🇳 Prabhat (Male, IN)' },
  // Tamil
  { value: 'ta-IN-ValluvarNeural',    label: '🇮🇳 Valluvar (Male, Tamil)' },
  { value: 'ta-IN-PallaviNeural',     label: '🇮🇳 Pallavi (Female, Tamil)' },
  // Hindi
  { value: 'hi-IN-MadhurNeural',      label: '🇮🇳 Madhur (Male, Hindi)' },
  { value: 'hi-IN-SwaraNeural',       label: '🇮🇳 Swara (Female, Hindi)' },
  // Telugu
  { value: 'te-IN-MohanNeural',       label: '🇮🇳 Mohan (Male, Telugu)' },
  { value: 'te-IN-ShrutiNeural',      label: '🇮🇳 Shruti (Female, Telugu)' },
  // Kannada
  { value: 'kn-IN-GaganNeural',       label: '🇮🇳 Gagan (Male, Kannada)' },
  { value: 'kn-IN-SapnaNeural',       label: '🇮🇳 Sapna (Female, Kannada)' },
  // Malayalam
  { value: 'ml-IN-MidhunNeural',      label: '🇮🇳 Midhun (Male, Malayalam)' },
  { value: 'ml-IN-SobhanaNeural',     label: '🇮🇳 Sobhana (Female, Malayalam)' },
  // Bengali
  { value: 'bn-IN-BashkarNeural',     label: '🇮🇳 Bashkar (Male, Bengali)' },
  { value: 'bn-IN-TanishaaNeural',    label: '🇮🇳 Tanishaa (Female, Bengali)' },
  // Marathi
  { value: 'mr-IN-ManoharNeural',     label: '🇮🇳 Manohar (Male, Marathi)' },
  { value: 'mr-IN-AarohiNeural',      label: '🇮🇳 Aarohi (Female, Marathi)' },
];

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Audio Player with seek bar, skip ±10s Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
/* On mobile: uses Web Speech API (speechSynthesis) since there is no server audio.
   On desktop: uses HTML <audio> element with the server URL.              */
/* --- Lightweight TTS player for podcast library items (mobile only) --- */
function LibraryTTSPlayer({ lines, podcastLang, host1, host2, durationEst, user }: {
  lines: { speaker: string; text: string }[];
  podcastLang: string;
  host1: string;
  host2: string;
  durationEst: string;
  user: UserProfile;
}) {
  const [playing, setPlaying] = React.useState(false);
  const [lineIdx, setLineIdx] = React.useState(0);
  const activeRef = React.useRef(false);

  const playFrom = (startIdx: number) => {
    window.speechSynthesis.cancel();
    activeRef.current = true;
    setPlaying(true);
    let consecutiveErrors = 0;
    const langMap: Record<string, string> = {
      en: 'en-US', ta: 'ta-IN', hi: 'hi-IN', te: 'te-IN',
      kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', mr: 'mr-IN',
      es: 'es-ES', fr: 'fr-FR', de: 'de-DE', zh: 'zh-CN',
      ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA', ru: 'ru-RU',
      pt: 'pt-BR', it: 'it-IT', id: 'id-ID', tr: 'tr-TR', vi: 'vi-VN',
    };
    const lang = langMap[podcastLang] || 'en-US';
    const speak = (idx: number) => {
      if (!activeRef.current || idx >= lines.length) {
        setPlaying(false); setLineIdx(0); activeRef.current = false; return;
      }
      setLineIdx(idx);
      const utt = new SpeechSynthesisUtterance(lines[idx].text);
      utt.lang = lang;
      const voices = window.speechSynthesis.getVoices();
      const lv = voices.filter(v => v.lang.startsWith(lang.split('-')[0]));
      const isH1 = lines[idx].speaker === host1;
      if (lv.length >= 2) utt.voice = lv[isH1 ? 0 : 1];
      else if (lv.length === 1) utt.voice = lv[0];
      utt.pitch = isH1 ? 0.9 : 1.15;
      utt.rate = isH1 ? 0.95 : 1.0;
      utt.onend = () => {
        consecutiveErrors = 0;
        speak(idx + 1);
      };
      utt.onerror = (e) => {
        console.warn('[LibraryTTSPlayer] TTS voice error, retrying with default voice:', e);
        if (utt.voice) {
          const fallback = new SpeechSynthesisUtterance(lines[idx].text);
          fallback.lang = utt.lang;
          fallback.pitch = utt.pitch;
          fallback.rate = utt.rate;
          fallback.onend = () => {
            consecutiveErrors = 0;
            speak(idx + 1);
          };
          fallback.onerror = () => {
            consecutiveErrors++;
            if (consecutiveErrors >= 3) {
              alert("Speech Synthesis (Read Aloud) failed. Please check if your system volume is turned up, an audio output device is connected, and Speech/TTS voices are installed in your OS settings.");
              pause();
            } else {
              speak(idx + 1);
            }
          };
          window.speechSynthesis.speak(fallback);
        } else {
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            alert("Speech Synthesis (Read Aloud) failed. Please check if your system volume is turned up, an audio output device is connected, and Speech/TTS voices are installed in your OS settings.");
            pause();
          } else {
            speak(idx + 1);
          }
        }
      };
      window.speechSynthesis.speak(utt);
    };
    const voicesNow = window.speechSynthesis.getVoices();
    if (voicesNow.length > 0) { speak(startIdx); }
    else {
      let started = false;
      const go = () => { if (started) return; started = true; speak(startIdx); };
      window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; go(); };
      setTimeout(go, 600);
    }
  };

  const pause = () => { window.speechSynthesis.cancel(); activeRef.current = false; setPlaying(false); };
  const toggle = () => { if (playing) pause(); else playFrom(lineIdx); };
  const restart = () => { pause(); setLineIdx(0); };

  const pct = lines.length > 0 ? (lineIdx / lines.length) * 100 : 0;
  const isLight = user.settings?.theme === 'light';

  return (
    <div className="space-y-2">
      <div className="relative w-full h-1.5 bg-zinc-700/50 rounded-full mt-3">
        <div className="absolute top-0 left-0 h-full bg-violet-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>Line {playing ? lineIdx + 1 : lineIdx} / {lines.length}</span>
        <span>{durationEst}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={restart} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all" title="Restart">
          <SkipBack size={14} />
        </button>
        <button onClick={toggle} className="w-9 h-9 bg-violet-600 hover:bg-violet-500 rounded-full flex items-center justify-center transition-all shadow-md shadow-violet-900/30">
          {playing ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-zinc-300 truncate">{host1} &amp; {host2}</p>
          <p className="text-[10px] text-zinc-600">{lines.length} exchanges &middot; TTS</p>
        </div>
      </div>
      {lines[lineIdx] && playing && (
        <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <p className="text-[9px] font-bold text-violet-400 mb-0.5">{lines[lineIdx].speaker}</p>
          <p className="text-[11px] text-zinc-300 leading-relaxed">{lines[lineIdx].text}</p>
        </div>
      )}
    </div>
  );
}

function LibraryAudioPlayer({ audioFilename }: { audioFilename: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLoadAndPlay = async () => {
    if (blobUrl || loading) return;
    setLoading(true);
    try {
      const url = `${BACKEND}/api/filespeaker/audio/${audioFilename}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Load failed");
      const blob = await res.blob();
      setBlobUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("Failed to load audio inline", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  return (
    <div className="flex-1 flex items-center gap-2" onClick={handleLoadAndPlay}>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
          <Loader2 size={12} className="animate-spin text-violet-500" />
          <span>Loading audio inline...</span>
        </div>
      ) : (
        <audio
          src={blobUrl || undefined}
          controls
          preload="none"
          className="flex-1 h-8"
          style={{ minWidth: 0 }}
          onPlay={handleLoadAndPlay}
        />
      )}
    </div>
  );
}

function AudioPlayer({ src, host1, host2, linesCount, durationEst, downloadUrl, audioRef, user, lines, podcastLang }: { 
  src: string; 
  host1: string; 
  host2: string; 
  linesCount: number; 
  durationEst: string; 
  downloadUrl: string; 
  audioRef: React.RefObject<HTMLAudioElement>; 
  user: UserProfile;
  lines?: { speaker: string; text: string }[];
  podcastLang?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloading) return;

    const filename = `podcast_${linesCount}_lines.mp3`;
    
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    setDownloading(true);
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      alert(`Download failed: ${err.message || err}`);
    } finally {
      setDownloading(false);
    }
  };

  // TTS state for mobile
  const [ttsLineIdx, setTtsLineIdx] = useState(0);
  const ttsActiveRef = useRef(false);

  // --- MOBILE MODE: Web Speech API playback ---
  const playTTS = (startIdx = 0) => {
    if (!IS_NATIVE_MOBILE || !lines || lines.length === 0) return;
    window.speechSynthesis.cancel();
    ttsActiveRef.current = true;
    setPlaying(true);
    let consecutiveErrors = 0;

    const speakLine = (idx: number) => {
      if (!ttsActiveRef.current || idx >= lines.length) {
        setPlaying(false);
        setTtsLineIdx(0);
        ttsActiveRef.current = false;
        return;
      }
      setTtsLineIdx(idx);
      const line = lines[idx];
      const utt = new SpeechSynthesisUtterance(line.text);
      const langCode = podcastLang || 'en';
      const langMap: Record<string, string> = {
        en: 'en-US', ta: 'ta-IN', hi: 'hi-IN', te: 'te-IN',
        kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', mr: 'mr-IN',
        es: 'es-ES', fr: 'fr-FR', de: 'de-DE', zh: 'zh-CN',
        ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA', ru: 'ru-RU',
        pt: 'pt-BR', it: 'it-IT', id: 'id-ID', tr: 'tr-TR', vi: 'vi-VN',
      };
      utt.lang = langMap[langCode] || 'en-US';

      // Load voices —  may be empty on first call; retry after voiceschanged
      const assignVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const langVoices = voices.filter(v => v.lang.startsWith(utt.lang.split('-')[0]));
        const isHost1 = line.speaker === host1;
        if (langVoices.length >= 2) utt.voice = langVoices[isHost1 ? 0 : 1];
        else if (langVoices.length === 1) utt.voice = langVoices[0];
        utt.pitch = isHost1 ? 0.9 : 1.15;
        utt.rate = (isHost1 ? 0.95 : 1.0) * speed;
        utt.onend = () => {
          consecutiveErrors = 0;
          speakLine(idx + 1);
        };
        utt.onerror = (e) => {
          console.warn('[AudioPlayer TTS] TTS voice error, retrying with default voice:', e);
          if (utt.voice) {
            const fallback = new SpeechSynthesisUtterance(line.text);
            fallback.lang = utt.lang;
            fallback.pitch = utt.pitch;
            fallback.rate = utt.rate;
            fallback.onend = () => {
              consecutiveErrors = 0;
              speakLine(idx + 1);
            };
            fallback.onerror = () => {
              consecutiveErrors++;
              if (consecutiveErrors >= 3) {
                alert("Speech Synthesis (Read Aloud) failed. Please check if your system volume is turned up, an audio output device is connected, and Speech/TTS voices are installed in your OS settings.");
                pauseTTS();
              } else {
                speakLine(idx + 1);
              }
            };
            window.speechSynthesis.speak(fallback);
          } else {
            consecutiveErrors++;
            if (consecutiveErrors >= 3) {
              alert("Speech Synthesis (Read Aloud) failed. Please check if your system volume is turned up, an audio output device is connected, and Speech/TTS voices are installed in your OS settings.");
              pauseTTS();
            } else {
              speakLine(idx + 1);
            }
          }
        };
        window.speechSynthesis.speak(utt);
      };

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        assignVoice();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          assignVoice();
        };
        // Fallback: speak without a specific voice after 500ms
        setTimeout(() => {
          if (!window.speechSynthesis.speaking) assignVoice();
        }, 500);
      }
    };

    speakLine(startIdx);
  };

  const pauseTTS = () => {
    window.speechSynthesis.cancel();
    ttsActiveRef.current = false;
    setPlaying(false);
  };

  const toggleTTS = () => {
    if (playing) {
      pauseTTS();
    } else {
      playTTS(ttsLineIdx);
    }
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬ DESKTOP MODE: HTML Audio element Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  useEffect(() => {
    if (IS_NATIVE_MOBILE) return; // skip audio fetch on mobile
    let active = true;
    fetch(src)
      .then(res => res.blob())
      .then(blob => {
        if (active) setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(e => console.error("Failed to load audio for scrubbing", e));
    return () => {
      active = false;
    };
  }, [src]);

  useEffect(() => {
    if (IS_NATIVE_MOBILE) return;
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    if (IS_NATIVE_MOBILE) return;
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (!isDragging) setCurrent(el.currentTime);
    };
    const onMeta = () => setDuration(el.duration || 0);
    const onDurChange = () => setDuration(el.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => setPlaying(false);

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onDurChange);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onDurChange);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnd);
    };
  }, [audioRef, isDragging]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play();
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (!IS_NATIVE_MOBILE && audioRef.current) audioRef.current.playbackRate = s;
    setShowSpeedMenu(false);
  };

  const seek = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.currentTime + delta, el.duration || 0));
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  const handleScrub = (clientX: number) => {
    if (!progressBarRef.current || !audioRef.current || !isFinite(audioRef.current.duration)) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = ratio * audioRef.current.duration;
    setCurrent(newTime); // immediate UI feedback
    if (!isDragging) audioRef.current.currentTime = newTime;
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleScrub(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleScrub(e.touches[0].clientX);
    const onUp = () => {
      if (audioRef.current) audioRef.current.currentTime = current;
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDragging, current, audioRef]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ MOBILE MODE render Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  if (IS_NATIVE_MOBILE) {
    const totalLines = lines?.length || linesCount;
    const progressPct = totalLines > 0 ? (ttsLineIdx / totalLines) * 100 : 0;
    return (
      <div className="space-y-3">
        {/* TTS progress bar */}
        <div className="relative w-full h-2 bg-zinc-700/50 rounded-full mt-4">
          <div className="absolute top-0 left-0 h-full bg-violet-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>Line {playing ? ttsLineIdx + 1 : ttsLineIdx} / {totalLines}</span>
          <span>{durationEst}</span>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { pauseTTS(); setTtsLineIdx(0); }}
            title="Restart"
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={toggleTTS}
            className="w-12 h-12 bg-violet-600 hover:bg-violet-500 rounded-full flex items-center justify-center transition-all shadow-lg shadow-violet-900/40"
          >
            {playing ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white ml-0.5" />}
          </button>
          <button
            onClick={() => { if (lines && ttsLineIdx + 10 < lines.length) { pauseTTS(); playTTS(ttsLineIdx + 10); } }}
            title="Skip forward 10 lines"
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
          >
            <SkipForward size={16} />
          </button>
          <div className="flex-1">
            <p className="text-xs font-semibold text-zinc-300">{host1} &amp; {host2}</p>
            <p className="text-[10px] text-zinc-600">{linesCount} exchanges &middot; TTS</p>
          </div>
          {/* Speed */}
          <div className="relative">
            {showSpeedMenu && (
              <div className={`absolute bottom-full right-0 mb-3 backdrop-blur-2xl border rounded-2xl p-2 shadow-xl z-[100]
                ${user.settings?.theme === 'light' ? 'bg-white/95 border-black/5' : 'bg-zinc-950/95 border-white/10'}`}>
                <p className="text-[9px] uppercase tracking-[0.15em] font-bold px-2 py-1 mb-2 border-b text-zinc-500 border-white/5">Speed</p>
                <div className="flex flex-row items-center gap-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                    <button key={s} onClick={() => changeSpeed(s)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                        speed === s ? 'bg-violet-600/20 text-violet-600 border-violet-500/30' : 'text-zinc-400 hover:bg-white/5 border-transparent'
                      }`}>
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
              <Zap size={13} />
              <span className="text-[11px] font-black tracking-tighter">{speed}x</span>
            </button>
          </div>
        </div>
        {/* Current line display */}
        {lines && lines[ttsLineIdx] && (
          <div className="mt-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <p className="text-[10px] font-bold text-violet-400 mb-1">{lines[ttsLineIdx].speaker}</p>
            <p className="text-xs text-zinc-300 leading-relaxed">{lines[ttsLineIdx].text}</p>
          </div>
        )}
      </div>
    );
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ DESKTOP MODE render Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  return (
    <div className="space-y-3">
      <audio ref={audioRef} src={blobUrl || src} preload="metadata" />
      
      {/* Progress bar */}
      <div 
        ref={progressBarRef}
        className="group relative w-full h-2 bg-zinc-700/50 rounded-full cursor-pointer mt-4"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleScrub(e.clientX);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          handleScrub(e.touches[0].clientX);
        }}
      >
        <div 
          className={`absolute top-0 left-0 h-full bg-violet-500 rounded-full ${!isDragging ? 'transition-all duration-100' : ''}`} 
          style={{ width: `${pct}%` }} 
        />
        <div 
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(124,58,237,0.6)] border-2 border-violet-500 z-10 transition-transform group-hover:scale-110 ${!isDragging ? 'transition-all duration-100' : ''}`} 
          style={{ left: `calc(${pct}% - 8px)` }} 
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>{fmt(current)}</span>
        <span>{duration > 0 ? fmt(duration) : durationEst}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => seek(-10)} 
          title="Skip back 10s"
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
        >
          <SkipBack size={16} />
        </button>
        
        <button 
          onClick={toggle}
          className="w-12 h-12 bg-violet-600 hover:bg-violet-500 rounded-full flex items-center justify-center transition-all shadow-lg shadow-violet-900/40"
        >
          {playing ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white ml-0.5" />}
        </button>

        <button 
          onClick={() => seek(10)} 
          title="Skip forward 10s"
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
        >
          <SkipForward size={16} />
        </button>

        <div className="flex-1">
          <p className="text-xs font-semibold text-zinc-300">{host1} &amp; {host2}</p>
          <p className="text-[10px] text-zinc-600">{linesCount} exchanges</p>
        </div>

        {/* Playback Speed */}
        <div className="relative">
          {showSpeedMenu && (
            <div 
              className={`absolute bottom-full right-0 mb-3 backdrop-blur-2xl border rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.4)] z-[100] animate-[slideUp_0.2s_ease-out_forwards]
                ${user.settings?.theme === 'light' 
                  ? 'bg-white/95 border-black/5' 
                  : 'bg-zinc-950/95 border-white/10'
                }`}
            >
              <p className={`text-[9px] uppercase tracking-[0.15em] font-bold px-2 py-1 mb-2 border-b
                ${user.settings?.theme === 'light' ? 'text-zinc-400 border-black/5' : 'text-zinc-500 border-white/5'}`}>
                Speed
              </p>
              <div className="flex flex-row items-center gap-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(s => (
                  <button
                    key={s}
                    onClick={() => changeSpeed(s)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 border ${
                      speed === s 
                      ? 'bg-violet-600/20 text-violet-600 border-violet-500/30' 
                      : user.settings?.theme === 'light'
                        ? 'text-zinc-500 hover:bg-black/5 hover:text-zinc-800 border-transparent'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-white border-transparent'
                    }`}
                  >
                    <span>{s}x</span>
                    {speed === s && <div className="w-1 h-1 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.8)]" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button 
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all border ${
              showSpeedMenu 
                ? 'bg-violet-600/20 border-violet-500/30 text-violet-400' 
                : user.settings?.theme === 'light'
                  ? 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  : 'bg-zinc-800/80 border-white/10 text-zinc-300 hover:bg-zinc-700/80 hover:border-white/20'
            }`}
          >
            <Zap size={13} className={speed !== 1 ? 'text-violet-600 fill-violet-600/20 animate-pulse' : ''} />
            <span className="text-[11px] font-black tracking-tighter">{speed}x</span>
          </button>
        </div>

        <button 
          onClick={handleDownload}
          disabled={downloading}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center cursor-pointer" 
          title="Download MP3"
        >
          {downloading ? <Loader2 size={15} className="animate-spin text-violet-400" /> : <Download size={15} />}
        </button>
      </div>
    </div>
  );
}

/* Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬ Per-source chat/transform/podcast state Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬ */
interface SourceState {
  chat: ChatMsg[];
  transforms: TransformResult[];
  podcast: any;
}

/* --- Helper: retrieve relevant context chunks for client-side RAG --- */
function retrieveRelevantContext(question: string, fullText: string, maxChars: number = 8000): string {
  if (!fullText || fullText.length <= maxChars) return fullText || '';

  const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim().length > 20);
  
  let chunks: string[] = [];
  paragraphs.forEach(p => {
    if (p.length > 1500) {
      let start = 0;
      while (start < p.length) {
        chunks.push(p.substring(start, start + 1000));
        start += 800;
      }
    } else {
      chunks.push(p);
    }
  });

  const words = question.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the', 'and', 'for', 'you', 'with', 'that', 'this', 'from', 'what', 'how', 'why', 'who'].includes(w));

  if (words.length === 0) {
    return fullText.substring(0, maxChars);
  }

  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    words.forEach(word => {
      let index = chunkLower.indexOf(word);
      while (index !== -1) {
        score++;
        index = chunkLower.indexOf(word, index + 1);
      }
    });
    return { chunk, score };
  });

  scoredChunks.sort((a, b) => b.score - a.score);

  let selectedText = '';
  for (const item of scoredChunks) {
    if (selectedText.length + item.chunk.length > maxChars) {
      if (selectedText.length === 0) {
        selectedText = item.chunk.substring(0, maxChars);
      }
      break;
    }
    selectedText += (selectedText ? '\n\n' : '') + item.chunk;
  }

  return selectedText || fullText.substring(0, maxChars);
}

/* Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬ FileSpeaker Main Component Ã¢â€ â‚¬Ã¢â€ â‚¬Ã¢â€ â‚¬ */
export default function FileSpeaker({ user, setUser, isLight }: { user: UserProfile; setUser: (u: UserProfile) => void; isLight: boolean }) {
  const SELECT_CLS = isLight ? SELECT_LIGHT : SELECT_DARK;
  const [sources, setSources] = useState<Source[]>(() => {
    if (user.fileSpeakerData?.sources?.length) return user.fileSpeakerData.sources;
    try { return JSON.parse(localStorage.getItem('fs_sources') || '[]'); } catch { return []; } 
  });
  const [activeSourceId, setActiveSourceId] = useState<string | null>(() => {
    return user.fileSpeakerData?.activeId || localStorage.getItem('fs_active_id') || null;
  });
  const [sourceStates, setSourceStates] = useState<Record<string, SourceState>>(() => {
    if (user.fileSpeakerData?.states && Object.keys(user.fileSpeakerData.states).length) return user.fileSpeakerData.states;
    try { return JSON.parse(localStorage.getItem('fs_states') || '{}'); } catch { return {}; } 
  });
  // Do not persist checked sources so we start with a clean slate each time
  const [checkedSources, setCheckedSources] = useState<string[]>([]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Sync internal FileSpeaker state to global UserProfile (for Supabase sync) Ã¢â€â‚¬Ã¢â€â‚¬
  useEffect(() => {
    const freshData = { sources, activeId: activeSourceId, states: sourceStates };
    if (JSON.stringify(user.fileSpeakerData) !== JSON.stringify(freshData)) {
      setUser((prev: any) => ({ ...prev, fileSpeakerData: freshData }));
    }
  }, [sources, activeSourceId, sourceStates]);

  // Keep localStorage as a local secondary backup
  useEffect(() => { localStorage.setItem('fs_sources', JSON.stringify(sources)); }, [sources]);
  useEffect(() => { localStorage.setItem('fs_active_id', activeSourceId || ''); }, [activeSourceId]);
  useEffect(() => { localStorage.setItem('fs_states', JSON.stringify(sourceStates)); }, [sourceStates]);

  const [addMode, setAddMode] = useState<'file' | 'url' | 'text' | null>(null);
  const [urlInput, setUrlInput]   = useState('');
  const [deepCrawl, setDeepCrawl] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [chatInput, setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [transforming, setTransforming] = useState<string | null>(null);

  const [podcastTopic, setPodcastTopic] = useState('');
  const [host1Name, setHost1Name]       = useState('Alex');
  const [host2Name, setHost2Name]       = useState('Sam');
  const [host1Voice, setHost1Voice]     = useState('en-US-ChristopherNeural');
  const [host2Voice, setHost2Voice]     = useState('en-US-JennyNeural');
  const [podcastTone, setPodcastTone]   = useState('educational and engaging');
  const [podcastLength, setPodcastLength] = useState('medium');
  // BUG FIX 4 (new): Track selected podcast language separately from app UI language
  const [podcastLang, setPodcastLang]   = useState(() => getCurrentLang() || 'en');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [langSearchQuery, setLangSearchQuery] = useState('');
  const [host1VoiceOpen, setHost1VoiceOpen] = useState(false);
  const [host2VoiceOpen, setHost2VoiceOpen] = useState(false);
  const [podcastToneOpen, setPodcastToneOpen] = useState(false);
  const [podcastLengthOpen, setPodcastLengthOpen] = useState(false);
  const [detectingLang, setDetectingLang] = useState(false);
  const [detectedLangInfo, setDetectedLangInfo] = useState<string | null>(null);
  const [generatingPodcast, setGeneratingPodcast] = useState(false);
  const podcastAudioRef = useRef<HTMLAudioElement>(null);
  // BUG FIX 5+8: Use MutableRefObject with type Audio (not HTMLAudioElement) since we
  // assign a raw `new Audio()` object, not a DOM ref. This fixes the type mismatch.
  const interactionAudioRef = useRef<InstanceType<typeof Audio> | null>(null);
  const [isListeningPodcast, setIsListeningPodcast] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Podcast library: persisted list of all generated podcasts
  const [podcastLibrary, setPodcastLibrary] = useState<PodcastRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('fs_podcast_library') || '[]'); } catch { return []; }
  });
  const [showLibrary, setShowLibrary] = useState(false);
  useEffect(() => { localStorage.setItem('fs_podcast_library', JSON.stringify(podcastLibrary)); }, [podcastLibrary]);

  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});

  const downloadPodcastFromLibrary = async (recId: string, filename: string, audioFilename: string) => {
    if (downloadingIds[recId]) return;
    setDownloadingIds(prev => ({ ...prev, [recId]: true }));
    try {
      const url = `${BACKEND}/api/filespeaker/audio/${audioFilename}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      alert(`Download failed: ${err.message || err}`);
    } finally {
      setDownloadingIds(prev => {
        const next = { ...prev };
        delete next[recId];
        return next;
      });
    }
  };

  const [sourceTab, setSourceTab] = useState<'chat' | 'transform' | 'podcast'>('chat');

  /* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
  const activeSource = sources.find(s => s.source_id === activeSourceId) ?? null;
  const getState = (id: string): SourceState =>
    sourceStates[id] ?? { chat: [], transforms: [], podcast: null };
  const patchState = (id: string, patch: Partial<SourceState>) =>
    setSourceStates(prev => ({ ...prev, [id]: { ...getState(id), ...patch } }));

  /* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Switch source — Fix 5: each source keeps its own history Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
  const switchSource = (src: Source) => {
    setActiveSourceId(src.source_id);
    // initialise state slot if new
    setSourceStates(prev => ({
      ...prev,
      [src.source_id]: prev[src.source_id] ?? { chat: [], transforms: [], podcast: null },
    }));
  };

  /* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Helper: register new source and switch to it (Fix 5) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
  const registerSource = (src: Source) => {
    // Check for exact source_id match to prevent strict duplicates, but allow duplicate titles (e.g. books.google.com)
    setSources(prev => {
      const exists = prev.some(s => s.source_id === src.source_id);
      if (exists) return prev;
      return [src, ...prev];
    });
    switchSource(src);
    setAddMode(null);
  };

  /* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Upload File (client-side extraction, no backend needed on mobile) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      // Ã¢â€â‚¬Ã¢â€â‚¬ Try backend first (desktop only) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
      if (!IS_NATIVE_MOBILE && BACKEND) {
        try {
          const form = new FormData();
          form.append('file', file);
          const res = await fetch(`${BACKEND}/api/filespeaker/upload`, { method: 'POST', body: form });
          if (res.ok) {
            const data = await res.json();
            if (data.source_id) {
              registerSource({ ...data, text: data.preview, addedAt: Date.now() });
              setUploading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('[FileSpeaker] Backend upload failed, falling back to client-side...', e);
        }
      }

      // Ã¢â€â‚¬Ã¢â€â‚¬ Client-side extraction (works on mobile + desktop fallback) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
      let text = '';
      const fileNameLower = file.name.toLowerCase();

      if (fileNameLower.endsWith('.pdf')) {
        // Use PDF.js from CDN for PDF text extraction
        try {
          const arrayBuffer = await file.arrayBuffer();
          // Dynamically load PDF.js
          if (!(window as any).pdfjsLib) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
              script.onload = () => resolve();
              script.onerror = reject;
              document.head.appendChild(script);
            });
            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }
          const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const pages: string[] = [];
          const maxPages = Math.min(pdf.numPages, 50); // Limit to 50 pages
          for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map((item: any) => item.str).join(' ');
            if (pageText.trim()) pages.push(`[Page ${i}]\n${pageText}`);
          }
          text = pages.join('\n\n');
          if (!text.trim()) text = `[PDF: ${file.name} —  could not extract text. Try pasting text directly.]`;
        } catch (pdfErr) {
          console.warn('[FileSpeaker] PDF.js extraction failed:', pdfErr);
          text = `[PDF: ${file.name} —  ${file.size} bytes. Text extraction failed. Paste the text manually.]`;
        }
      } else if (
        fileNameLower.endsWith('.txt') ||
        fileNameLower.endsWith('.md') ||
        fileNameLower.endsWith('.csv') ||
        fileNameLower.endsWith('.json') ||
        fileNameLower.endsWith('.html') ||
        fileNameLower.endsWith('.xml')
      ) {
        // Plain text files —  read directly
        text = await file.text();
      } else if (fileNameLower.endsWith('.docx')) {
        // Basic DOCX —  read as text (imperfect but better than nothing)
        text = await file.text().catch(() => `[DOCX: ${file.name}. For best results, copy-paste the text using the Text tab.]`);
      } else {
        // Other files —  try reading as text
        text = await file.text().catch(() => `[Binary file: ${file.name}. For best results, paste the text manually.]`);
      }

      if (!text.trim()) {
        text = `[File: ${file.name} —  no readable text found. Use the Text tab to paste content directly.]`;
      }

      // Limit text length to avoid memory issues on mobile
      const MAX_CHARS = 50000;
      const truncated = text.length > MAX_CHARS;
      const finalText = truncated ? text.substring(0, MAX_CHARS) + `\n\n[Truncated: showing first ${MAX_CHARS} characters of ${text.length} total]` : text;

      const source: Source = {
        source_id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: file.name.replace(/\.[^.]+$/, ''), // Remove extension for title
        char_count: finalText.length,
        chunk_count: Math.ceil(finalText.length / 1000),
        preview: finalText.substring(0, 250) + (finalText.length > 250 ? '...' : ''),
        text: finalText,
        addedAt: Date.now(),
        detectedLang: 'en',
      };
      registerSource(source);
    } catch (e: any) {
      alert(`Upload failed: ${e.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }, []);

  /* ─── Add URL (mobile: Gemini-powered extraction, desktop: backend first) ─── */
  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    setUploading(true);
    try {
      await networkService.ready();
      const isOnline = networkService.isOnline();

      // Desktop: try backend first for full crawl4ai extraction
      if (!IS_NATIVE_MOBILE && BACKEND && isOnline) {
        try {
          const res = await fetch(`${BACKEND}/api/filespeaker/url`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlInput.trim(), deep: deepCrawl }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.source_id) {
              registerSource({ ...data, text: data.preview, addedAt: Date.now() });
              setUrlInput('');
              setUploading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('[FileSpeaker] Backend URL extraction failed, trying Gemini...', e);
        }
      }

      // Mobile + desktop fallback: use central summarizeWebpage to summarize/extract from the URL
      let urlContent = '';
      if (isOnline) {
        try {
          // allorigins.win is a reliable CORS proxy for mobile
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput.trim())}`;
          const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
          const proxyData = await resp.json();
          urlContent = proxyData.contents?.substring(0, 8000) || '';
        } catch (_) {
          urlContent = ''; // Proxy failed, use own knowledge
        }
      }

      const extractedText = await summarizeWebpage(urlInput.trim(), urlContent);
      if (extractedText.trim()) {
        const title = urlInput.trim().replace(/https?:\/\//, '').split('/')[0];
        const source: Source = {
          source_id: `url_${Date.now()}`,
          title,
          char_count: extractedText.length,
          chunk_count: Math.ceil(extractedText.length / 1000),
          preview: extractedText.substring(0, 250) + '...',
          text: extractedText,
          addedAt: Date.now(),
          detectedLang: 'en',
        };
        registerSource(source);
        setUrlInput('');
        setUploading(false);
        return;
      }

      throw new Error('Could not extract URL content. Please paste the text manually using the Text tab.');
    } catch (e: any) {
      alert(`Failed to add URL: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  /* ─── Add Text ─── */
  const handleAddText = async () => {
    if (!textInput.trim()) return;
    setUploading(true);
    try {
      const title = textTitle.trim() || 'Pasted Text';
      const text = textInput.trim();
      const isOnline = networkService.isOnline();

      // Desktop + online: try backend first
      if (!IS_NATIVE_MOBILE && BACKEND && isOnline) {
        try {
          const res = await fetch(`${BACKEND}/api/filespeaker/text`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, title }),
          });
          if (res.ok) {
            const data = await res.json();
            registerSource({ ...data, text, addedAt: Date.now() });
            setTextInput(''); setTextTitle('');
            setUploading(false);
            return;
          }
        } catch (e) {
          console.warn('[FileSpeaker] Backend failed to save text, saving locally...', e);
        }
      }

      // Mobile or offline fallback: save locally
      const localSource: Source = {
        source_id: `src_${Date.now()}`,
        title,
        char_count: text.length,
        chunk_count: Math.ceil(text.length / 1000),
        preview: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        text,
        addedAt: Date.now(),
        detectedLang: 'en'
      };
      registerSource(localSource);
      setTextInput(''); setTextTitle('');
    } catch (e: any) { alert(`Failed to add text: ${e.message}`); }
    finally { setUploading(false); }
  };

  /* ─── Chat ─── */
  const handleChat = async () => {
    if (!chatInput.trim() || !activeSource || chatLoading) return;
    const q = chatInput.trim();
    setChatInput('');
    const sid = activeSource.source_id;
    const sids = checkedSources.includes(sid) ? checkedSources : [sid, ...checkedSources];
    const titles = sids.map(id => sources.find(s => s.source_id === id)?.title || '');
    
    const prev = getState(sid);
    const userMsg: ChatMsg = { role: 'user', text: q };
    const historyForApi = prev.chat;
    patchState(sid, { chat: [...prev.chat, userMsg] });
    setChatLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    
    const isOnline = networkService.isOnline();
    let reply = "";

    try {
      if (isOnline) {
        // Route 1: Try FastAPI backend (desktop only)
        if (!IS_NATIVE_MOBILE && BACKEND) {
          try {
            const res = await fetch(`${BACKEND}/api/filespeaker/chat`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ source_ids: sids, source_titles: titles, history: historyForApi, question: q }),
            });
            if (res.ok) {
              const data = await res.json();
              reply = data.reply;
            }
          } catch (e) {
            console.warn('[FileSpeaker] Backend chat failed, trying client-side Gemini direct...', e);
          }
        }

        // Route 2: Centralized LLM Router client-side RAG
        if (!reply) {
          try {
            const contextText = sids.map(id => {
              const s = sources.find(src => src.source_id === id);
              return `DOCUMENT: ${s?.title}\n${retrieveRelevantContext(q, s?.text || s?.preview || '', 8000)}`;
            }).join('\n\n');

            reply = await askDocumentRag(q, contextText, historyForApi);
          } catch (geminiErr) {
            console.warn('[FileSpeaker] Centralized client-side RAG failed:', geminiErr);
          }
        }
      }

      // Route 3: Local model RAG fallback (runs if we are offline, OR if online API query failed)
      if (!reply && llamaPlugin.isSupported()) {
        try {
          console.log('[FileSpeaker] Falling back to local llama model...');
          const contextText = sids.map(id => {
            const s = sources.find(src => src.source_id === id);
            return `DOCUMENT: ${s?.title}\n${retrieveRelevantContext(q, s?.text || s?.preview || '', 4000)}`;
          }).join('\n\n');

          // Limit context length on mobile to prevent OOM
          const maxContextLength = 4000;
          const truncatedContext = contextText.substring(0, maxContextLength) + (contextText.length > maxContextLength ? '... [truncated]' : '');

          const systemInstruction = `You are Kalam Spark Document Intelligence Agent.
You answer questions based on the provided documents.
Be accurate and concise. Never invent facts.`;

          const historyStr = historyForApi.map(h => `${h.role === 'ai' ? 'AI' : 'Student'}: ${h.text}`).join('\n');
          const prompt = `Documents:\n${truncatedContext}\n\nHistory:\n${historyStr}\nStudent: ${q}\nAI:`;
          
          reply = await llamaPlugin.getCompletion(prompt, systemInstruction);
        } catch (localErr) {
          console.error('[FileSpeaker] Local model fallback failed:', localErr);
          // If offline model fails, return a friendly local message rather than crashing
          reply = `📝  Kalam Spark offline document reader: I see you're asking about these documents. While offline or with rate limits exceeded, and since the local model is not loaded, I recommend checking your internet connection or downloading the GGUF model in Settings. Your documents remain loaded locally in the browser/app.`;
        }
      }

      if (!reply) {
        throw new Error("Could not process chat request.");
      }

      setSourceStates(cur => {
        const s = cur[sid] ?? { chat: [], transforms: [], podcast: null };
        return { ...cur, [sid]: { ...s, chat: [...s.chat, { role: 'ai', text: reply }] } };
      });
    } catch (e: any) {
      setSourceStates(cur => {
        const s = cur[sid] ?? { chat: [], transforms: [], podcast: null };
        return { ...cur, [sid]: { ...s, chat: [...s.chat, { role: 'ai', text: `⚠️  Chat failed: ${e.message || e}` }] } };
      });
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  /* ─── Transformations ─── */
  const handleTransform = async (key: string, label: string) => {
    if (!activeSource || transforming) return;
    setTransforming(key);
    const sid = activeSource.source_id;
    const isOnline = networkService.isOnline();
    let resultText = "";

    try {
      const sourceText = activeSource.text || activeSource.preview;

      if (isOnline) {
        // Route 1: Try FastAPI backend (desktop only)
        if (!IS_NATIVE_MOBILE && BACKEND) {
          try {
            const res = await fetch(`${BACKEND}/api/filespeaker/transform`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ source_id: sid, source_text: sourceText, transformation: key }),
            });
            if (res.ok) {
              const data = await res.json();
              resultText = data.result;
            }
          } catch (e) {
            console.warn('[FileSpeaker] Backend transform failed, trying client-side Gemini direct...', e);
          }
        }

        // Route 2: Centralized LLM Router API transformation
        if (!resultText) {
          try {
            resultText = await transformDocument(label, key, sourceText);
          } catch (err) {
            console.error('[FileSpeaker] Centralized transform failed:', err);
          }
        }
      } else {
        // Route 3: Offline local LLM
        if (llamaPlugin.isSupported()) {
          console.log('[FileSpeaker] Running offline transform, calling local model...');
          const prompt = `Perform "${label}" transformation on this document. Return the result:\n\n${sourceText.substring(0, 4000)}`;
          resultText = await llamaPlugin.getCompletion(prompt, "You are a research assistant. Return only the transform result. No markdown blocks.");
        }
      }

      if (!resultText) throw new Error("Transformation returned empty result.");

      setSourceStates(cur => {
        const s = cur[sid] ?? { chat: [], transforms: [], podcast: null };
        return { ...cur, [sid]: { ...s, transforms: [{ type: key, label, result: resultText }, ...s.transforms.filter(t => t.type !== key)] } };
      });
    } catch (e: any) { alert(`Transformation failed: ${e.message || e}`); }
    finally { setTransforming(null); }
  };

  /* ─── Auto Language Detection ─── */
  const handleDetectLanguage = async () => {
    if (!activeSource || detectingLang) return;
    setDetectingLang(true);
    setDetectedLangInfo(null);
    try {
      const text = activeSource.text || activeSource.preview;
      const isOnline = networkService.isOnline();
      let data: any = null;

      if (isOnline) {
        try {
          const res = await fetch(`${BACKEND}/api/filespeaker/detect-language`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_text: text }),
          });
          if (res.ok) {
            data = await res.json();
          }
        } catch (e) {
          console.warn('[FileSpeaker] Backend language detection failed, detecting locally...', e);
        }
      }

      if (!data) {
        // Local regex language detector
        let lang = 'en';
        let name = 'English';
        let host1 = 'en-US-ChristopherNeural';
        let host2 = 'en-US-JennyNeural';

        if (/[\u0B80-\u0BFF]/.test(text)) {
          lang = 'ta'; name = 'Tamil'; host1 = 'ta-IN-ValluvarNeural'; host2 = 'ta-IN-PallaviNeural';
        } else if (/[\u0900-\u097F]/.test(text)) {
          lang = 'hi'; name = 'Hindi'; host1 = 'hi-IN-MadhurNeural'; host2 = 'hi-IN-SwaraNeural';
        } else if (/[\u0C00-\u0C7F]/.test(text)) {
          lang = 'te'; name = 'Telugu'; host1 = 'te-IN-MohanNeural'; host2 = 'te-IN-ShrutiNeural';
        } else if (/[\u0C80-\u0CFF]/.test(text)) {
          lang = 'kn'; name = 'Kannada'; host1 = 'kn-IN-GaganNeural'; host2 = 'kn-IN-SapnaNeural';
        } else if (/[\u0D00-\u0D7F]/.test(text)) {
          lang = 'ml'; name = 'Malayalam'; host1 = 'ml-IN-MidhunNeural'; host2 = 'ml-IN-SobhanaNeural';
        } else if (/[\u0980-\u09FF]/.test(text)) {
          lang = 'bn'; name = 'Bengali'; host1 = 'bn-IN-BashkarNeural'; host2 = 'bn-IN-TanishaaNeural';
        }

        data = { language: lang, language_name: name, host1_voice: host1, host2_voice: host2 };
      }

      setPodcastLang(data.language);
      setHost1Voice(data.host1_voice);
      setHost2Voice(data.host2_voice);
      setDetectedLangInfo(`Detected: ${data.language_name} —  voices auto-set!`);
    } catch (e: any) {
      setDetectedLangInfo('Could not detect language. Defaulting to English.');
    } finally {
      setDetectingLang(false);
    }
  };

  /* ── Podcast ── */
  const handleGeneratePodcast = async () => {
    if (!activeSource || generatingPodcast) return;  // topic is now optional
    setGeneratingPodcast(true);
    const sid = activeSource.source_id;
    patchState(sid, { podcast: null });
    try {
      // ── Desktop path: use backend ──
      if (!IS_NATIVE_MOBILE && BACKEND) {
        const res  = await fetch(`${BACKEND}/api/filespeaker/podcast`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_id: sid, source_text: activeSource.text || activeSource.preview,
            topic: podcastTopic, host1_name: host1Name, host2_name: host2Name,
            host1_voice: host1Voice, host2_voice: host2Voice,
            tone: podcastTone, length: podcastLength,
            language: podcastLang,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Podcast generation failed');
        patchState(sid, { podcast: data });

        // Save to Podcast Library
        const record: PodcastRecord = {
          id: data.podcast_id || String(Date.now()),
          sourceTitle: activeSource.title,
          topic: podcastTopic,
          host1: host1Name,
          host2: host2Name,
          language: data.language || podcastLang,
          languageName: data.language_name || 'English',
          audioFilename: data.audio_filename,
          durationEst: data.duration_estimate || '~? min',
          linesCount: data.lines?.length || 0,
          createdAt: Date.now(),
          script: data.script || '',
          lines: data.lines || [],
        };
        setPodcastLibrary(prev => [record, ...prev.slice(0, 49)]); // keep max 50
        return;
      }

      // ── Mobile / No-backend path: generate script via LLM + play with Web Speech API ──
      const lengthInstruction = podcastLength === 'short' ? '6-8 dialogue exchanges' : podcastLength === 'long' ? '18-24 dialogue exchanges' : '12-15 dialogue exchanges';
      const systemInstruction = `You are a world-class educational podcast scriptwriter.
CRITICAL RULE: ALL facts, examples, and explanations MUST come DIRECTLY from the provided source document.
Do NOT add any external knowledge not found in the document.
Return ONLY a JSON array with no markdown wrapping.`;
      const docContent = (activeSource.text || activeSource.preview || '').substring(0, 5000);
      const hasCustomTopic = podcastTopic.trim().length > 3;
      const focusInstruction = hasCustomTopic
        ? `Focus specifically on this aspect of the document: "${podcastTopic}"`
        : `Cover the most important concepts, facts, and ideas found in the document.`;
      const prompt = `SOURCE DOCUMENT (ALL podcast content must come from this ONLY):
---
${docContent}
---

${focusInstruction}

Write a ${lengthInstruction} podcast script between two hosts named "${host1Name}" (expert who explains the document) and "${host2Name}" (curious learner).
Tone: ${podcastTone}. Language: ${podcastLang === 'en' ? 'English' : podcastLang}.
Each exchange MUST reference specific details from the SOURCE DOCUMENT. Do NOT discuss anything not in the document.

Return as a JSON array: [{"speaker": "${host1Name}", "text": "..."}, {"speaker": "${host2Name}", "text": "..."}, ...]
Each line: 1-3 natural sentences. Conversational and educational.`;

      let scriptText = '';
      try {
        scriptText = await generateText({ prompt, systemInstruction, responseMimeType: 'application/json' });
      } catch (e) {
        console.error('[Podcast] LLM generation failed:', e);
        throw new Error('Could not generate podcast script. Check your internet connection.');
      }

      // Parse the script JSON
      let lines: { speaker: string; text: string }[] = [];
      try {
        // Try to extract JSON array from response
        const jsonMatch = scriptText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          lines = JSON.parse(jsonMatch[0]);
        } else {
          lines = JSON.parse(scriptText);
        }
      } catch (e) {
        console.warn('[Podcast] Could not parse script JSON, attempting line-by-line parsing');
        // Fallback: parse as plain text alternating speakers
        const rawLines = scriptText.split('\n').filter(l => l.trim());
        let i = 0;
        for (const line of rawLines) {
          if (line.trim()) {
            lines.push({ speaker: i % 2 === 0 ? host1Name : host2Name, text: line.trim() });
            i++;
          }
        }
      }

      if (!lines || lines.length === 0) {
        throw new Error('Generated podcast script is empty. Please try again.');
      }

      // Build a pseudo-podcast object with all lines
      const script = lines.map(l => `${l.speaker}: ${l.text}`).join('\n');
      const podcastData = {
        podcast_id: `local_${Date.now()}`,
        script,
        lines,
        language: podcastLang,
        language_name: PODCAST_LANGUAGES.find(l => l.code === podcastLang)?.label || 'English',
        duration_estimate: `~${Math.ceil(lines.length * 6 / 60)} min`,
        audio_url: null,   // no server audio on mobile —  we'll use Web Speech
        is_local: true,    // flag to indicate client-side TTS
      };

      patchState(sid, { podcast: podcastData });

      // Auto-play with Web Speech API if available
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel(); // stop any existing speech
        const voices = window.speechSynthesis.getVoices();
        // Pick a language-appropriate voice if possible
        const langVoices = voices.filter(v => v.lang.startsWith(podcastLang) || v.lang.startsWith(podcastLang.split('-')[0]));
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const utt = new SpeechSynthesisUtterance(line.text);
          // Alternate pitch/rate between hosts to distinguish voices
          const isHost1 = line.speaker === host1Name;
          if (langVoices.length >= 2) {
            utt.voice = langVoices[isHost1 ? 0 : 1];
          } else if (langVoices.length === 1) {
            utt.voice = langVoices[0];
          }
          utt.pitch = isHost1 ? 0.9 : 1.15;
          utt.rate = isHost1 ? 0.95 : 1.0;
          utt.lang = LANGUAGE_VOICE_PRESETS[podcastLang]?.rec_lang || 'en-US';
          window.speechSynthesis.speak(utt);
        }
      }

      // Save to Podcast Library
      const record: PodcastRecord = {
        id: podcastData.podcast_id,
        sourceTitle: activeSource.title,
        topic: podcastTopic,
        host1: host1Name,
        host2: host2Name,
        language: podcastLang,
        languageName: podcastData.language_name,
        audioFilename: '',
        durationEst: podcastData.duration_estimate,
        linesCount: lines.length,
        createdAt: Date.now(),
        script,
        lines,
      };
      setPodcastLibrary(prev => [record, ...prev.slice(0, 49)]);

    } catch (e: any) { alert(`Podcast failed: ${(e as any).message}`); }
    finally { setGeneratingPodcast(false); }
  };


  /* ── Podcast Interactive Q&A ── */
  const [interactQ, setInteractQ] = useState('');
  const [interactLoading, setInteractLoading] = useState(false);
  const handlePodcastInteract = async () => {
    if (!activeSource || !interactQ.trim() || interactLoading || !podcast) return;

    if (podcastAudioRef.current) podcastAudioRef.current.pause();
    if (interactionAudioRef.current) interactionAudioRef.current.pause();

    setInteractLoading(true);
    const sid = activeSource.source_id;
    const q = interactQ.trim();
    setInteractQ('');
    try {
      const script = podcast.lines?.map((l: any) => `${l.speaker}: ${l.text}`).join('\n') || '';
      const res = await fetch(`${BACKEND}/api/filespeaker/podcast/interact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podcast_script: script, question: q,
          host_name: host1Name, host_voice: host1Voice,
          language: podcastLang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Interaction failed');

      const newInteractions = [...(podcast.interactions || []), { q, a: data.text, audio: data.audio_url }];
      patchState(sid, { podcast: { ...podcast, interactions: newInteractions } });

      // Play answer audio —  BUG FIX 5: assign to ref as plain Audio object (correct)
      const answerAudio = new Audio(`${BACKEND}/api/filespeaker/audio/${data.audio_url}`);
      interactionAudioRef.current = answerAudio;
      answerAudio.onended = () => {
        if (podcastAudioRef.current) podcastAudioRef.current.play();
      };
      answerAudio.play();
    } catch (e: any) { alert(`Interact failed: ${e.message}`); }
    finally { setInteractLoading(false); }
  };

  const handlePodcastMic = () => {
    if (podcastAudioRef.current) podcastAudioRef.current.pause();
    if (interactionAudioRef.current) interactionAudioRef.current.pause();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('Speech Recognition not supported in this browser.');

    if (isListeningPodcast) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListeningPodcast(false);
      return;
    }

    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    // FIX: Use the podcast language's recognition locale based on selected language, not hardcoded en-US
    rec.lang = LANGUAGE_VOICE_PRESETS[podcastLang]?.rec_lang || 'en-US';
    rec.interimResults = true;

    rec.onstart  = () => setIsListeningPodcast(true);
    rec.onresult = (e: any) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      }
      if (final) setInteractQ(prev => prev ? prev + ' ' + final : final);
    };
    rec.onend = () => setIsListeningPodcast(false);
    rec.start();
  };

  /* ─── Rename source ─── */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState('');
  const commitRename = (id: string) => {
    if (renameVal.trim()) setSources(prev => prev.map(s => s.source_id === id ? { ...s, title: renameVal.trim() } : s));
    setRenamingId(null);
  };

  /* ─── Quick URL import (from Study Center or external) ─── */
  const [quickUrl, setQuickUrl]     = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const handleQuickUrl = async () => {
    if (!quickUrl.trim()) return;
    setQuickLoading(true);
    try {
      const res  = await fetch(`${BACKEND}/api/filespeaker/url`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: quickUrl.trim(), deep: deepCrawl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'URL extraction failed');
      registerSource({ ...data, text: data.preview, addedAt: Date.now() });
      setQuickUrl('');
    } catch (e: any) { alert(`Failed: ${(e as any).message}`); }
    finally { setQuickLoading(false); }
  };

  /* ─── Auto-import URL from Study Center (sessionStorage) ─── */
  useEffect(() => {
    const fsUrl = sessionStorage.getItem('fs_import_url');
    if (!fsUrl) return;
    const fsTitle = sessionStorage.getItem('fs_import_title') || '';
    const fsDesc = sessionStorage.getItem('fs_import_desc') || '';
    sessionStorage.removeItem('fs_import_url');
    sessionStorage.removeItem('fs_import_title');
    sessionStorage.removeItem('fs_import_desc');
    setQuickUrl(fsUrl);
    setQuickLoading(true);
    // small delay so component is ready, then auto-trigger
    const t = setTimeout(async () => {
      try {
        // Wait for network service to be fully ready
        await networkService.ready();
        const isOnline = networkService.isOnline();

        // Desktop: try backend first for full crawl4ai extraction
        if (!IS_NATIVE_MOBILE && BACKEND && isOnline) {
          try {
            const res = await fetch(`${BACKEND}/api/filespeaker/url`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: fsUrl }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.source_id) {
                registerSource({ ...data, text: data.preview, addedAt: Date.now() });
                setQuickUrl('');
                setQuickLoading(false);
                return;
              }
            }
          } catch (e) {
            console.warn('[FileSpeaker] Auto-import backend URL extraction failed, trying Gemini...', e);
          }
        }

        // Mobile + desktop fallback: use central summarizeWebpage to summarize/extract from the URL
        if (isOnline) {
          let urlContent = '';
          try {
            // allorigins.win is a reliable CORS proxy for mobile
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(fsUrl)}`;
            const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
            const proxyData = await resp.json();
            urlContent = proxyData.contents?.substring(0, 8000) || '';
          } catch (_) {
            urlContent = ''; // Proxy failed, use own knowledge
          }

          // Clean urlContent: if it is just a script or HTML wrapper, make it empty
          if (urlContent && (urlContent.includes('<script>') || urlContent.length < 200 || !urlContent.includes(' '))) {
            urlContent = '';
          }

          const extractedText = await summarizeWebpage(fsUrl, urlContent);
          const isValidText = extractedText && extractedText.trim().length > 150 && 
            !extractedText.includes("enable JavaScript") && 
            !extractedText.includes("allorigins") && 
            !extractedText.includes("Error");

          if (isValidText) {
            const title = fsTitle || fsUrl.replace(/https?:\/\//, '').split('/')[0];
            const source: Source = {
              source_id: `url_${Date.now()}`,
              title,
              char_count: extractedText.length,
              chunk_count: Math.ceil(extractedText.length / 1000),
              preview: extractedText.substring(0, 250) + '...',
              text: extractedText,
              addedAt: Date.now(),
              detectedLang: 'en',
            };
            registerSource(source);
            setQuickUrl('');
            setQuickLoading(false);
            return;
          }
        }

        // Fallback: Generate a comprehensive study guide / notes using LLM knowledge based on Title & Description
        if (fsTitle) {
          const systemInstruction = "You are an elite academic educator. Return only the detailed study guide text.";
          const prompt = `You are a content generator for File Speaker. The user wants to study a resource but the direct URL scrape failed.
Generate a comprehensive, highly detailed study guide, lecture transcript, or textbook chapter summary for:
Title: ${fsTitle}
Description/Author/Publisher: ${fsDesc}
Source URL: ${fsUrl}

The generated content must be extremely detailed, educational, and structured, so the student can chat with it, study it, and convert it to a podcast. Generate at least 1500 words of core concepts, detailed explanations, and key takeaways.`;

          const generatedText = await generateText({ prompt, systemInstruction, temperature: 0.3 });
          if (generatedText && generatedText.trim().length > 100) {
            const source: Source = {
              source_id: `url_${Date.now()}`,
              title: fsTitle,
              char_count: generatedText.length,
              chunk_count: Math.ceil(generatedText.length / 1000),
              preview: generatedText.substring(0, 250) + '...',
              text: generatedText,
              addedAt: Date.now(),
              detectedLang: 'en',
            };
            registerSource(source);
            setQuickUrl('');
            setQuickLoading(false);
            return;
          }
        }

        throw new Error('Could not extract URL content. Please paste the text manually using the Text tab.');
      } catch (err: any) {
        console.error("Auto-import failed:", err);
        alert(`Auto-import failed: ${err.message || err}`);
      } finally {
        setQuickLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, []);

  /* ─── Remove Source ─── */
  const removeSource = (id: string) => {
    setSources(prev => prev.filter(s => s.source_id !== id));
    setCheckedSources(prev => prev.filter(x => x !== id));
    if (activeSourceId === id) setActiveSourceId(null);
    setSourceStates(prev => { const n = { ...prev }; delete n[id]; return n; });
  };
  const curState  = activeSource ? getState(activeSource.source_id) : null;
  const chatHistory = curState?.chat ?? [];
  const transforms  = curState?.transforms ?? [];
  const podcast     = curState?.podcast ?? null;

  /* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ RENDER Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
  return (
    <div className="fade-up h-[calc(100vh-8rem)] flex flex-col gap-6 bg-transparent">
      {/* Header */}
      <div>
        <h1 className="heading-gold font-cinzel text-2xl font-bold flex items-center gap-3">
          <Volume2 size={24} className="text-violet-400" /> File Speaker
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Upload documents, web links, or text → Chat with them · Extract insights · Convert to podcast
        </p>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Quick URL Import Bar (Study Center / YouTube / Article links) Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className={`flex items-center gap-2 p-1.5 pl-3 rounded-xl border transition-all duration-300 ${
        isLight 
          ? 'bg-violet-50 border-violet-200 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-200' 
          : 'bg-violet-500/5 border-violet-500/20 focus-within:border-violet-500/50 focus-within:shadow-[0_0_15px_rgba(124,58,237,0.15)]'
      }`}>
        <Link size={14} className="text-violet-400 shrink-0" />
        <span className={`text-xs shrink-0 hidden sm:inline ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>Quick import:</span>
        <input
          value={quickUrl}
          onChange={e => setQuickUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleQuickUrl()}
          placeholder="Paste any YouTube link, article URL or web page..."
          className={`flex-1 min-w-0 bg-transparent text-sm focus:outline-none ${isLight ? 'text-zinc-800 placeholder:text-zinc-400' : 'text-white placeholder:text-zinc-600'}`}
          style={{ border: 'none', boxShadow: 'none', outline: 'none' }}
        />
        <button onClick={handleQuickUrl} disabled={quickLoading || !quickUrl.trim()}
          className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0">
          {quickLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          {quickLoading ? 'Fetching' : 'Add'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0">
        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Left Sidebar: Source Vault Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div className="w-full lg:w-80 flex flex-col gap-3 flex-1 lg:flex-none lg:h-full overflow-hidden">
          <div className="flex items-center justify-between">
            <span className={`text-xs uppercase tracking-widest font-semibold ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>Sources ({sources.length})</span>
            <button onClick={() => setAddMode(addMode ? null : 'file')}
              className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-400/20 text-violet-400 hover:bg-violet-500/20 transition-all">
              <Plus size={14} />
            </button>
          </div>

          {/* Add Source Panel */}
          {addMode && (
            <div className={`rounded-xl border p-4 space-y-3 ${isLight ? 'border-zinc-200 bg-white shadow-sm' : 'border-zinc-800 bg-zinc-900/80'}`}>
              <div className="flex gap-1.5">
                {([['file','File'], ['url','URL'], ['text','Text']] as const).map(([m, lbl]) => (
                  <button key={m} onClick={() => setAddMode(m)}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${addMode === m ? 'bg-violet-600 text-white' : isLight ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>
                    {lbl}
                  </button>
                ))}
              </div>

              {addMode === 'file' && (
                <div>
                  <input type="file" ref={fileRef} className="hidden" accept=".pdf,.docx,.doc,.txt,.md,.html"
                    onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className={`w-full border-2 border-dashed rounded-xl p-5 text-center transition-all group ${isLight ? 'border-zinc-300 hover:border-violet-400' : 'border-zinc-700 hover:border-violet-500/50'}`}>
                    {uploading ? <Loader2 size={20} className="animate-spin text-violet-400 mx-auto mb-1" />
                      : <Upload size={20} className={`mx-auto mb-1 transition-colors group-hover:text-violet-400 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`} />}
                    <p className={`text-xs transition-colors ${isLight ? 'text-zinc-500 group-hover:text-zinc-700' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                      {uploading ? 'Uploading' : 'Click to upload PDF, DOCX, TXT, MD'}
                    </p>
                  </button>
                </div>
              )}

              {addMode === 'url' && (
                <div className="space-y-2">
                  <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
                    placeholder="https://example.com/article"
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/40 ${isLight ? 'bg-white border-zinc-300 text-zinc-800 placeholder:text-zinc-400' : 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'}`} />
                  <label className={`flex items-center gap-2 text-[11px] cursor-pointer transition-colors ${isLight ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'}`}>
                    <input type="checkbox" checked={deepCrawl} onChange={e => setDeepCrawl(e.target.checked)} className="accent-violet-500 rounded" />
                    Deep Crawl (Follow sub-links)
                  </label>
                  <button onClick={handleAddUrl} disabled={uploading || !urlInput.trim()}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
                    {uploading ? 'Fetching' : 'Add URL'}
                  </button>
                </div>
              )}

              {addMode === 'text' && (
                <div className="space-y-2">
                  <input value={textTitle} onChange={e => setTextTitle(e.target.value)} placeholder="Title (optional)"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/40 ${isLight ? 'bg-white border-zinc-300 text-zinc-800 placeholder:text-zinc-400' : 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'}`} />
                  <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
                    placeholder="Paste notes or text here..." rows={4}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/40 resize-none ${isLight ? 'bg-white border-zinc-300 text-zinc-800 placeholder:text-zinc-400' : 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'}`} />
                  <button onClick={handleAddText} disabled={uploading || !textInput.trim()}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                    {uploading ? 'Adding' : 'Add Text'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Source List */}
          <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1 pb-4">
            {sources.length === 0 && (
              <div className={`text-center py-10 text-xs ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <Upload size={32} className="mx-auto mb-2 opacity-30" />
                No sources yet.<br />Add a file, URL, or text above.
              </div>
            )}
            {sources.map(src => (
              <div key={src.source_id}
                className={`rounded-xl border transition-all group relative ${
                  activeSourceId === src.source_id
                    ? 'border-violet-500/40 bg-violet-500/10'
                    : isLight ? 'border-zinc-200 bg-white hover:border-violet-300 shadow-sm' : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                }`}>
                <button onClick={() => switchSource(src)} className="w-full text-left p-3 pr-14 flex gap-3 items-start">
                  <div className="pt-0.5">
                    <input type="checkbox" checked={checkedSources.includes(src.source_id)}
                      onChange={e => {
                        e.stopPropagation();
                        setCheckedSources(prev => prev.includes(src.source_id) ? prev.filter(x => x !== src.source_id) : [...prev, src.source_id]);
                      }}
                      className="accent-violet-500 scale-110 cursor-pointer" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {renamingId === src.source_id ? (
                      <input
                        autoFocus
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(src.source_id); if (e.key === 'Escape') setRenamingId(null); }}
                        onBlur={() => commitRename(src.source_id)}
                        className={`w-full border border-violet-500/40 rounded px-2 py-0.5 text-xs focus:outline-none ${isLight ? 'bg-violet-50 text-zinc-800' : 'bg-black/40 text-white'}`}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <p className={`text-xs font-semibold truncate pr-2 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>{src.title}</p>
                    )}
                    <p className={`text-[10px] mt-0.5 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {(src.char_count / 1000).toFixed(1)}k chars · {src.chunk_count} chunks
                    </p>
                  </div>
                </button>
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={e => { e.stopPropagation(); setRenamingId(src.source_id); setRenameVal(src.title); }}
                    className={`transition-colors ${isLight ? 'text-zinc-400 hover:text-violet-600' : 'text-zinc-600 hover:text-violet-300'}`} title="Rename">
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); removeSource(src.source_id); }}
                    className={`transition-colors ${isLight ? 'text-zinc-400 hover:text-red-500' : 'text-zinc-600 hover:text-red-400'}`} title="Remove">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Right Panel: Workspace Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div className={`flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300 ${
          activeSource 
            ? 'fixed inset-0 z-[60] bg-zinc-950 sm:relative sm:z-auto sm:inset-auto sm:bg-transparent' 
            : 'hidden sm:flex'
        }`}>
          {!activeSource ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 rounded-2xl border border-zinc-800/60 bg-zinc-950/30 p-10">
              <div>
                <Volume2 size={48} className="text-violet-500/30 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-zinc-400 mb-2">Select or Add a Source</h2>
                <p className="text-sm text-zinc-600 max-w-sm">
                  Upload a PDF, paste a URL, or type text on the left. You can add multiple sources and switch between them anytime!
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  { icon: Upload, label: 'Upload File', mode: 'file' as const },
                  { icon: Link,   label: 'Add URL',     mode: 'url' as const },
                  { icon: FileText, label: 'Paste Text', mode: 'text' as const },
                ].map(({ icon: Icon, label, mode }) => (
                  <button key={mode} onClick={() => setAddMode(mode)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-violet-500/10 border border-violet-400/20 text-violet-300 rounded-xl text-sm font-medium hover:bg-violet-500/20 transition-all">
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={`flex-1 flex flex-col rounded-2xl border overflow-hidden ${isLight ? 'border-zinc-200 bg-white shadow-sm' : 'border-zinc-800/60 bg-zinc-950/30'}`}>
              {/* Source Header */}
              <div className={`flex items-center justify-between px-5 py-3.5 border-b ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/60 border-zinc-800/60'}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveSourceId(null)} className="sm:hidden p-2 -ml-2 rounded-lg hover:bg-zinc-800 transition-colors">
                    <ChevronRight size={20} className="rotate-180" />
                  </button>
                  <div>
                    <h3 className={`text-sm font-bold fs-workspace-title truncate max-w-[140px] xs:max-w-none ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>
                      {sourceTab === 'chat' && checkedSources.length > 1 && checkedSources.includes(activeSource.source_id)
                        ? `Workspace (${checkedSources.length} sources)`
                        : activeSource.title}
                    </h3>
                    <p className={`text-[10px] fs-workspace-subtitle ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>
                      {sourceTab === 'chat' && checkedSources.length > 1 && checkedSources.includes(activeSource.source_id)
                        ? 'Cross-referencing enabled'
                        : `${(activeSource.char_count / 1000).toFixed(1)}k characters indexed`}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center gap-1 p-1 rounded-lg border fs-tabs-container ${isLight ? 'bg-zinc-100 border-zinc-200' : 'bg-black/30 border-zinc-800'}`}>
                  {([['chat','Chat',MessageSquare],['transform','Insights',Zap],['podcast','Podcast',Headphones]] as const).map(([tab, lbl, Icon]) => (
                    <button key={tab} onClick={() => setSourceTab(tab)}
                      className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-semibold transition-all ${sourceTab === tab ? 'bg-violet-600 text-white' : isLight ? 'text-zinc-500 hover:text-zinc-800' : 'text-zinc-500 hover:text-white'}`}>
                      <Icon size={12} className="hidden xs:inline" /> {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ CHAT TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {sourceTab === 'chat' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {chatHistory.length === 0 && (
                      <div className="text-center py-10">
                        <MessageSquare size={32} className={`mx-auto mb-3 ${isLight ? 'text-zinc-300' : 'text-zinc-700'}`} />
                        <p className={`text-sm ${isLight ? 'text-zinc-600' : 'text-zinc-500'}`}>Ask anything about <strong className={isLight ? 'text-zinc-800' : 'text-zinc-300'}>{activeSource.title}</strong></p>
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                          {['Summarise the main points', 'What are the key takeaways?', 'List the important concepts'].map(q => (
                            <button key={q} onClick={() => { setChatInput(q); }}
                              className={`px-3 py-1.5 border rounded-lg text-xs transition-all flex items-center gap-1.5 ${isLight ? 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-violet-600 hover:border-violet-300' : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-violet-300 hover:border-violet-500/30'}`}>
                              <ChevronRight size={10} />{q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${msg.role === 'user' ? 'bg-violet-600 text-white' : isLight ? 'bg-violet-100 text-violet-600' : 'bg-zinc-800 text-violet-400'}`}>
                          {msg.role === 'user' ? (user.name?.[0] || 'U') : 'AI'}
                        </div>
                        <div className={`px-4 py-3 rounded-xl max-w-[80%] text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-violet-600/15 border border-violet-500/20 text-zinc-200 rounded-tr-sm'
                            : isLight ? 'bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-tl-sm' : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 rounded-tl-sm'
                        }`}>
                          {msg.role === 'ai' ? renderMarkdown(msg.text) : msg.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs text-violet-400 font-bold">AI</div>
                        <div className="bg-zinc-800/50 border border-zinc-700/50 px-4 py-3 rounded-xl flex items-center gap-1.5">
                          {[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className={`p-3 border-t flex items-center gap-2 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800/60 bg-zinc-900/40'}`}>
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleChat()}
                      placeholder={`Ask about ${activeSource.title}...`}
                      className={`flex-1 min-w-0 border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-violet-500/40 ${isLight ? 'bg-white border-zinc-200 text-zinc-800 placeholder:text-zinc-400' : 'bg-zinc-800/50 border-zinc-700/50 text-white placeholder:text-zinc-600'}`} />
                    <button onClick={handleChat} disabled={!chatInput.trim() || chatLoading}
                      className={`px-4 py-3 rounded-lg transition-all ${chatInput.trim() && !chatLoading ? 'bg-violet-600 text-white hover:bg-violet-500' : isLight ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}>
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ TRANSFORM TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {sourceTab === 'transform' && (
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {TRANSFORMATIONS.map(({ key, label, icon: Icon, desc }) => (
                      <button key={key} onClick={() => handleTransform(key, label)} disabled={!!transforming}
                        className={`p-4 rounded-xl border text-left transition-all group ${transforming === key ? 'border-violet-500/50 bg-violet-500/10' : isLight ? 'border-zinc-200 bg-white hover:border-violet-400 hover:bg-violet-50 shadow-sm' : 'border-zinc-800 bg-zinc-900/60 hover:border-violet-500/30 hover:bg-violet-500/5'} disabled:opacity-60`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          {transforming === key ? <Loader2 size={16} className="text-violet-400 animate-spin" /> : <Icon size={16} className="text-violet-400/70 group-hover:text-violet-500 transition-colors" />}
                          <span className={`text-xs font-bold ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>{label}</span>
                        </div>
                        <p className={`text-[10px] ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>{desc}</p>
                      </button>
                    ))}
                  </div>
                  {transforms.map(t => (
                    <div key={t.type} className={`rounded-xl border overflow-hidden ${isLight ? 'border-zinc-200 bg-white shadow-sm' : 'border-zinc-800 bg-zinc-900/40'}`}>
                      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/60 border-zinc-800'}`}>
                        <span className="text-xs font-bold text-violet-500 uppercase tracking-wider">{t.label}</span>
                        <button onClick={() => setSourceStates(cur => ({ ...cur, [activeSource.source_id]: { ...getState(activeSource.source_id), transforms: getState(activeSource.source_id).transforms.filter(x => x.type !== t.type) } }))}
                          className={`transition-colors ${isLight ? 'text-zinc-400 hover:text-zinc-700' : 'text-zinc-600 hover:text-zinc-400'}`}><X size={13} /></button>
                      </div>
                      <div className={`p-4 text-sm leading-relaxed ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                        {renderMarkdown(t.result)}
                      </div>
                    </div>
                  ))}
                  {transforms.length === 0 && !transforming && (
                    <div className={`text-center py-8 text-xs ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      <Zap size={28} className="mx-auto mb-2 opacity-30" />
                      Click an insight above to analyze your document with AI
                    </div>
                  )}
                </div>
              )}

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ PODCAST TAB Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {sourceTab === 'podcast' && (
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div className={`rounded-xl border p-5 space-y-4 ${isLight ? 'border-zinc-200 bg-white shadow-sm' : 'border-zinc-800 bg-zinc-900/40'}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-violet-500 flex items-center gap-2"><Headphones size={16} /> Podcast Settings</h3>
                      <button onClick={() => setShowLibrary(true)}
                        className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                          podcastLibrary.length > 0
                            ? isLight ? 'border-violet-300 text-violet-600 bg-violet-50 hover:bg-violet-100' : 'border-violet-500/40 text-violet-400 bg-violet-500/10 hover:bg-violet-500/20'
                            : isLight ? 'border-zinc-200 text-zinc-400 bg-zinc-50' : 'border-zinc-700 text-zinc-600 bg-zinc-800/50'
                        }`}>
                        <Library size={10} />
                        Library {podcastLibrary.length > 0 && `(${podcastLibrary.length})`}
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Topic Input */}
                      <div className="flex-1">
                        <label className={`text-[11px] uppercase tracking-wider mb-1.5 block ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>Focus Angle <span className="normal-case text-[10px] opacity-60">(optional)</span></label>
                        <input value={podcastTopic} onChange={e => setPodcastTopic(e.target.value)}
                          placeholder={`Optional: e.g. "Key challenges" — leave blank to cover full doc`}
                          className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/40 ${isLight ? 'bg-white border-zinc-300 text-zinc-800 placeholder:text-zinc-400' : 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'}`} />
                        <p className={`text-[10px] mt-1 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>Podcast content is always based on your uploaded document</p>
                      </div>

                      {/* Language Selector Dropdown */}
                      <div className="w-full sm:w-64 relative">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className={`text-[11px] uppercase tracking-wider flex items-center gap-1 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                            <Languages size={11} /> Podcast Language
                          </label>
                          <button onClick={handleDetectLanguage} disabled={detectingLang || !activeSource}
                            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all ${
                              detectingLang ? 'border-violet-500/30 text-violet-400 bg-violet-500/10'
                              : isLight ? 'border-zinc-200 text-zinc-500 hover:border-violet-400 hover:text-violet-600 bg-zinc-50'
                              : 'border-zinc-700 text-zinc-400 hover:border-violet-500/40 hover:text-violet-400 bg-zinc-800/50'
                            }`}>
                            {detectingLang ? <Loader2 size={10} className="animate-spin" /> : <Globe size={10} />}
                            {detectingLang ? 'Detecting...' : 'Auto-Detect'}
                          </button>
                        </div>
                        
                        <div className="relative">
                          <button 
                            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                            className={`w-full flex items-center justify-between border rounded-lg px-3 py-2.5 text-sm transition-all focus:outline-none focus:border-violet-500/40 ${isLight ? 'bg-white border-zinc-300 text-zinc-800' : 'bg-zinc-800 border-zinc-700 text-white'}`}
                          >
                            <span>
                              {PODCAST_LANGUAGES.find(l => l.code === podcastLang)?.flag} {PODCAST_LANGUAGES.find(l => l.code === podcastLang)?.label}
                            </span>
                            <ChevronRight size={14} className={`transform transition-transform ${langDropdownOpen ? 'rotate-90' : ''}`} />
                          </button>
                          
                          {langDropdownOpen && (
                            <div className={`absolute top-full mt-2 w-full border rounded-xl shadow-xl z-50 overflow-hidden ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-800 border-zinc-700'}`}>
                              <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
                                <input 
                                  autoFocus
                                  value={langSearchQuery} 
                                  onChange={e => setLangSearchQuery(e.target.value)}
                                  placeholder="Search language..."
                                  className={`w-full px-2 py-1.5 text-xs rounded-md border focus:outline-none ${isLight ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-zinc-900/50 border-zinc-700 text-white'}`}
                                />
                              </div>
                              <div className="max-h-56 overflow-y-auto">
                                {PODCAST_LANGUAGES.filter(lang => 
                                  lang.label.toLowerCase().includes(langSearchQuery.toLowerCase()) || 
                                  lang.code.toLowerCase().includes(langSearchQuery.toLowerCase())
                                ).map(lang => (
                                  <button key={lang.code}
                                    onClick={() => {
                                      setPodcastLang(lang.code);
                                      const preset = LANGUAGE_VOICE_PRESETS[lang.code];
                                      if (preset) { setHost1Voice(preset.host1); setHost2Voice(preset.host2); }
                                      setDetectedLangInfo(null);
                                      setLangDropdownOpen(false);
                                      setLangSearchQuery('');
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-violet-500/10 ${podcastLang === lang.code ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 font-semibold' : isLight ? 'text-zinc-700' : 'text-zinc-300'}`}
                                  >
                                    <span className="text-base">{lang.flag}</span>
                                    {lang.label}
                                  </button>
                                ))}
                                {PODCAST_LANGUAGES.filter(lang => 
                                  lang.label.toLowerCase().includes(langSearchQuery.toLowerCase()) || 
                                  lang.code.toLowerCase().includes(langSearchQuery.toLowerCase())
                                ).length === 0 && (
                                  <div className="px-3 py-4 text-xs text-center text-zinc-500">No language found.</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {detectedLangInfo && (
                          <p className="text-[10px] text-emerald-500 mt-1.5 absolute -bottom-5">✓ {detectedLangInfo}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Host 1 Name & Voice */}
                      <div className="space-y-1.5 relative">
                        <label className={`text-[11px] uppercase tracking-wider block ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>Host 1 Name</label>
                        <input value={host1Name} onChange={e => setHost1Name(e.target.value)}
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/40 ${isLight ? 'bg-white border-zinc-300 text-zinc-800' : 'bg-zinc-800 border-zinc-700 text-white'}`} />
                        
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setHost1VoiceOpen(!host1VoiceOpen);
                              setHost2VoiceOpen(false);
                              setPodcastToneOpen(false);
                              setPodcastLengthOpen(false);
                            }}
                            className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm transition-all focus:outline-none focus:border-violet-500/40 ${isLight ? 'bg-white border-zinc-300 text-zinc-800' : 'bg-zinc-800 border-zinc-700 text-zinc-200'}`}
                          >
                            <span className="truncate">{VOICES.find(v => v.value === host1Voice)?.label || host1Voice}</span>
                            <span className="text-zinc-500 ml-1 text-xs">▼</span>
                          </button>
                          
                          {host1VoiceOpen && (
                            <div className={`absolute top-full left-0 right-0 mt-1.5 border rounded-xl shadow-2xl z-50 overflow-hidden ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-800 border-zinc-700'}`}>
                              <div className="max-h-56 overflow-y-auto no-scrollbar">
                                {VOICES.map(v => {
                                  const selected = host1Voice === v.value;
                                  return (
                                    <button
                                      type="button"
                                      key={v.value}
                                      onClick={() => {
                                        setHost1Voice(v.value);
                                        setHost1VoiceOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-violet-500/10 text-left ${selected ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 font-semibold' : isLight ? 'text-zinc-700' : 'text-zinc-300'}`}
                                    >
                                      <span>{v.label}</span>
                                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${selected ? 'border-violet-500' : 'border-zinc-400'}`}>
                                        {selected && <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Host 2 Name & Voice */}
                      <div className="space-y-1.5 relative">
                        <label className={`text-[11px] uppercase tracking-wider block ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>Host 2 Name</label>
                        <input value={host2Name} onChange={e => setHost2Name(e.target.value)}
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/40 ${isLight ? 'bg-white border-zinc-300 text-zinc-800' : 'bg-zinc-800 border-zinc-700 text-white'}`} />
                        
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setHost2VoiceOpen(!host2VoiceOpen);
                              setHost1VoiceOpen(false);
                              setPodcastToneOpen(false);
                              setPodcastLengthOpen(false);
                            }}
                            className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm transition-all focus:outline-none focus:border-violet-500/40 ${isLight ? 'bg-white border-zinc-300 text-zinc-800' : 'bg-zinc-800 border-zinc-700 text-zinc-200'}`}
                          >
                            <span className="truncate">{VOICES.find(v => v.value === host2Voice)?.label || host2Voice}</span>
                            <span className="text-zinc-500 ml-1 text-xs">▼</span>
                          </button>
                          
                          {host2VoiceOpen && (
                            <div className={`absolute top-full left-0 right-0 mt-1.5 border rounded-xl shadow-2xl z-50 overflow-hidden ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-800 border-zinc-700'}`}>
                              <div className="max-h-56 overflow-y-auto no-scrollbar">
                                {VOICES.map(v => {
                                  const selected = host2Voice === v.value;
                                  return (
                                    <button
                                      type="button"
                                      key={v.value}
                                      onClick={() => {
                                        setHost2Voice(v.value);
                                        setHost2VoiceOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-violet-500/10 text-left ${selected ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 font-semibold' : isLight ? 'text-zinc-700' : 'text-zinc-300'}`}
                                    >
                                      <span>{v.label}</span>
                                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${selected ? 'border-violet-500' : 'border-zinc-400'}`}>
                                        {selected && <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Tone */}
                      <div className="space-y-1.5 relative">
                        <label className={`text-[11px] uppercase tracking-wider block ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>Tone</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setPodcastToneOpen(!podcastToneOpen);
                              setHost1VoiceOpen(false);
                              setHost2VoiceOpen(false);
                              setPodcastLengthOpen(false);
                            }}
                            className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm transition-all focus:outline-none focus:border-violet-500/40 ${isLight ? 'bg-white border-zinc-300 text-zinc-800' : 'bg-zinc-800 border-zinc-700 text-zinc-200'}`}
                          >
                            <span className="truncate">{podcastTone}</span>
                            <span className="text-zinc-500 ml-1 text-xs">▼</span>
                          </button>
                          
                          {podcastToneOpen && (
                            <div className={`absolute top-full left-0 right-0 mt-1.5 border rounded-xl shadow-2xl z-50 overflow-hidden ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-800 border-zinc-700'}`}>
                              <div className="max-h-56 overflow-y-auto no-scrollbar">
                                {['educational and engaging','casual and conversational','academic and formal','debate style','storytelling'].map(t => {
                                  const selected = podcastTone === t;
                                  return (
                                    <button
                                      type="button"
                                      key={t}
                                      onClick={() => {
                                        setPodcastTone(t);
                                        setPodcastToneOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-violet-500/10 text-left ${selected ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 font-semibold' : isLight ? 'text-zinc-700' : 'text-zinc-300'}`}
                                    >
                                      <span>{t}</span>
                                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${selected ? 'border-violet-500' : 'border-zinc-400'}`}>
                                        {selected && <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Length */}
                      <div className="space-y-1.5 relative">
                        <label className={`text-[11px] uppercase tracking-wider block ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>Length</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setPodcastLengthOpen(!podcastLengthOpen);
                              setHost1VoiceOpen(false);
                              setHost2VoiceOpen(false);
                              setPodcastToneOpen(false);
                            }}
                            className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm transition-all focus:outline-none focus:border-violet-500/40 ${isLight ? 'bg-white border-zinc-300 text-zinc-800' : 'bg-zinc-800 border-zinc-700 text-zinc-200'}`}
                          >
                            <span className="truncate">
                              {podcastLength === 'short' ? 'Short (~3 min)' : podcastLength === 'medium' ? 'Medium (~6 min)' : 'Long (~12 min)'}
                            </span>
                            <span className="text-zinc-500 ml-1 text-xs">▼</span>
                          </button>
                          
                          {podcastLengthOpen && (
                            <div className={`absolute top-full left-0 right-0 mt-1.5 border rounded-xl shadow-2xl z-50 overflow-hidden ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-800 border-zinc-700'}`}>
                              <div className="max-h-56 overflow-y-auto no-scrollbar">
                                {[
                                  { value: 'short', label: 'Short (~3 min)' },
                                  { value: 'medium', label: 'Medium (~6 min)' },
                                  { value: 'long', label: 'Long (~12 min)' }
                                ].map(l => {
                                  const selected = podcastLength === l.value;
                                  return (
                                    <button
                                      type="button"
                                      key={l.value}
                                      onClick={() => {
                                        setPodcastLength(l.value);
                                        setPodcastLengthOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-violet-500/10 text-left ${selected ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 font-semibold' : isLight ? 'text-zinc-700' : 'text-zinc-300'}`}
                                    >
                                      <span>{l.label}</span>
                                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${selected ? 'border-violet-500' : 'border-zinc-400'}`}>
                                        {selected && <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={handleGeneratePodcast} disabled={generatingPodcast}
                      className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2.5">
                      {generatingPodcast ? <><Loader2 size={16} className="animate-spin" /> Generating Podcast... (2-5 min)</> : <><Headphones size={16} /> Generate Podcast</>}
                    </button>
                    {generatingPodcast && <p className={`text-[11px] text-center ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>Gemma4 is writing the script and TTS is synthesizing audio...☕</p>}
                  </div>

                  {/* Fix 3+4: Full audio player with progress bar, seek ±10s */}
                  {podcast && (
                    <div className={`rounded-xl border p-5 space-y-4 ${isLight ? 'border-violet-300/40 bg-violet-50' : 'border-violet-500/30 bg-violet-500/5'}`}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-violet-500 flex items-center gap-2"><Headphones size={16} /> {podcastTopic}</h3>
                      </div>
                      <AudioPlayer
                        src={`${BACKEND}/api/filespeaker/audio/${podcast.audio_filename}`}
                        host1={podcast.host1 || host1Name}
                        host2={podcast.host2 || host2Name}
                        linesCount={podcast.lines?.length || 0}
                        durationEst={podcast.duration_estimate || ''}
                        downloadUrl={`${BACKEND}/api/filespeaker/audio/${podcast.audio_filename}`}
                        audioRef={podcastAudioRef}
                        user={user}
                        lines={podcast.lines || []}
                        podcastLang={podcastLang}
                      />
                      <details className="text-xs">
                        <summary className={`cursor-pointer select-none py-1 ${isLight ? 'text-zinc-500 hover:text-zinc-800' : 'text-zinc-500 hover:text-zinc-300'}`}>View Full Script ↓</summary>
                        <div className={`mt-3 space-y-2 max-h-64 overflow-y-auto pr-1 border-t pt-3 ${isLight ? 'border-violet-200' : 'border-violet-500/20'}`}>
                          {podcast.lines?.map((line: any, i: number) => (
                            <div key={i} className="flex gap-2.5 group">
                              <div className="flex flex-col items-center shrink-0">
                                <span className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${line.speaker === host1Name ? 'bg-violet-500/10 text-violet-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                  {line.speaker}
                                </span>
                              </div>
                              <p className={`text-xs leading-relaxed flex-1 ${isLight ? 'text-zinc-700' : 'text-zinc-400'}`}>
                                {line.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>

                      {/* -- Interactive Podcast Q&A -- */}
                      <div className={`mt-6 border-t pt-5 space-y-4 ${isLight ? 'border-violet-200' : 'border-violet-500/20'}`}>
                        <h4 className="text-xs font-bold text-violet-500 flex items-center gap-2">
                          <MessageSquare size={14} /> Ask the Host
                        </h4>
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <div className="relative flex-1 w-full">
                            <input value={interactQ} onChange={e => setInteractQ(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handlePodcastInteract()}
                              placeholder={`Ask ${host1Name} a question...`}
                              className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500/40 pr-24 ${isLight ? 'bg-white border-zinc-200 text-zinc-800 placeholder:text-zinc-400' : 'bg-zinc-900 border-zinc-800 text-white shadow-inner'}`} />
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              <button onClick={handlePodcastMic}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isListeningPodcast ? 'bg-red-500 text-white animate-pulse' : isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-500' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'}`}
                                title="Speak your question">
                                <Mic size={14} />
                              </button>
                              <button onClick={handlePodcastInteract} disabled={!interactQ.trim() || interactLoading}
                                className="w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-all flex items-center justify-center shadow-lg shadow-violet-900/20">
                                {interactLoading ? <Loader2 size={14} className="animate-spin text-white" /> : <Send size={14} className="text-white" />}
                              </button>
                            </div>
                          </div>
                        </div>
                        {podcast.interactions?.length > 0 && (
                          <div className="space-y-3 mt-4">
                            {podcast.interactions.map((interaction: any, i: number) => (
                              <div key={i} className={`border rounded-xl p-3 ${isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/60 border-zinc-800'}`}>
                                <p className={`text-xs font-semibold mb-2 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>Q: {interaction.q}</p>
                                <div className="flex items-start gap-3">
                                  <audio src={`${BACKEND}/api/filespeaker/audio/${interaction.audio}`} controls className="h-8 max-w-[120px]" />
                                  <p className={`text-[11px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                    <strong className="text-violet-500">{host1Name}:</strong> {interaction.a}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
         PODCAST LIBRARY PANEL
         Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className={`relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
            isLight ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-zinc-800'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/80'
            }`}>
              <div className="flex items-center gap-2">
                <Library size={18} className="text-violet-500" />
                <h2 className={`font-bold text-base ${isLight ? 'text-zinc-800' : 'text-white'}`}>Podcast Library</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isLight ? 'bg-violet-100 text-violet-600' : 'bg-violet-500/20 text-violet-400'
                }`}>{podcastLibrary.length} episodes</span>
              </div>
              <button onClick={() => setShowLibrary(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  isLight ? 'hover:bg-zinc-200 text-zinc-500' : 'hover:bg-zinc-800 text-zinc-400'
                }`}><X size={16} /></button>
            </div>

            {/* Library list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {podcastLibrary.length === 0 ? (
                <div className="text-center py-16">
                  <Headphones size={40} className="mx-auto mb-3 opacity-20" />
                  <p className={`text-sm ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>No podcasts generated yet.</p>
                  <p className={`text-xs mt-1 ${isLight ? 'text-zinc-300' : 'text-zinc-700'}`}>Generate your first podcast from the Podcast Settings panel.</p>
                </div>
              ) : (
                podcastLibrary.map(rec => (
                  <div key={rec.id} className={`rounded-xl border p-4 ${
                    isLight ? 'border-zinc-200 bg-zinc-50 hover:border-violet-300' : 'border-zinc-800 bg-zinc-900/60 hover:border-violet-500/30'
                  } transition-all group`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isLight ? 'bg-violet-100 text-violet-600' : 'bg-violet-500/20 text-violet-400'
                          }`}>{rec.languageName}</span>
                          <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            <Clock size={9} /> {rec.durationEst} &bull; {rec.linesCount} lines
                          </span>
                        </div>
                        <p className={`text-sm font-semibold truncate ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{rec.topic}</p>
                        <p className={`text-[11px] truncate ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                          {rec.host1} &amp; {rec.host2} &bull; from: {rec.sourceTitle}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {new Date(rec.createdAt).toLocaleDateString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={() => setPodcastLibrary(prev => prev.filter(p => p.id !== rec.id))}
                        title="Delete from library"
                        className={`opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                          isLight ? 'hover:bg-red-50 text-red-400 hover:text-red-600' : 'hover:bg-red-500/10 text-zinc-600 hover:text-red-400'
                        }`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="mt-3">
                      {IS_NATIVE_MOBILE ? (
                        <LibraryTTSPlayer
                          lines={rec.lines || []}
                          podcastLang={rec.language || 'en'}
                          host1={rec.host1}
                          host2={rec.host2}
                          durationEst={rec.durationEst}
                          user={user}
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <LibraryAudioPlayer audioFilename={rec.audioFilename} />
                          <button
                            onClick={() => downloadPodcastFromLibrary(rec.id, `podcast_${rec.id}.mp3`, rec.audioFilename)}
                            disabled={downloadingIds[rec.id]}
                            title="Download podcast"
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all disabled:opacity-50 cursor-pointer ${
                              isLight ? 'border-zinc-200 text-zinc-500 hover:border-violet-400 hover:text-violet-600 bg-white'
                              : 'border-zinc-700 text-zinc-400 hover:border-violet-500/40 hover:text-violet-400 bg-zinc-800'
                            }`}>
                            {downloadingIds[rec.id] ? (
                              <Loader2 size={13} className="animate-spin text-violet-400" />
                            ) : (
                              <Download size={13} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    {rec.script && (
                      <details className="mt-2 text-xs">
                        <summary className={`cursor-pointer select-none py-1 ${isLight ? 'text-zinc-400 hover:text-zinc-700' : 'text-zinc-600 hover:text-zinc-400'}`}>View Script &#9660;</summary>
                        <div className={`mt-2 max-h-32 overflow-y-auto space-y-1.5 pt-2 border-t ${
                          isLight ? 'border-zinc-200' : 'border-zinc-800'
                        }`}>
                          {rec.lines.map((line, li) => (
                            <div key={li} className="flex gap-2">
                              <span className={`text-[10px] font-bold shrink-0 ${
                                li % 2 === 0 ? 'text-violet-500' : 'text-emerald-500'
                              }`}>{line.speaker}:</span>
                              <p className={`text-[11px] leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>{line.text}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






