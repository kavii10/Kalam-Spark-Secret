export type LangCode = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml';

export const LANGUAGES: { code: LangCode; label: string; nativeLabel: string; flag: string }[] = [
  { code: 'en', label: 'English',    nativeLabel: 'English',     flag: '🇬🇧' },
];

export type TranslationKey =
  // Nav
  | 'nav_dashboard' | 'nav_roadmap' | 'nav_planner' | 'nav_resources'
  | 'nav_revision' | 'nav_competitions' | 'nav_mentor' | 'nav_filespeaker' | 'nav_logout'
  // Dashboard
  | 'dash_welcome_back' | 'dash_working_towards' | 'dash_refresh'
  | 'dash_level' | 'dash_streak' | 'dash_stage' | 'dash_progress'
  | 'dash_daily_inspiration' | 'dash_todays_tasks' | 'dash_study_center'
  | 'dash_ask_mentor' | 'dash_roadmap_progress' | 'dash_view_plan'
  | 'dash_rewards' | 'dash_no_rewards' | 'dash_rewards_earn_hint'
  // Onboarding
  | 'ob_setup_journey' | 'ob_whats_name' | 'ob_your_background'
  | 'ob_education_level' | 'ob_choose_level' | 'ob_middle_school'
  | 'ob_high_school' | 'ob_college' | 'ob_self_learner' | 'ob_graduate'
  | 'ob_school_board' | 'ob_choose_board' | 'ob_grade_semester'
  | 'ob_enter_grade' | 'ob_study_field' | 'ob_field_placeholder'
  | 'ob_city' | 'ob_city_placeholder' | 'ob_study_hours' | 'ob_target_year'
  | 'ob_target_year_placeholder' | 'ob_motivation' | 'ob_motivation_placeholder'
  | 'ob_dream_career' | 'ob_dream_placeholder' | 'ob_not_sure'
  | 'ob_career_summary' | 'ob_about_your_career' | 'ob_you_are_all_set'
  | 'ob_continue' | 'ob_back' | 'ob_step_of' | 'ob_build_roadmap'
  | 'ob_view_roadmap'
  // Planner
  | 'pl_todays_tasks' | 'pl_sync_roadmap' | 'pl_add_task' | 'pl_no_tasks'
  | 'pl_completed' | 'pl_all_done' | 'pl_quiz_tab' | 'pl_tasks_tab'
  // Login
  | 'login_title' | 'login_subtitle' | 'login_email' | 'login_name'
  | 'login_sign_in' | 'login_register' | 'login_sign_in_btn' | 'login_create_btn'
  | 'login_google' | 'login_or' | 'login_cross_device' | 'login_restoring' | 'login_creating'
  // General
  | 'days' | 'of' | 'complete';

type Translations = Record<TranslationKey, string>;

const en: Translations = {
  nav_dashboard: 'Dashboard', nav_roadmap: 'Roadmap', nav_planner: 'Planner',
  nav_resources: 'Resources', nav_revision: 'Revision', nav_competitions: 'Competitions',
  nav_mentor: 'AI Mentor', nav_filespeaker: 'File Speaker', nav_logout: 'Log Out',
  dash_welcome_back: 'Welcome back,', dash_working_towards: 'Working towards',
  dash_refresh: 'Refresh', dash_level: 'Level', dash_streak: 'Streak',
  dash_stage: 'Stage', dash_progress: 'Progress', dash_daily_inspiration: 'Daily Inspiration',
  dash_todays_tasks: "Today's Tasks", dash_study_center: 'Study Center',
  dash_ask_mentor: 'Ask AI Mentor', dash_roadmap_progress: 'Roadmap Progress',
  dash_view_plan: 'View Plan →', dash_rewards: 'My Rewards',
  dash_no_rewards: 'No rewards yet — complete tasks, stages, and quizzes to earn badges!',
  dash_rewards_earn_hint: 'Keep going to earn your first badge!',
  ob_setup_journey: "Let's set up your journey", ob_whats_name: "What's your name?",
  ob_your_background: 'Your background', ob_education_level: 'Education level',
  ob_choose_level: 'Choose your level...', ob_middle_school: 'Middle School (Class 6–8)',
  ob_high_school: 'High School (Class 9–12)', ob_college: 'Under-Graduate',
  ob_self_learner: 'Self-Learner / Working', ob_graduate: 'Post-Graduate',
  ob_school_board: 'School Board', ob_choose_board: 'Choose board...',
  ob_grade_semester: 'Class / Year / Semester', ob_enter_grade: 'e.g. Class 10, 2nd Year B.Tech...',
  ob_study_field: 'Favourite subject / stream', ob_field_placeholder: 'e.g. Science, Maths, Arts...',
  ob_city: 'Your city (optional)', ob_city_placeholder: 'e.g. Chennai, Delhi...',
  ob_study_hours: 'Study hours available per day',
  ob_target_year: 'Target year to achieve your goal', ob_target_year_placeholder: 'e.g. 2026, 2027...',
  ob_motivation: 'Why do you want this career? (optional)', ob_motivation_placeholder: 'e.g. to serve the nation, financial freedom...',
  ob_dream_career: 'Your dream career', ob_dream_placeholder: 'e.g. IAS Officer, Doctor, Engineer...',
  ob_not_sure: 'Not sure? Take the Dream Discovery Quiz',
  ob_career_summary: 'About Your Dream Career', ob_about_your_career: "Here's what it means to be a",
  ob_you_are_all_set: "You're all set!", ob_continue: 'Continue',
  ob_back: 'Back', ob_step_of: 'Step', ob_build_roadmap: 'Accept & Build Roadmap',
  ob_view_roadmap: 'View My Roadmap',
  pl_todays_tasks: "Today's Tasks", pl_sync_roadmap: 'Sync Roadmap',
  pl_add_task: 'Add task...', pl_no_tasks: 'No tasks yet — press Sync Roadmap',
  pl_completed: 'Completed', pl_all_done: 'All done for today! 🎉',
  pl_quiz_tab: 'Quiz', pl_tasks_tab: 'Tasks',
  login_title: 'Kalam Spark', login_subtitle: 'AI Career Architect',
  login_email: 'your@email.com', login_name: 'Your name',
  login_sign_in: 'Sign In', login_register: 'Register',
  login_sign_in_btn: 'Sign In & Sync', login_create_btn: 'Create Account',
  login_google: 'Continue with Google', login_or: 'or',
  login_cross_device: 'Cross-device sync • No password needed',
  login_restoring: 'Restoring Session...', login_creating: 'Creating Account...',
  days: 'days', of: 'of', complete: 'complete',
};

const TRANSLATIONS: Record<LangCode, Translations> = { 
  en, ta: en, hi: en, te: en, kn: en, ml: en 
};

const LANG_KEY = 'ks_lang';

export function getCurrentLang(): LangCode {
  return 'en';
}

export function setCurrentLang(lang: LangCode): void {
  localStorage.setItem(LANG_KEY, 'en');
}

export function t(key: TranslationKey, lang?: LangCode): string {
  return en[key] || key;
}
