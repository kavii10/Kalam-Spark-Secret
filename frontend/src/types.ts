
export interface RoadmapStage {
  id: string;
  title: string;
  description: string;
  duration: string;
  subjects: string[];
  skills: string[];
  projects: string[];
  resources: {
    type: 'book' | 'video' | 'article';
    title: string;
    link?: string;
  }[];
}

export interface Playlist {
  id: string;
  name: string;
  items: any[];
}

export interface StageCache {
  books: any[];
  videos: any[];
  papers: any[];
  news: any[];
  cachedForDream?: string;
  cachedForStage?: number;
  resourceOffset?: number;
}

export interface CareerRoadmap {
  dream: string;
  summary: string;
  stages: RoadmapStage[];
  resourceOffset?: number;
  cachedResources?: StageCache & { cachedForDream?: string };
  /** Per-stage resource caches keyed by stage index */
  stageCaches?: Record<number, StageCache>;
  watchLater?: any[];
  playlists?: Playlist[];
}

export interface DailyTask {
  id: string;
  title: string;
  type: 'theory' | 'hands-on' | 'review' | 'current-affairs';
  completed: boolean;
  date: string;
  linkedSubject?: string;
}

/** A reward badge earned by the user */
export interface Reward {
  id: string;
  type: 'stage_complete' | 'daily_tasks_complete' | 'perfect_quiz' | 'streak_milestone' | 'first_roadmap' | 'custom';
  title: string;
  description: string;
  icon: string;          // emoji or icon name
  earnedAt: string;      // ISO date string
  xpValue: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;

  // ─── Education Context (for accurate roadmap generation) ───────────────────
  branch: string;            // favourite subject / field
  year: string;              // label like "10th Grade", "2nd Year B.Tech", etc.
  educationLevel: 'school' | 'college' | 'graduate' | 'self-learner' | '';
  schoolBoard?: string;      // CBSE | State Board | ICSE | IB | Other
  gradeOrSemester?: string;  // "Grade 10" | "Semester 3" etc.
  collegeName?: string;
  studyHoursPerDay?: number; // 1–8
  targetYear?: string;       // "2026", "2027" — when they aim to achieve goal
  city?: string;             // helps localise opportunities
  motivation?: string;       // "to serve the nation", "financial freedom" etc.

  dream: string;
  currentStageIndex: number;
  onboardingComplete: boolean;
  isAuthenticated: boolean;
  lastSync?: string;
  lastTaskResetDate?: string;
  xp: number;
  streak: number;
  rewards?: Reward[];
  settings?: {
    theme: 'dark' | 'light';
    hasManualTheme?: boolean;
    autoScheduleRevisions: boolean;
    notificationsEnabled: boolean;
    soundEnabled: boolean;
  };
  /** Cross-device sync for FileSpeaker / Radar sources */
  fileSpeakerData?: {
    sources: any[];
    activeId: string | null;
    states: Record<string, any>;
    checked: string[];
  };
}

export interface HeroStory {
  name: string;
  role: string;
  achievement: string;
  summary: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}
