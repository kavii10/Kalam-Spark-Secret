import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, Youtube, Newspaper, FlaskConical, Search, RefreshCw,
  ExternalLink, Loader2, ChevronLeft, ChevronRight, AlertCircle,
  X, Library, GraduationCap, Atom, Rss, Bookmark, Plus, ListVideo, FolderPlus, Check, Trash2, Volume2, Folder, FolderOpen
} from 'lucide-react';
import { UserProfile, CareerRoadmap } from '../types';
import {
  fetchDirectResources, searchAllResources,
  BookResource, VideoResource, PaperResource, NewsResource, ResourceData
} from '../services/resourceApiService';
import { dbService } from '../services/dbService';
import { useNavigate } from 'react-router-dom';
import { networkService } from '../services/networkService';

// ─── Glassmorphism card base style ─────────────────────────────────────────────
const gc: React.CSSProperties = {
  background: 'rgba(6,3,18,0.45)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,140,66,0.22)',
  borderRadius: 14,
};

// ─── Source badge colours ───────────────────────────────────────────────────────
const SOURCE_COLORS: Record<string, string> = {
  'google-books':    '#4285F4',
  'open-library':    '#16a34a',
  'gutendex':        '#7c3aed',
  'youtube':         '#ef4444',
  'khan-academy':    '#16a34a',
  'mit-ocw':         '#6366f1',
  'arxiv':           '#e85d04',
  'semantic-scholar':'#0ea5e9',
  'nyt':             '#000000',
};

function SourceBadge({ source }: { source: string }) {
  const color = SOURCE_COLORS[source] || '#888';
  const labels: Record<string, string> = {
    'google-books':     'Google Books',
    'open-library':     'Open Library',
    'gutendex':         'Gutenberg',
    'youtube':          'YouTube',
    'khan-academy':     'Khan Academy',
    'mit-ocw':          'MIT OCW',
    'arxiv':            'arXiv',
    'semantic-scholar': 'Semantic Scholar',
  };
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {labels[source] || source}
    </span>
  );
}

// ─── Horizontal scroll row ──────────────────────────────────────────────────────
function ScrollRow({
  title, icon: Icon, iconColor, items, renderCard, emptyMsg,
}: {
  title: string; icon: any; iconColor: string; items: any[];
  renderCard: (item: any, idx: number) => React.ReactNode;
  emptyMsg?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') =>
    ref.current?.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gold-300 flex items-center gap-2">
          <Icon size={15} className={iconColor} />
          {title}
          <span className="text-[11px] text-gold-500/35 font-normal ml-1">
            ({items.length})
          </span>
        </h3>
        <div className="flex items-center gap-1">
          {(['left', 'right'] as const).map(dir => (
            <button
              key={dir}
              onClick={() => scroll(dir)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
              style={{ background: 'rgba(255,140,66,0.08)', border: '1px solid rgba(255,140,66,0.22)', color: '#ff8c42' }}
            >
              {dir === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto pb-3 scroll-smooth"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,140,66,0.3) transparent' }}
      >
        {items.length === 0 ? (
          <div
            className="flex-shrink-0 w-56 h-36 flex flex-col items-center justify-center rounded-xl gap-2"
            style={{ border: '1px dashed rgba(255,140,66,0.18)' }}
          >
            <AlertCircle size={18} className="text-gold-500/30" />
            <p className="text-xs text-gold-500/35">{emptyMsg || 'No results found'}</p>
          </div>
        ) : (
          items.map((item, i) => (
            <div key={i} className="flex-shrink-0 w-64">{renderCard(item, i)}</div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Book Card ──────────────────────────────────────────────────────────────────
function BookCard({ item }: { item: BookResource }) {
  const navigate = useNavigate();
  const sendToFileSpeaker = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    sessionStorage.setItem('fs_import_url', item.link);
    sessionStorage.setItem('fs_import_title', item.title);
    sessionStorage.setItem('fs_import_desc', `${item.authors || ''} · ${item.summary || ''}`);
    navigate('/filespeaker');
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    window.open(item.link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleCardClick}
      className="resource-card block rounded-xl overflow-hidden flex flex-col h-[290px] transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer"
      style={gc}
    >
      <div
        className="flex justify-center items-center p-4 h-[120px] shrink-0"
        style={{ background: 'rgba(255,140,66,0.05)', borderBottom: '1px solid rgba(255,140,66,0.12)' }}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="h-[96px] object-contain rounded shadow-lg"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div
            className="w-16 h-20 rounded flex items-center justify-center"
            style={{ background: 'rgba(255,140,66,0.10)', border: '1px solid rgba(255,140,66,0.25)' }}
          >
            <BookOpen size={24} className="text-gold-400" />
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1 gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <SourceBadge source={item.source} />
          {item.isOpenAccess && (
            <span className="text-[9px] text-emerald-400 font-bold uppercase">Free</span>
          )}
        </div>
        <h4 className="resource-card-text text-xs font-semibold text-gold-200 line-clamp-2 leading-snug">
          {item.title}
        </h4>
        <p className="resource-card-text text-[10px] text-gold-500/50 opacity-70 truncate">
          {item.authors}
        </p>
        <div className="flex-1" />
        <div className="flex items-center justify-between mt-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gold-400">
            Open Book <ExternalLink size={9} />
          </span>
          <button onClick={sendToFileSpeaker}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 min-h-[32px] rounded-md bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/40 transition-all cursor-pointer"
            title="Send to File Speaker">
            <Volume2 size={12} /> Speak
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Video Card ─────────────────────────────────────────────────────────────────
function VideoCard({ item }: { item: VideoResource }) {
  const navigate = useNavigate();
  const iconColors: Record<string, string> = {
    'youtube': '#ef4444',
    'khan-academy': '#16a34a',
    'mit-ocw': '#6366f1',
  };
  const color = iconColors[item.source] || '#ff8c42';

  const sendToFileSpeaker = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    sessionStorage.setItem('fs_import_url', item.link);
    sessionStorage.setItem('fs_import_title', item.title);
    sessionStorage.setItem('fs_import_desc', `${item.channel || ''} · ${item.summary || ''}`);
    navigate('/filespeaker');
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    window.open(item.link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleCardClick}
      className="resource-card block rounded-xl overflow-hidden flex flex-col h-[290px] group transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer"
      style={gc}
    >
      <div className="relative h-[130px] shrink-0" style={{ background: 'rgba(0,0,0,0.3)' }}>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Youtube size={36} style={{ color: `${color}60` }} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{ background: color }}>
            <Youtube size={18} className="text-white ml-0.5" />
          </div>
        </div>
        <div className="absolute bottom-2 left-2">
          <SourceBadge source={item.source} />
        </div>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h4 className="resource-card-text text-xs font-semibold text-gold-200 line-clamp-2 leading-snug mb-1">
          {item.title}
        </h4>
        <p className="resource-card-text text-[10px] opacity-60 truncate" style={{ color }}>
          {item.channel}
        </p>
        <div className="flex-1" />
        <div className="flex items-center justify-between mt-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color }}>
            Watch Now <ExternalLink size={9} />
          </span>
          <button onClick={sendToFileSpeaker}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 min-h-[32px] rounded-md bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/40 transition-all cursor-pointer"
            title="Send to File Speaker">
            <Volume2 size={12} /> Speak
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Research Paper Card ────────────────────────────────────────────────────────
function PaperCard({ item }: { item: PaperResource }) {
  const navigate = useNavigate();
  const sendToFileSpeaker = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    sessionStorage.setItem('fs_import_url', item.link);
    sessionStorage.setItem('fs_import_title', item.title);
    sessionStorage.setItem('fs_import_desc', `${item.authors || ''} · ${item.publishedYear || ''}`);
    navigate('/filespeaker');
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    window.open(item.link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleCardClick}
      className="resource-card block rounded-xl overflow-hidden flex flex-col h-[260px] transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer"
      style={gc}
    >
      <div
        className="p-3 flex items-center gap-2 shrink-0"
        style={{ background: 'rgba(232,93,4,0.06)', borderBottom: '1px solid rgba(232,93,4,0.12)' }}
      >
        <Atom size={14} className="text-orange-400 shrink-0" />
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          <SourceBadge source={item.source} />
          {item.publishedYear && (
            <span className="text-[9px] text-gold-500/50">{item.publishedYear}</span>
          )}
        </div>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h4 className="resource-card-text text-xs font-semibold text-gold-200 line-clamp-3 leading-snug mb-1">
          {item.title}
        </h4>
        <p className="resource-card-text text-[10px] text-gold-500/50 opacity-70 line-clamp-2 mb-1">
          {item.authors}
        </p>
        <div className="flex-1" />
        <div className="flex items-center justify-between mt-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-400">
            Read Paper <ExternalLink size={9} />
          </span>
          <button onClick={sendToFileSpeaker}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 min-h-[32px] rounded-md bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/40 transition-all cursor-pointer"
            title="Send to File Speaker">
            <Volume2 size={12} /> Speak
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── News Card ──────────────────────────────────────────────────────────────────
function NewsCard({ item }: { item: NewsResource }) {
  const navigate = useNavigate();
  const sendToFileSpeaker = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    sessionStorage.setItem('fs_import_url', item.link);
    sessionStorage.setItem('fs_import_title', item.title);
    sessionStorage.setItem('fs_import_desc', `${item.source || ''} · ${item.summary || ''}`);
    navigate('/filespeaker');
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    window.open(item.link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleCardClick}
      className="resource-card block rounded-xl overflow-hidden flex flex-col h-[220px] transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer"
      style={gc}
    >
      {item.imageUrl && (
        <div className="h-[80px] shrink-0 overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
          />
        </div>
      )}
      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.25)' }}
          >
            <Newspaper size={10} className="text-emerald-400" />
          </div>
          <span className="text-[9px] text-emerald-400/70 font-medium truncate">{item.source}</span>
        </div>
        <h4 className="resource-card-text text-xs font-semibold text-gold-200 line-clamp-3 leading-snug flex-1">
          {item.title}
        </h4>
        <div className="flex items-center justify-between mt-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
            Read Article <ExternalLink size={9} />
          </span>
          <button onClick={sendToFileSpeaker}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 min-h-[32px] rounded-md bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/40 transition-all cursor-pointer"
            title="Send to File Speaker">
            <Volume2 size={12} /> Speak
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab types ──────────────────────────────────────────────────────────────────
type Tab = 'books' | 'videos' | 'papers' | 'news' | 'watch-later' | 'playlists';

const TABS: { key: Tab; label: string; icon: any; color: string }[] = [
  { key: 'books',  label: 'Books',           icon: BookOpen,     color: '#f59e0b' },
  { key: 'videos', label: 'Video Lectures',  icon: Youtube,      color: '#ef4444' },
  { key: 'papers', label: 'Research Papers', icon: FlaskConical, color: '#f97316' },
  { key: 'news',   label: 'Industry News',   icon: Newspaper,    color: '#10b981' },
  { key: 'watch-later', label: 'Watch Later', icon: Bookmark,    color: '#3b82f6' },
  { key: 'playlists',   label: 'Playlists',   icon: ListVideo,   color: '#a855f7' },
];


// ─── Resource Actions Helper ──────────────────────────────────────────────────
function ResourceActions({ item, roadmap, onUpdate, inStack = false }: { item: any, roadmap: CareerRoadmap, onUpdate: (rm: CareerRoadmap) => void, inStack?: boolean }) {
  const [open, setOpen] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [newPlName, setNewPlName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleExpand = (e: CustomEvent) => {
      if (e.detail !== item.link) setOpen(false);
    };
    window.addEventListener('resource-popover-open', handleExpand as EventListener);
    return () => window.removeEventListener('resource-popover-open', handleExpand as EventListener);
  }, [item.link]);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (open && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', clickOutside);
    }
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [open]);

  const isShared = item.link; // mostly we identify by link
  const inWatchLater = roadmap.watchLater?.some((x: any) => x.link === item.link);
  
  const toggleWatchLater = () => {
    const rm = { ...roadmap };
    if (!rm.watchLater) rm.watchLater = [];
    if (inWatchLater) rm.watchLater = rm.watchLater.filter((x: any) => x.link !== item.link);
    else rm.watchLater.push(item);
    onUpdate(rm);
    setOpen(false);
  };

  const addToPlaylist = (plId: string) => {
    const rm = { ...roadmap };
    const pl = rm.playlists?.find(p => p.id === plId);
    if (!pl) return;
    if (!pl.items.some(x => x.link === item.link)) {
        pl.items.push(item);
    }
    onUpdate(rm);
    setOpen(false);
    setShowPlaylists(false);
  };
  
  const createPlaylist = () => {
    if (!newPlName.trim()) return;
    const rm = { ...roadmap };
    if (!rm.playlists) rm.playlists = [];
    rm.playlists.push({ id: Date.now().toString(), name: newPlName.trim(), items: [item] });
    onUpdate(rm);
    setNewPlName('');
    setOpen(false);
    setShowPlaylists(false);
  };

  return (
    <div className={inStack ? "relative z-10" : "absolute top-2 right-2 z-10"} ref={menuRef}>
      <button 
        onClick={(e) => { 
          e.preventDefault(); 
          if (!open) {
            window.dispatchEvent(new CustomEvent('resource-popover-open', { detail: item.link }));
          }
          setOpen(!open); 
          setShowPlaylists(false); 
        }}
        className="w-8 h-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 text-white border border-white/20 shadow-lg backdrop-blur"
      >
        <Plus size={16} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 w-52 rounded-xl p-1.5 bg-[#1a1423] border border-gold-500/20 shadow-2xl flex flex-col gap-1 z-20 popover-menu">
          <button 
            onClick={(e) => { e.preventDefault(); toggleWatchLater(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-gold-200 text-left"
          >
            <Bookmark size={14} className={inWatchLater ? "text-blue-400 fill-blue-400" : ""} /> 
            {inWatchLater ? 'Remove Watch Later' : 'Watch Later'}
          </button>
          
          <div className="h-px bg-white/10 w-full my-1" />
          
          {!showPlaylists ? (
            <button 
              onClick={(e) => { e.preventDefault(); setShowPlaylists(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-gold-200 text-left"
            >
              <ListVideo size={14} className="text-purple-400" /> Add to Playlist
            </button>
          ) : (
            <div className="p-2 space-y-2">
               <p className="text-xs text-gold-500/50 mb-1">Select Playlist:</p>
               {roadmap.playlists?.map(pl => (
                 <button key={pl.id} onClick={(e) => { e.preventDefault(); addToPlaylist(pl.id); }} className="block w-full text-left text-xs px-2 py-1.5 hover:bg-white/10 rounded truncate" title={pl.name}>{pl.name}</button>
               ))}
               <div className="flex items-center gap-1 mt-2 w-full">
                 <input 
                   type="text" 
                   placeholder="New playlist..." 
                   value={newPlName} 
                   onChange={e => setNewPlName(e.target.value)}
                   onClick={e => e.preventDefault()}
                   className="flex-1 min-w-0 bg-black/20 text-xs text-gold-200 px-2 py-1 rounded border border-white/10 outline-none"
                 />
                 <button onClick={(e) => { e.preventDefault(); createPlaylist(); }} className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 shrink-0">
                   <Check size={12} />
                 </button>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLocalResourcesPlaceholder(dream: string, stageTitle: string): any {
  const dLower = dream.toLowerCase();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let books: any[] = [
    { title: `Foundations of ${dream}`, author: 'Academic Press', description: 'A comprehensive textbook covering core principles, methodologies, and industry standards.', link: 'https://books.google.com', source: 'local' },
    { title: `Professional Guide to ${dream}`, author: 'Kalam Press', description: 'Practical handbook filled with case studies, project templates, and expert insights.', link: 'https://books.google.com', source: 'local' }
  ];
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let videos: any[] = [
    { title: `Introduction to ${dream} Course`, publisher: 'EduSpark Online', description: 'Step-by-step video lecture series detailing essential concepts and applications.', link: 'https://www.youtube.com', source: 'local' },
    { title: `Advanced Topics in ${dream}`, publisher: 'TechAcademy', description: 'Deep dive tutorials into industry-standard tools and advanced system workflows.', link: 'https://www.youtube.com', source: 'local' }
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let papers: any[] = [
    { title: `Recent Trends and Future Directions in ${dream}`, author: 'Global Research Journal', description: 'Scholarly overview of major breakthroughs, research papers, and technical developments.', link: 'https://arxiv.org', source: 'local' }
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let news: any[] = [
    { title: `How technology is reshaping ${dream} careers`, publishedAt: 'Today', description: 'Industry news report on the skills, roles, and hiring patterns in demand right now.', link: 'https://news.google.com', source: 'local' }
  ];

  if (dLower.includes("software") || dLower.includes("computer") || dLower.includes("developer") || dLower.includes("code") || dLower.includes("ai") || dLower.includes("machine learning")) {
    books = [
      { title: 'Clean Code: A Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin', description: 'The legendary guide to writing clean, maintainable, and robust software code.', link: 'https://books.google.com/books?isbn=0132350882', source: 'local' },
      { title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', description: 'The absolute bible of algorithms, data structures, and computer science foundations.', link: 'https://books.google.com/books?isbn=0262033844', source: 'local' },
      { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', description: 'Unravel the complexities of databases, distributed systems, and modern software architectures.', link: 'https://books.google.com/books?isbn=1449373321', source: 'local' }
    ];
    videos = [
      { title: 'Data Structures and Algorithms for Beginners', publisher: 'freeCodeCamp.org', description: 'Comprehensive video course covering arrays, linked lists, trees, graphs, and search algorithms.', link: 'https://www.youtube.com/watch?v=RBSGKlAodsM', source: 'local' },
      { title: 'Software Architecture & System Design Basics', publisher: 'Tech Dummies', description: 'Learn how massive scalable systems (like Netflix, Google, Uber) are architected.', link: 'https://www.youtube.com/watch?v=SqcY0GlETPk', source: 'local' }
    ];
  } else if (dLower.includes("data") || dLower.includes("statistic") || dLower.includes("analyst")) {
    books = [
      { title: 'Python for Data Analysis', author: 'Wes McKinney', description: 'Learn how to manipulate, process, clean, and crunch datasets using Pandas and Numpy.', link: 'https://books.google.com/books?isbn=1491957662', source: 'local' },
      { title: 'The Elements of Statistical Learning', author: 'Trevor Hastie', description: 'Mathematical foundations of machine learning, regression, classification, and data modeling.', link: 'https://books.google.com/books?isbn=0387848576', source: 'local' }
    ];
    videos = [
      { title: 'Data Science Full Course for Beginners', publisher: 'Edureka', description: 'In-depth video covering statistics, Python, data visualization, and ML model training.', link: 'https://www.youtube.com/watch?v=-ETQ97mXXF0', source: 'local' }
    ];
  } else if (dLower.includes("design") || dLower.includes("ux") || dLower.includes("ui")) {
    books = [
      { title: 'The Design of Everyday Things', author: 'Don Norman', description: 'Cognitive psychology rules for usable product design and user experience principles.', link: 'https://books.google.com/books?isbn=0465050654', source: 'local' },
      { title: 'Don\'t Make Me Think: A Common Sense Approach to Web Usability', author: 'Steve Krug', description: 'The definitive guide to understanding how users navigate digital layouts.', link: 'https://books.google.com/books?isbn=0321965515', source: 'local' }
    ];
    videos = [
      { title: 'UI / UX Design Full Tutorial Course', publisher: 'DesignCourse', description: 'Learn wireframing, prototyping, typography, and color systems in modern UI design.', link: 'https://www.youtube.com/watch?v=c9Wg6Ry_zY0', source: 'local' }
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    books: books.map(b => ({ ...b, type: 'book' })),
    videos: videos.map(v => ({ ...v, type: 'video' })),
    papers: papers.map(p => ({ ...p, type: 'paper' })),
    news: news.map(n => ({ ...n, type: 'news' }))
  } as any;
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function Resources({ user }: { user: UserProfile }) {
  const [activeTab, setActiveTab] = useState<Tab>('books');
  const [loading, setLoading] = useState(true);
  // `dataReady` is only true after we have real data (or confirmed empty) — prevents the single-book flash
  const [dataReady, setDataReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [roadmap, setRoadmap] = useState<CareerRoadmap | null>(null);
  const [data, setData] = useState<ResourceData>({ books: [], videos: [], papers: [], news: [] });
  const isLight = user.settings?.theme === 'light';
  const [isOfflineAndNoCache, setIsOfflineAndNoCache] = useState(false);
  const navigate = useNavigate();
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  useEffect(() => {
    setActivePlaylistId(null);
  }, [activeTab]);

  // Keep a stable ref to the latest user to avoid stale closures in callbacks
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Update Roadmap helper – stable via useCallback
  const updateRoadmap = useCallback(async (rm: CareerRoadmap) => {
    setRoadmap(rm);
    await dbService.saveRoadmap(userRef.current, rm);
  }, []);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<ResourceData>({ books: [], videos: [], papers: [], news: [] });
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Helper: Extract clean, search-ready subjects from a stage ────────────────
  // Prefers stage.subjects (e.g. "Linear Algebra", "Calculus", "Python Programming")
  // Falls back to stage.concepts ONLY if they look like subject names (not checklist items
  // that start with action verbs like "Learn", "Understand", "Build", "Study").
  // This prevents bad queries like "Learn vector spaces" being sent to book/video APIs.
  const getStageSubjects = (stage: any): string[] => {
    if (stage?.subjects && stage.subjects.length > 0) {
      return stage.subjects.filter((s: string) => s && s.trim().length > 0);
    }
    // Fallback: use concepts that look like subject names (not action-verb checklist items)
    const actionVerbs = /^(learn|understand|study|build|implement|practice|explore|read|write|create|develop|master|apply|use|complete|finish|do|make|watch|review)/i;
    const subjectLikeConcepts = (stage?.concepts || []).filter(
      (c: string) => c && c.trim().length > 0 && !actionVerbs.test(c.trim())
    );
    if (subjectLikeConcepts.length > 0) return subjectLikeConcepts;
    // Last resort: return concepts as-is (better than nothing)
    return (stage?.concepts || []).filter((c: string) => c && c.trim().length > 0);
  };

  // ── Fetch curriculum resources ───────────────────────────────────────────────
  const fetchCurriculum = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setIsOfflineAndNoCache(false);
    setSearchMode(false);
    setSearchQuery('');

    const currentUser = userRef.current;

    try {
      let rm = await dbService.getRoadmap(currentUser.id);
      if (!rm || !rm.stages || rm.stages.length === 0 || rm.stages[0].id === 'fallback-stage-1') {
        setRoadmap(null);
        setLoading(false);
        setInitialized(true);
        setDataReady(true);
        return;
      }
      setRoadmap(rm);

      const stageIdx = Math.min(currentUser.currentStageIndex, rm.stages.length - 1);
      const stage = rm.stages[stageIdx];
      if (!stage) { setLoading(false); setInitialized(true); setDataReady(true); return; }

      let cached = rm.cachedResources;

      // ── Cache Logic ──────────────────────────────────────────────────────────
      // Re-fetch if:
      //   1. No cache exists
      //   2. The user has pivoted careers (dream mismatch)
      //   3. The user has moved to a new stage in the roadmap
      //   4. The stage subjects changed (old cache built from stage title or wrong subjects)
      //
      // IMPORTANT: Use stage.subjects ("Linear Algebra", "Calculus", "Python") as the
      // primary source. Do NOT use stage.title ("Foundations of Math") or raw concepts
      // ("Learn vector spaces") for resource queries — they produce wrong search results.
      const stageSubjects: string[] = getStageSubjects(stage);
      const dreamMismatch = cached?.cachedForDream && cached.cachedForDream !== currentUser.dream;
      const stageMismatch = cached?.cachedForStage !== undefined && cached.cachedForStage !== stageIdx;
      // Subjects mismatch: old cache built from stage title or different/no subjects
      const cachedSubs: string[] = (cached as any)?.cachedSubjects || [];
      // Use a set-based comparison so subject order doesn't falsely trigger a refetch
      const subjectsMismatch = stageSubjects.length > 0 && (
        cachedSubs.length === 0 ||
        cachedSubs.length !== stageSubjects.length ||
        stageSubjects.some(s => !cachedSubs.includes(s))
      );
      const loadCount = (rm as any)._loadMoreCount || 0;
      const sparseCache = cached && loadCount === 0 && (
        (!Array.isArray(cached.books) || cached.books.length === 0) &&
        (!Array.isArray(cached.videos) || cached.videos.length === 0)
      );

      if (!cached || dreamMismatch || stageMismatch || sparseCache || subjectsMismatch) {
        const isOnline = networkService.isOnline();
        if (isOnline) {
          try {
            // Pass '' as stageTopic so fetchDirectResources uses concepts/subjects only (not the generic stage title)
            // stageSubjects contains either stage.concepts (preferred) or stage.subjects as fallback
            const fetched = await fetchDirectResources(
              currentUser.dream, '', stageSubjects, currentUser.year
            );
            // Sort resources so stage-subject matches appear first
            const stageSubjectsLower = stageSubjects.map((s: string) => s.toLowerCase());
            const scoreItem = (title: string) => {
              const t = title.toLowerCase();
              return stageSubjectsLower.some(s => t.includes(s)) ? 0 : 1;
            };
            cached = {
              books:  (Array.isArray(fetched.books)  ? fetched.books  : []).filter((b: any) => b?.link?.startsWith('http')).sort((a: any, b: any) => scoreItem(a.title) - scoreItem(b.title)).slice(0, 10),
              videos: (Array.isArray(fetched.videos) ? fetched.videos : []).filter((v: any) => v?.link?.startsWith('http')).sort((a: any, b: any) => scoreItem(a.title) - scoreItem(b.title)).slice(0, 10),
              papers: (Array.isArray(fetched.papers) ? fetched.papers : []).filter((p: any) => p?.link?.startsWith('http')).sort((a: any, b: any) => scoreItem(a.title) - scoreItem(b.title)).slice(0, 10),
              news:   (Array.isArray(fetched.news)   ? fetched.news   : []).filter((n: any) => n?.link?.startsWith('http')).slice(0, 10),
              cachedForDream: currentUser.dream,
              cachedForStage: stageIdx,
              cachedSubjects: stageSubjects,
            } as any;
            rm = { ...rm, cachedResources: cached, _loadMoreCount: 0 };
            await dbService.saveRoadmap(currentUser, rm);
          } catch (fetchErr) {
            console.warn('[Resources] Fetch direct failed online, trying cache fallback...', fetchErr);
          }
        }

        // If we failed to fetch or are offline, use placeholder fallbacks:
        // NOTE: We use the local placeholder only as a LAST resort — not when cached data already exists
        if (!cached || !cached.books || cached.books.length === 0) {
          if (rm.cachedResources && rm.cachedResources.books && rm.cachedResources.books.length > 0) {
            cached = rm.cachedResources;
          } else {
            if (!networkService.isOnline()) {
              setIsOfflineAndNoCache(true);
              setLoading(false);
              setInitialized(true);
              setDataReady(true);
              return;
            } else {
              // Use first subject as placeholder label; fall back to stage title
              // Use the most specific subject name available (not a checklist item)
              const placeholderLabel = stageSubjects.find(s => s.length < 30) || stageSubjects[0] || stage.title || 'Foundations';
              cached = getLocalResourcesPlaceholder(currentUser.dream || 'Professional', placeholderLabel);
              rm = { ...rm, cachedResources: cached };
              await dbService.saveRoadmap(currentUser, rm);
            }
          }
        }
      }

      setRoadmap({ ...rm });
      // Set data and mark as ready in a single batch — prevents partial render with empty data
      setData(cached as ResourceData);
      setDataReady(true);
    } catch (e) {
      console.error('fetchCurriculum error:', e);
      setLoadError(true);
      setDataReady(true); // show error state even on failure
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [user.currentStageIndex, user.id, user.dream, user.year, user.branch]);

  useEffect(() => {
    let active = true;
    // Safety timeout: if fetch hangs for 15s, force show the UI with what we have
    const timeout = setTimeout(() => {
      if (active && !initialized) {
        setInitialized(true);
        setDataReady(true);
        setLoading(false);
        console.warn('[Resources] Init timeout hit — showing UI with available data');
      }
    }, 15000);
    if (active) fetchCurriculum();
    return () => { active = false; clearTimeout(timeout); };
  }, [fetchCurriculum]);

  // ── Load next batch — REPLACES current data with fresh resources ─────────────
  const loadNextBatch = useCallback(async () => {
    if (!roadmap || !Array.isArray(roadmap.stages) || roadmap.stages.length === 0) return;
    setLoading(true);
    const currentUser = userRef.current;

    const stageIdx = Math.min(currentUser.currentStageIndex ?? 0, roadmap.stages.length - 1);
    const stage = roadmap.stages[stageIdx];
    if (!stage) {
      setLoading(false);
      return;
    }

    // Use all stage subjects for context; rotate through subjects for variety on each Load More click
    // getStageSubjects prefers stage.subjects (clean topic names) over checklist-style concepts
    const subjects = getStageSubjects(stage);
    const loadCount = (roadmap as any)._loadMoreCount || 0;
    // Rotate which subject is in position 0 so each Load More click surfaces different subjects first
    const rotatedSubjects = subjects.length > 1
      ? [...subjects.slice(loadCount % subjects.length), ...subjects.slice(0, loadCount % subjects.length)]
      : subjects;

    try {
      // Pass '' as stageTopic so only subjects drive the query — no stage title pollution
      const fetched = await fetchDirectResources(
        currentUser.dream, '', rotatedSubjects, currentUser.year, 0
      );

      // Sort results so stage-subject matches appear first (most relevant first)
      const stageSubjectsLower = subjects.map((s: string) => s.toLowerCase());
      const scoreItem = (title: string) => {
        const t = title.toLowerCase();
        return stageSubjectsLower.some(s => t.includes(s)) ? 0 : 1;
      };

      // REPLACE (not append) — show fresh unique set of 10 per category, sorted by relevance
      const freshData = {
        books:  fetched.books.filter((b: any)  => b.link?.startsWith('http')).sort((a: any, b: any) => scoreItem(a.title) - scoreItem(b.title)).slice(0, 10),
        videos: fetched.videos.filter((v: any) => v.link?.startsWith('http')).sort((a: any, b: any) => scoreItem(a.title) - scoreItem(b.title)).slice(0, 10),
        papers: fetched.papers.filter((p: any) => p.link?.startsWith('http')).sort((a: any, b: any) => scoreItem(a.title) - scoreItem(b.title)).slice(0, 10),
        news:   fetched.news.filter((n: any)   => n.link?.startsWith('http')).slice(0, 10),
        cachedForDream: currentUser.dream,
        cachedForStage: stageIdx,
        cachedSubjects: subjects,
      };

      const updatedRm = { ...roadmap, cachedResources: freshData as any, _loadMoreCount: loadCount + 1 };
      await dbService.saveRoadmap(currentUser, updatedRm);
      setRoadmap(updatedRm);
      setData(freshData as ResourceData);
    } catch (e) {
      console.error('loadNextBatch error:', e);
    } finally {
      setLoading(false);
    }
  }, [roadmap]);

  // ── Search ────────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) { setSearchMode(false); return; }
    setIsSearching(true);
    setSearchMode(true);
    try {
      // Pass user.dream so news results stay career-relevant even for technical queries
      const results = await searchAllResources(q, user.dream || '');
      setSearchResults(results);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchMode(false);
    setSearchResults({ books: [], videos: [], papers: [], news: [] });
  };

  const displayed = searchMode ? searchResults : data;

  // ── Loading state ────────────────────────────────────────────────────────────
  // Show full-screen loader until BOTH initialized AND dataReady — prevents the single-book flash
  if (!initialized || !dataReady) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center fade-up gap-4">
        <Loader2 className="animate-spin text-gold-400" size={28} />
        <p className="text-sm text-gold-500/40">Preparing your study center...</p>
        <p className="text-xs text-gold-500/25">Fetching resources for your current stage...</p>
      </div>
    );
  }

  // ── Error state (roadmap completely unavailable) ──────────────────────────────
  if (loadError && !roadmap) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center fade-up gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(255,140,66,0.08)', border: '1px solid rgba(255,140,66,0.22)' }}>
          <AlertCircle size={24} className="text-gold-500/40" />
        </div>
        <p className="text-sm text-gold-300/60 font-medium">Couldn't load your study plan</p>
        <p className="text-xs text-gold-500/35">Generate your roadmap first, then come back here</p>
        <button onClick={fetchCurriculum} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium">
          <RefreshCw size={14} /> Try Again
        </button>
      </div>
    );
  }

  // ── Offline and no cache ──────────────────────────────────────────────────
  if (isOfflineAndNoCache) {
    const currentStageIndex = Math.min(user.currentStageIndex, (roadmap?.stages.length || 1) - 1);
    const currentStage = roadmap?.stages[currentStageIndex];
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center fade-up gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse"
          style={{ background: 'rgba(255,140,66,0.08)', border: '1px solid rgba(255,140,66,0.22)' }}>
          <AlertCircle size={24} className="text-orange-400" />
        </div>
        <p className="text-sm text-gold-300 font-medium">No Internet Connection</p>
        <p className="text-xs text-gold-500/50 max-w-xs">
          Connect to the internet to load resources for <span className="text-purple-400 font-semibold">{currentStage?.title || 'this stage'}</span>.
        </p>
        <button onClick={fetchCurriculum} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  // ── No roadmap (use fallback) ─────────────────────────────────────────────────
  if (!roadmap || !roadmap.stages || roadmap.stages.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center fade-up gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(255,140,66,0.08)', border: '1px solid rgba(255,140,66,0.22)' }}>
          <BookOpen size={24} className="text-gold-400" />
        </div>
        <p className="text-sm text-gold-300 font-medium">No Roadmap Yet</p>
        <p className="text-xs text-gold-500/50 max-w-xs">
          Generate your personalized career roadmap first to unlock structured study resources.
        </p>
        <button 
          onClick={() => navigate('/roadmap')} 
          className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-gold-600 to-orange-600 hover:from-gold-500 hover:to-orange-500 transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)]"
        >
          Generate Roadmap
        </button>
      </div>
    );
  }

  const currentStageIndex = Math.min(user.currentStageIndex, (roadmap?.stages.length || 1) - 1);
  const currentStage = roadmap?.stages[currentStageIndex];

  const currentTabData: Record<string, any[]> = {
    books:  displayed.books || [],
    videos: displayed.videos || [],
    papers: displayed.papers || [],
    news:   displayed.news || [],
    'watch-later': roadmap?.watchLater || [],
    playlists: roadmap?.playlists || [],
  };

  // If everything is truly empty after a successful fetch, show an empty state
  const totalItems = (displayed.books?.length || 0) + (displayed.videos?.length || 0) + (displayed.papers?.length || 0) + (displayed.news?.length || 0);
  // NOTE: We intentionally do NOT inject fake single-book fallbacks here.
  // The full-screen loader (above) prevents the user from seeing an empty state mid-fetch.
  // When totalItems is 0, we'll show an inline empty state in the tab content instead.

  return (
    <div className="space-y-6 fade-up">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gold-500/40 font-semibold uppercase tracking-wider mb-1">
            Step {currentStageIndex + 1} · Study Hub
          </p>
          <h2 className="heading-gold font-cinzel text-2xl font-bold">
            {searchMode ? 'Search Results' : (currentStage?.title || 'Study Center')}
          </h2>
          <p className="text-xs text-gold-500/45 mt-1">
            {searchMode
              ? `Showing results for "${searchQuery}"`
              : (
                <>
                  Resources for{' '}
                  <span className="text-gold-400">
                    {currentStage?.subjects?.length
                      ? currentStage.subjects.slice(0, 3).join(', ')
                      : user.dream}
                  </span>
                </>
              )
            }
          </p>
        </div>

        {/* Stats chips */}
        {!searchMode && (
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'Books',  count: data.books.length,  color: '#f59e0b' },
              { label: 'Videos', count: data.videos.length, color: '#ef4444' },
              { label: 'Papers', count: data.papers.length, color: '#f97316' },
              { label: 'News',   count: data.news.length,   color: '#10b981' },
            ].map(s => (
              <div key={s.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: `${s.color}14`, border: `1px solid ${s.color}35`, color: s.color }}
              >
                <span>{s.count}</span>
                <span className="opacity-70">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Search Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div
          className="resource-search-bar flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{ background: 'rgba(6,3,18,0.45)', border: '1px solid rgba(255,140,66,0.22)' }}
        >
          <Search size={15} className="text-gold-500/40 shrink-0" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search books, videos, papers, news…"
            className="resource-search-input flex-1 bg-transparent text-sm text-gold-200 placeholder-gold-500/30 outline-none"
          />
          {searchQuery && (
            <button onClick={clearSearch} className="text-gold-500/40 hover:text-gold-300 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="btn-primary flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
          {searchMode && (
            <button
              onClick={clearSearch}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'rgba(255,140,66,0.08)', border: '1px solid rgba(255,140,66,0.22)', color: '#ff8c42' }}
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div
        className="resource-tab-bar flex items-center gap-1 p-1 rounded-xl overflow-x-auto no-scrollbar"
        style={{ background: 'rgba(6,3,18,0.4)', border: '1px solid rgba(255,140,66,0.15)' }}
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`resource-tab-btn flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-1 justify-center ${
              activeTab === tab.key ? 'resource-tab-active' : 'resource-tab-inactive'
            }`}
            style={activeTab === tab.key ? {
              background: `${tab.color}1a`,
              border: `1px solid ${tab.color}44`,
              color: tab.color,
            } : {
              border: '1px solid transparent',
              color: 'rgba(255,200,100,0.45)',
            }}
          >
            <tab.icon size={13} />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            {currentTabData[tab.key]?.length > 0 && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                style={{ background: `${tab.color}25`, color: tab.color }}
              >
                {currentTabData[tab.key].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {isSearching ? (
        <div className="h-40 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-gold-400" size={24} />
          <p className="text-xs text-gold-500/40">Searching across all sources…</p>
        </div>
      ) : (
        <div className="space-y-0">
          {activeTab === 'books' && (
            <div className="space-y-8">
              <ScrollRow
                title="Books" icon={Library} iconColor="text-amber-400"
                items={displayed.books}
                renderCard={(item, i) => <div key={i} className="relative group"><BookCard item={item} /><ResourceActions item={item} roadmap={roadmap!} onUpdate={updateRoadmap} /></div>}
                emptyMsg="No books found for this topic"
              />
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="space-y-8">
              <ScrollRow
                title="Video Lectures" icon={GraduationCap} iconColor="text-red-400"
                items={displayed.videos}
                renderCard={(item, i) => <div key={i} className="relative group"><VideoCard item={item} /><ResourceActions item={item} roadmap={roadmap!} onUpdate={updateRoadmap} /></div>}
                emptyMsg="No video lectures found"
              />
            </div>
          )}

          {activeTab === 'papers' && (
            <div className="space-y-8">
              <ScrollRow
                title="Research Papers" icon={Atom} iconColor="text-orange-400"
                items={displayed.papers}
                renderCard={(item, i) => <div key={i} className="relative group"><PaperCard item={item} /><ResourceActions item={item} roadmap={roadmap!} onUpdate={updateRoadmap} /></div>}
                emptyMsg="No research papers found"
              />
            </div>
          )}



          {activeTab === 'watch-later' && (
            <div className="space-y-8">
              <ScrollRow
                title="Watch Later" icon={Bookmark} iconColor="text-blue-400"
                items={roadmap?.watchLater || []}
                renderCard={(item, i) => {
                  let CardType: any = BookCard;
                  const isVideo = item.type === 'video' || (item.source && ['youtube', 'khan-academy', 'mit-ocw'].includes(item.source)) || item.channel || item.link?.includes('youtube');
                  const isPaper = item.type === 'paper' || (item.source && ['arxiv', 'semantic-scholar'].includes(item.source)) || (item.authors && item.publishedYear);
                  const isNews = item.type === 'news' || (item.source && !['google-books', 'open-library', 'gutendex', 'youtube', 'khan-academy', 'mit-ocw', 'arxiv', 'semantic-scholar'].includes(item.source)) || item.imageUrl || item.link?.includes('news');
                  
                  if (isVideo) CardType = VideoCard;
                  else if (isPaper) CardType = PaperCard;
                  else if (isNews) CardType = NewsCard;
                  return (
                          <div key={i} className="relative group">
                            <CardType item={item} />
                            <div className="absolute top-2 left-2 z-10 pointer-events-none">
                              <span className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md bg-black/60 text-white backdrop-blur border border-white/10 shadow-lg" style={{ color: CardType === BookCard ? '#f59e0b' : CardType === VideoCard ? '#ef4444' : CardType === PaperCard ? '#f97316' : '#10b981' }}>
                                {CardType === BookCard ? 'Book' : CardType === VideoCard ? 'Video' : CardType === PaperCard ? 'Paper' : 'News'}
                              </span>
                            </div>
                            <ResourceActions item={item} roadmap={roadmap!} onUpdate={updateRoadmap} />
                          </div>
                        );
                }}
                emptyMsg="No items in Watch Later"
              />
            </div>
          )}


          {activeTab === 'playlists' && (
            <div className="space-y-8">
              {!activePlaylistId ? (
                <>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl playlist-header-bg" style={{ background: isLight ? 'rgba(255,255,255,0.45)' : 'rgba(6,3,18,0.4)', border: isLight ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(168,85,247,0.2)' }}>
                    <div>
                      <h3 className={`text-sm font-semibold ${isLight ? 'text-purple-700' : 'text-purple-300'}`}>Your Playlists</h3>
                      <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-gold-500/50'}`}>Organize resources into custom collections</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <input 
                        type="text" 
                        placeholder="New playlist name..." 
                        id="newPlaylistNameInput"
                        className={`flex-1 min-w-0 sm:w-48 text-sm px-3 py-2 rounded-lg border outline-none transition-colors ${isLight ? 'bg-white text-slate-800 border-slate-350 focus:border-purple-500' : 'bg-black/20 text-gold-200 border-white/10 focus:border-purple-400/50'}`}
                      />
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          const inp = document.getElementById('newPlaylistNameInput') as HTMLInputElement;
                          if (!inp || !inp.value.trim()) return;
                          const rm = { ...roadmap! };
                          if (!rm.playlists) rm.playlists = [];
                          rm.playlists.push({ id: Date.now().toString(), name: inp.value.trim(), items: [] });
                          updateRoadmap(rm);
                          inp.value = '';
                        }}
                        className="btn-primary flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-500 flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)', boxShadow: '0 4px 14px rgba(124,58,237,0.40)', color: '#fff' }}
                      >
                        <Plus size={16} /> Create
                      </button>
                    </div>
                  </div>

                  {(!roadmap?.playlists || roadmap.playlists.length === 0) ? (
                    <div className={`flex flex-col items-center justify-center py-10 rounded-2xl border gap-3 ${isLight ? 'border-slate-200 bg-black/5' : 'border-white/5 bg-white/5'}`}>
                      <ListVideo size={32} className={isLight ? 'text-slate-400' : 'text-gold-500/30'} />
                      <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gold-500/50'}`}>No playlists yet. Add resources to playlists first.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {roadmap.playlists.map(pl => {
                        const firstItem = pl.items[0];
                        const thumbnail = firstItem?.thumbnail || firstItem?.imageUrl;
                        const plBg = isLight ? 'rgba(255, 255, 255, 0.55)' : 'rgba(30, 20, 45, 0.4)';
                        const plBorder = isLight ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255, 255, 255, 0.08)';
                        const plCoverBg = isLight ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(147, 51, 234, 0.05) 100%)' : 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(0, 0, 0, 0.4) 100%)';
                        
                        return (
                          <div 
                            key={pl.id} 
                            onClick={() => setActivePlaylistId(pl.id)}
                            className={`group relative cursor-pointer rounded-xl overflow-hidden border hover:border-purple-500/50 transition-all hover:scale-[1.03] duration-300 flex flex-col h-[180px]`}
                            style={{ background: plBg, borderColor: plBorder, backdropFilter: 'blur(10px)' }}
                          >
                            {/* YouTube style playlist stacked cover */}
                            <div className="relative h-[110px] w-full flex items-center justify-center overflow-hidden border-b border-black/10" style={{ background: plCoverBg }}>
                              {thumbnail ? (
                                <img src={thumbnail} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <Folder size={36} className="text-purple-500/60 group-hover:text-purple-400 transition-colors" />
                              )}
                              
                              {/* Overlay showing count / list icon */}
                              <div className="absolute inset-y-0 right-0 w-1/3 flex flex-col items-center justify-center border-l border-white/10" style={{ background: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(4px)' }}>
                                <ListVideo size={18} className="text-purple-500 mb-1" />
                                <span className={`text-xs font-bold ${isLight ? 'text-purple-600' : 'text-white'}`}>{pl.items.length}</span>
                                <span className={`text-[9px] uppercase tracking-wider mt-0.5 ${isLight ? 'text-purple-500/70' : 'text-white/60'}`}>items</span>
                              </div>
                            </div>

                            {/* Playlist Name and Info */}
                            <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
                              <div className="flex items-start justify-between gap-1.5 min-w-0">
                                <h4 className={`text-xs font-semibold line-clamp-2 group-hover:text-purple-500 transition-colors leading-tight min-w-0 ${isLight ? 'text-slate-800' : 'text-gold-200'}`}>
                                  {pl.name}
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (confirm(`Are you sure you want to delete the playlist "${pl.name}"?`)) {
                                      const rm = { ...roadmap! };
                                      rm.playlists = rm.playlists!.filter(p => p.id !== pl.id);
                                      updateRoadmap(rm);
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-red-400 border border-white/5 hover:border-red-500/20 transition-all shadow-md shrink-0"
                                  title="Delete Playlist"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-gold-500/40'}`}>Playlist</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (() => {
                const pl = roadmap?.playlists?.find(p => p.id === activePlaylistId);
                if (!pl) {
                  setActivePlaylistId(null);
                  return null;
                }
                return (
                  <div className="space-y-6">
                    {/* Header with back button */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setActivePlaylistId(null)}
                          className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${isLight ? 'bg-black/5 hover:bg-black/10 text-slate-800 border-slate-200' : 'bg-white/5 hover:bg-white/10 text-gold-200 border-white/10'}`}
                        >
                          <ChevronLeft size={14} /> Back
                        </button>
                        <div>
                          <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-purple-300'}`}>
                            <FolderOpen size={18} className="text-purple-400" />
                            {pl.name}
                          </h3>
                          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-gold-500/50'}`}>{pl.items.length} resources inside</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (confirm(`Are you sure you want to delete the playlist "${pl.name}"?`)) {
                            const rm = { ...roadmap! };
                            rm.playlists = rm.playlists!.filter(p => p.id !== pl.id);
                            updateRoadmap(rm);
                            setActivePlaylistId(null);
                          }
                        }}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 transition-all"
                      >
                        <Trash2 size={13} /> Delete Playlist
                      </button>
                    </div>

                    {pl.items.length === 0 ? (
                      <div className={`flex flex-col items-center justify-center py-14 rounded-2xl border border-dashed gap-3 ${isLight ? 'border-slate-300 bg-black/5' : 'border-white/10 bg-white/5'}`}>
                        <FolderPlus size={32} className={isLight ? 'text-slate-400' : 'text-gold-500/20'} />
                        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gold-500/40'}`}>This playlist is empty.</p>
                        <button 
                          onClick={() => setActivePlaylistId(null)}
                          className="text-xs text-purple-400 hover:underline"
                        >
                          Browse resources to add
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {pl.items.map((item, i) => {
                          let CardType: any = BookCard;
                          const isVideo = item.type === 'video' || (item.source && ['youtube', 'khan-academy', 'mit-ocw'].includes(item.source)) || item.channel || item.link?.includes('youtube');
                          const isPaper = item.type === 'paper' || (item.source && ['arxiv', 'semantic-scholar'].includes(item.source)) || (item.authors && item.publishedYear);
                          const isNews = item.type === 'news' || (item.source && !['google-books', 'open-library', 'gutendex', 'youtube', 'khan-academy', 'mit-ocw', 'arxiv', 'semantic-scholar'].includes(item.source)) || item.imageUrl || item.link?.includes('news');
                          
                          if (isVideo) CardType = VideoCard;
                          else if (isPaper) CardType = PaperCard;
                          else if (isNews) CardType = NewsCard;

                          return (
                            <div key={i} className="relative group">
                              <CardType item={item} />
                              <div className="absolute top-2 left-2 z-10 pointer-events-none">
                                <span className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md bg-black/60 text-white backdrop-blur border border-white/10 shadow-lg" style={{ color: CardType === BookCard ? '#f59e0b' : CardType === VideoCard ? '#ef4444' : CardType === PaperCard ? '#f97316' : '#10b981' }}>
                                  {CardType === BookCard ? 'Book' : CardType === VideoCard ? 'Video' : CardType === PaperCard ? 'Paper' : 'News'}
                                </span>
                              </div>
                              <div className="absolute top-2 right-2 flex gap-1 z-10">
                                <button 
                                  onClick={(e) => { 
                                    e.preventDefault(); 
                                    const rm = {...roadmap!}; 
                                    const targetPl = rm.playlists!.find(p => p.id === pl.id);
                                    if (targetPl) { 
                                      targetPl.items = targetPl.items.filter(x => x.link !== item.link); 
                                      updateRoadmap(rm); 
                                    }
                                  }}
                                  className="w-8 h-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 text-white border border-white/20 shadow-lg backdrop-blur"
                                  title="Remove from Playlist"
                                >
                                  <Trash2 size={12} className="text-red-400" />
                                </button>
                                <ResourceActions item={item} roadmap={roadmap!} onUpdate={updateRoadmap} inStack={true} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'news' && (
            <div className="space-y-8">
              <ScrollRow
                title="Industry News" icon={Rss} iconColor="text-emerald-400"
                items={displayed.news}
                renderCard={(item, i) => <div key={i} className="relative group"><NewsCard item={item} /><ResourceActions item={item} roadmap={roadmap!} onUpdate={updateRoadmap} /></div>}
                emptyMsg="No news articles found"
              />
            </div>
          )}
        </div>
      )}


      {/* ── Load Next Batch ── */}
      {!searchMode && (
        <div className="flex flex-col items-center gap-3 pt-2">
          {/* When no resources are found after loading, show a helpful message */}
          {totalItems === 0 && !loading && (
            <div className="text-center space-y-1 mb-2">
              <p className="text-sm text-gold-400/70">No resources found for this stage.</p>
              <p className="text-xs text-gold-500/40">Click below to fetch resources for your current roadmap stage subjects.</p>
            </div>
          )}
          <button
            onClick={loadNextBatch}
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Fetching Resources…' : 'Load New Resources'}
          </button>
          {!loading && currentStage && (
            <p className="text-[10px] text-gold-500/30 text-center">
              Fetching from: <span className="text-gold-400/50">{(currentStage.subjects || []).slice(0, 3).join(' · ')}</span>
            </p>
          )}
        </div>
      )}

      {/* ── Source Credits ── */}
      <div
        className="rounded-xl p-4 flex flex-wrap gap-3 items-center"
        style={{ 
          background: isLight ? 'rgba(211,156,59,0.05)' : 'rgba(6,3,18,0.25)', 
          border: isLight ? '1px solid rgba(211,156,59,0.2)' : '1px solid rgba(255,140,66,0.10)' 
        }}
      >
        <p className={`text-[10px] font-medium uppercase tracking-wider ${isLight ? 'text-amber-700/80' : 'text-gold-500/30'}`}>Powered by:</p>
        {[
          'Google Books', 'Open Library', 'Project Gutenberg',
          'YouTube', 'Khan Academy', 'MIT OCW',
          'arXiv', 'Semantic Scholar',
          'NewsData.io', 'GNews', 'New York Times', 'Currents',
        ].map(src => (
          <span key={src} className={`text-[10px] font-medium ${isLight ? 'text-amber-900/60' : 'text-gold-500/25'}`}>{src}</span>
        ))}
      </div>
    </div>
  );
}
