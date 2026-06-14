import React, { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
  useNavigate,
  useNavigationType,
} from "react-router-dom";
import {
  LayoutDashboard,
  Map as MapIcon,
  Calendar,
  BookOpen,
  MessageSquare,
  Menu,
  X,
  LogOut,
  Trophy,
  Bird,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Settings,
  RotateCcw,
  Compass,
  Radio,
  Volume2,
  Download,
  Smartphone,
} from "lucide-react";

import Dashboard from "./views/Dashboard";
import RoadmapView from "./views/RoadmapView";
import Planner from "./views/Planner";
import Resources from "./views/Resources";
import MentorChat from "./views/MentorChat";
import Onboarding from "./views/Onboarding";
import PomodoroTimer from "./views/PomodoroTimer";
import RevisionEngine from "./views/RevisionEngine";
import CareerPivot from "./views/CareerPivot";
import Opportunities from "./views/Opportunities";
import FileSpeaker from "./views/FileSpeaker";
import LoginScreen from "./views/LoginScreen";
import { UserProfile, Reward, CareerRoadmap } from "./types";
import { dbService } from './services/dbService';
import { supabase } from './services/supabaseClient';
import { getCurrentLang, type LangCode } from "./i18n";
import { rewardEvents } from './services/rewardService';
import { offlineSyncService } from './services/offlineSyncService';
import { networkService } from './services/networkService';
import { localDB } from './services/localDB';
import { Capacitor } from '@capacitor/core';
import { llamaPlugin } from './services/llamaPlugin';
import { notificationService } from './services/notificationService';


const LIGHT_THEME_CSS = `
  html, body { background-color: #faf7f2 !important; color: #1f2937 !important; color-scheme: light !important; }
  .bg-black { background-color: #ffffff !important; }
  .text-white { color: #111827 !important; }
  /* Force text colors to be dark and readable, ignoring Tailwind fractional opacities */
  [class*="text-gold-"] { color: #431407 !important; opacity: 0.9 !important; text-shadow: none !important; }
  [class*="text-gold-4"], [class*="text-gold-5"], [class*="text-gold-6"], [class*="text-orange-"] { color: #b45309 !important; opacity: 1 !important; text-shadow: none !important; }
  
  [class*="text-white"] { color: #111827 !important; opacity: 0.9 !important; text-shadow: none !important; }
  [class*="text-purple-"] { color: #5b21b6 !important; opacity: 0.9 !important; text-shadow: none !important; }

  /* Keep button text white */
  .btn-primary, .btn-primary * { color: #ffffff !important; }
  
  .border-gold-500\\/10, .border-gold-500\\/15, .border-gold-500\\/20, .border-gold-500\\/25, .border-gold-500\\/30, .border-orange-500\\/30, .border-purple-500\\/20 { border-color: rgba(217,119,6,0.15) !important; }
  
  .bg-black\\/20, .bg-black\\/40, .bg-black\\/60 { background-color: rgba(255,255,255,0.7) !important; box-shadow: 0 4px 15px rgba(0,0,0,0.02) !important; border: 1px solid rgba(217,119,6,0.1) !important; }
  
  .glass-card { 
    background: rgba(255,255,255,0.9) !important; 
    border-color: rgba(217,119,6,0.15) !important; 
    box-shadow: 0 10px 30px rgba(0,0,0,0.03), inset 0 2px 0 rgba(255,255,255,1) !important; 
    color: #1f2937 !important; 
  }
  .glass-sidebar { 
    background: rgba(255, 255, 255, 0.95) !important; 
    box-shadow: 0 4px 20px rgba(0,0,0,0.02) !important; 
    border-color: rgba(0,0,0,0.05) !important; 
  }
  .glass-header { 
    background: rgba(255, 255, 255, 0.98) !important; 
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.02) !important; 
    border-color: rgba(0,0,0,0.05) !important; 
    position: sticky !important;
    top: 0 !important;
    z-index: 50 !important;
    transform: translate3d(0, 0, 0) !important;
    -webkit-transform: translate3d(0, 0, 0) !important;
    backface-visibility: hidden !important;
    -webkit-backface-visibility: hidden !important;
  }
  @media (min-width: 1024px) {
    .glass-header {
      background: rgba(255, 255, 255, 0.90) !important;
      backdrop-filter: blur(24px) saturate(150%) !important;
      -webkit-backdrop-filter: blur(24px) saturate(150%) !important;
    }
  }
  
  .cosmic-bg { opacity: 0 !important; }
  .star-field { display: none !important; }
  .nebula-blob { opacity: 0.05 !important; filter: hue-rotate(180deg) brightness(0.5); }
  
  .text-purple-200, .text-purple-300, .text-purple-400 { color: #5b21b6 !important; }
  .bg-purple-900\\/10, .bg-purple-900\\/20, .bg-purple-900\\/25 { background-color: rgba(139,92,246,0.08) !important; }
  
  .heading-gold { 
    background: linear-gradient(135deg, #9a3412 0%, #ea580c 45%, #c2410c 100%) !important; 
    -webkit-background-clip: text !important; 
    background-clip: text !important; 
    color: transparent !important; 
    filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.1)) !important; 
  }
  
  .btn-primary {
    background: linear-gradient(135deg, #f97316 0%, #fb923c 60%, #fdba74 100%) !important;
    color: #fff !important;
    box-shadow: 0 4px 15px rgba(249,115,22,0.3) !important;
    border: none !important;
  }
  .btn-primary:hover {
    background: linear-gradient(135deg, #ea580c 0%, #f97316 60%, #fb923c 100%) !important;
  }
  
  .bg-gradient-to-br.from-purple-600\\/40.to-gold-600\\/20 {
    background: linear-gradient(to bottom right, rgba(139,92,246,0.1), rgba(245,158,11,0.1)) !important;
  }
  
  .rounded-xl[style*="rgba(6,3,18"], .rounded-2xl[style*="rgba(6,3,18"], .w-full[style*="rgba(10,15,35"] { 
    background: rgba(255,255,255,1) !important; 
    color: #1f2937 !important; 
    box-shadow: 0 20px 50px rgba(0,0,0,0.1) !important; 
    border: 1px solid rgba(0,0,0,0.1) !important;
  }
  div[style*="rgba(211,156,59,0.08)"] { background: rgba(217,119,6,0.03) !important; border-color: rgba(217,119,6,0.1) !important; }
  
  /* Settings and Task Inputs */
  .fixed.inset-0.bg-black\\/70 { background-color: rgba(0,0,0,0.4) !important; }
  .bg-black\\/40.border-gold-500\\/20.cursor-pointer { 
    background: #f8fafc !important; 
    border-color: #e2e8f0 !important; 
  }
  .bg-black\\/40.border-gold-500\\/20.cursor-pointer:hover { background: #f1f5f9 !important; }
  
  .settings-modal {
    background: #ffffff !important;
    border-color: #e2e8f0 !important;
    color: #1f2937 !important;
  }
  .settings-modal h2, .settings-modal p, .settings-modal span { color: #1f2937 !important; }
  .settings-modal .text-gold-100 { color: #111827 !important; }
  .settings-modal .text-gold-500\\/60 { color: #4b5563 !important; }

  .playlist-header-bg {
    background: #f8fafc !important;
    border-color: rgba(168,85,247,0.3) !important;
  }
  .playlist-empty-bg {
    background-color: #f8fafc !important; 
    border-color: #e2e8f0 !important; 
    color: #1f2937 !important;
  }
  
  .popover-menu {
    background-color: #ffffff !important; 
    box-shadow: 0 4px 20px rgba(0,0,0,0.1) !important; 
    border-color: #e2e8f0 !important; 
    color: #1f2937 !important;
  }
  .popover-menu button, .popover-menu p, .popover-menu span { color: #1f2937 !important; }
  .popover-menu button:hover { background-color: #f1f5f9 !important; }
  .popover-menu input { background-color: #ffffff !important; border-color: #cbd5e1 !important; color: #111827 !important; }
  
  .fs-tabs-container { background-color: #f8fafc !important; border-color: #e2e8f0 !important; }
  .fs-tab-inactive { color: #64748b !important; text-shadow: none !important; }
  .fs-tab-inactive:hover { color: #1f2937 !important; background-color: #e2e8f0 !important; }
  .fs-tab-active { background-color: #7c3aed !important; color: #ffffff !important; text-shadow: none !important; }
  .mentor-ai-avatar { background-color: #f1f5f9 !important; color: #7c3aed !important; }

  input[style*="background"] { 
    background: #ffffff !important; 
    border-color: #e2e8f0 !important; 
    color: #111827 !important; 
  }
  input::placeholder { color: #94a3b8 !important; }

  /* Resources & Flashcard Cards */
  [style*="rgba(6,3,18,0.45)"], [style*="rgba(6,3,18,0.6)"], [style*="rgba(6,3,18,0.50)"] {
    background: #ffffff !important;
    border-color: rgba(0,0,0,0.1) !important;
    box-shadow: 0 4px 15px rgba(0,0,0,0.03) !important;
  }
  [style*="rgba(255,140,66,0.05)"] { background: #fff7ed !important; }
  
  /* Flashcards Expansion Modal */
  .fixed.inset-0.bg-black\\/85 { background-color: rgba(255,255,255,0.85) !important; backdrop-filter: blur(12px) !important; }
  .max-w-3xl.rounded-3xl[style*="rgba(6,3,18"], .max-w-3xl.rounded-3xl[style*="rgba(16,8,30"] {
     background: #ffffff !important;
     border-color: #e2e8f0 !important;
     color: #111827 !important;
     box-shadow: 0 40px 100px rgba(0,0,0,0.1) !important;
  }
  .max-w-3xl .text-white\\/40 { color: #94a3b8 !important; }
  
  /* Mentor Chat Bubbles */
  div[style*="rgba(4,2,12,0.42)"] { background: #ffffff !important; border-left-color: #f1f5f9 !important; border-right-color: #f1f5f9 !important; }
  div[style*="rgba(255,140,66,0.12)"][style*="color: #ffb380"] { 
     background: #fff7ed !important; 
     border-color: #fdba74 !important; 
     color: #431407 !important; 
  }
  div[style*="rgba(6,3,18,0.60)"][style*="color: rgba(255,179,128"] { 
     background: #f8fafc !important; 
     border-color: #e2e8f0 !important; 
     color: #1f2937 !important; 
  }
  
  [style*="rgba(124,58,237,0.08)"] { 
    background: #f5f3ff !important; 
    border: 1px solid #ddd6fe !important; 
  }
  
  input[type="checkbox"].accent-gold-500 { accent-color: #ea580c !important; }
  
  .text-red-400[style*="border"] { 
    background: #fffafa !important; 
    border-color: #fecaca !important; 
    color: #ef4444 !important; 
  }
  .text-red-400[style*="border"]:hover { background: #fef2f2 !important; }


  /* Logo color adjust in light mode if needed */
  .filter.brightness-125 { filter: brightness(0.8) contrast(1.2) !important; }

  /* Additional fix for shadowed objects */
  .shadow-glow-gold, .shadow-glow-purple { box-shadow: none !important; }

  /* ── Planner / Task List light mode fixes ── */
  /* Task card background and text */
  [style*="rgba(6,3,18,0.45)"] h3, [style*="rgba(6,3,18,0.45)"] p,
  [style*="rgba(6,3,18,0.45)"] span:not(.text-orange-400):not(.text-purple-400):not(.text-gold-400) {
    color: #1f2937 !important;
  }
  /* Individual task rows */
  .glass-card p.text-gold-200, .glass-card p.text-gold-100,
  .glass-card span.text-gold-200, .glass-card span.text-gold-100,
  .glass-card h3.text-gold-100, .glass-card h4.text-gold-200 {
    color: #1f2937 !important;
  }
  /* Completed task text */
  .line-through { color: #6b7280 !important; }
  /* Task type labels (theory / hands-on / review) */
  .text-gold-500\\/50, .text-gold-500\\/40, .text-gold-500\\/60, .text-gold-400\\/50, .text-gold-400\\/60 {
    color: #6b7280 !important;
  }
  /* Task container cards */
  .glass-card .flex.items-center.gap-3.p-4,
  .glass-card .flex.items-start.gap-3.p-4 {
    background: rgba(249,250,251,0.8) !important;
    border-color: rgba(0,0,0,0.08) !important;
  }
  /* Hover state on tasks */
  .glass-card .flex.items-center.gap-3.p-4:hover {
    background: rgba(243,244,246,1) !important;
  }
  /* Sidebar stats cards in planner */
  .glass-card .bg-black\\/20 {
    background: rgba(249,250,251,0.9) !important;
    border-color: rgba(0,0,0,0.1) !important;
  }
  /* "How it works" info box */
  .glass-card .bg-white\\/5 {
    background: rgba(248,250,252,0.9) !important;
    border-color: rgba(0,0,0,0.08) !important;
    color: #374151 !important;
  }
  .text-gold-200\\/70 { color: #374151 !important; }
  .text-gold-200\\/60 { color: #4b5563 !important; }
  .text-gold-200\\/50 { color: #6b7280 !important; }
  .text-gold-300\\/40 { color: #9ca3af !important; }

  /* Study Centre / Resources cards */
  .resource-card {
    background: #ffffff !important;
    border: 1px solid #e2e8f0 !important;
    color: #1f2937 !important;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05) !important;
  }
  .resource-card:hover {
    border-color: #d1d5db !important;
    box-shadow: 0 8px 25px rgba(0,0,0,0.08) !important;
  }
  .resource-card-text {
    color: #1f2937 !important;
  }

  /* Resource tab bar wrapper */
  .resource-tab-bar {
    background: #f1f5f9 !important;
    border: 1px solid #e2e8f0 !important;
  }
  /* Inactive tab buttons — were near-invisible on white */
  .resource-tab-inactive {
    color: #64748b !important;
    border-color: transparent !important;
  }
  .resource-tab-inactive:hover {
    background: rgba(0,0,0,0.04) !important;
    color: #374151 !important;
  }
  .resource-tab-active {
    text-shadow: none !important;
  }

  /* Resource search bar */
  .resource-search-bar {
    background: #ffffff !important;
    border: 1px solid #d1d5db !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
  }
  .resource-search-input {
    color: #111827 !important;
  }
  .resource-search-input::placeholder {
    color: #9ca3af !important;
  }

  /* Source credits bar */
  [style*="rgba(6,3,18,0.25)"][style*="rgba(255,140,66,0.10)"] {
    background: #f8fafc !important;
    border-color: #e5e7eb !important;
  }
  /* Paper card header strip */
  [style*="rgba(232,93,4,0.06)"] {
    background: #fff7ed !important;
    border-bottom-color: #fde8d0 !important;
  }
  /* News source icon wrapper */
  [style*="rgba(52,211,153,0.10)"] {
    background: rgba(16,185,129,0.08) !important;
  }
  /* Empty state dashed box in scroll rows */
  [style*="dashed rgba(255,140,66"] {
    border-color: rgba(0,0,0,0.1) !important;
    background: #f9fafb !important;
  }
  /* ScrollRow section title colour */
  .space-y-3 > div > h3 {
    color: #92400e !important;
  }
  .space-y-3 > div > h3 span {
    color: #b45309 !important;
    opacity: 0.6 !important;
  }

  /* ── Planner light mode explicit overrides ── */
  .planner-task-text {
    color: #9a3412 !important; /* Roadmap text color (dark orange/brown) */
  }
  .planner-task-text-completed {
    color: #9ca3af !important;
  }
  .planner-task-type {
    color: #6b7280 !important;
  }
  .planner-input {
    background: #ffffff !important;
    color: #111827 !important;
    border-color: #e5e7eb !important;
  }
  .planner-stats-box {
    background: rgba(249,250,251,0.9) !important;
    border-color: rgba(217,119,6,0.2) !important;
  }
  .planner-sync-btn {
    color: #92400e !important;
  }
  .planner-how-it-works-text {
    color: #9a3412 !important;
  }

  /* Task Category Badges - keep their colors in light mode */
  .task-category-badge {
    opacity: 1 !important;
  }

  /* Onboarding Autocomplete Dropdown */
  .relative > div[style*="rgba(6,3,18"] {
    background: #ffffff !important;
    border-color: #e5e7eb !important;
    box-shadow: 0 8px 30px rgba(0,0,0,0.1) !important;
  }
  .relative > div[style*="rgba(6,3,18"] button {
    color: #1f2937 !important;
  }
  .relative > div[style*="rgba(6,3,18"] button:hover {
    background: #f3f4f6 !important;
  }

  /* ── Mentor Chat explicit overrides ── */
  .mentor-chat-bg {
    background: #ffffff !important;
    border-color: #e5e7eb !important;
  }
  .mentor-chat-user-bubble {
    background: #fff7ed !important;
    border-color: #fdba74 !important;
    color: #431407 !important;
  }
  .mentor-chat-ai-bubble {
    background: #f8fafc !important;
    border-color: #e2e8f0 !important;
    color: #1f2937 !important;
  }
  .mentor-chat-input-wrapper {
    background: #f8fafc !important;
    border-color: #e2e8f0 !important;
  }
  .mentor-chat-input {
    background: #ffffff !important;
    color: #1f2937 !important;
    border-color: #e5e7eb !important;
  }
  .mentor-chat-header {
    background: #ffffff !important;
    border-bottom: 1px solid #e5e7eb !important;
  }
  .mentor-chat-header h3 {
    color: #9a3412 !important;
  }
  .mentor-chat-header p {
    color: #6b7280 !important;
  }
  
  /* ── Mentor Chat explicitly ── */
  .mentor-container { border-color: #e5e7eb !important; }
  .mentor-header { background: #fdfbf7 !important; border-color: #e5e7eb !important; border-bottom: 1px solid rgba(0,0,0,0.05) !important; }
  .mentor-header h3 { color: #111827 !important; }
  .mentor-header p { color: #6b7280 !important; }
  .mentor-header button, .mentor-header button svg { color: #4b5563 !important; }
  
  .mentor-chat-area { background: #ffffff !important; border-color: #e5e7eb !important; }
  .mentor-ai-bubble { background: #f3f4f6 !important; border-color: #e5e7eb !important; color: #1f2937 !important; }
  .mentor-user-bubble { background: #ede9fe !important; border-color: #e5e7eb !important; color: #111827 !important; }
  
  .mentor-input-wrapper { background: #fdfbf7 !important; border-color: #e5e7eb !important; border-top: 1px solid rgba(0,0,0,0.05) !important; }
  .mentor-input { background: #ffffff !important; border-color: #d1d5db !important; color: #111827 !important; }
  .mentor-input::placeholder { color: #9ca3af !important; }
  .mentor-input-wrapper button[title] { color: #4b5563 !important; }
  .mentor-input-wrapper button[title]:hover { color: #111827 !important; }

  .mentor-new-chat-btn { background: #f3f4f6 !important; border-color: #e5e7eb !important; color: #374151 !important; }
  .mentor-new-chat-btn:hover { background: #e5e7eb !important; color: #111827 !important; }
  .mentor-tab-toggle { background: #f3f4f6 !important; border-color: #e5e7eb !important; }
  .mentor-tab-toggle button.bg-violet-600 { background: #ede9fe !important; color: #4f46e5 !important; }
  .mentor-tab-toggle button.text-zinc-500 { color: #6b7280 !important; }
  .mentor-tab-toggle button.text-zinc-500:hover { color: #374151 !important; }
  
  .mentor-suggestions-title { color: #4b5563 !important; }
  .mentor-suggestion-btn { background: #f9fafb !important; border-color: #e5e7eb !important; color: #374151 !important; }
  .mentor-suggestion-btn:hover { background: #ede9fe !important; border-color: #c4b5fd !important; color: #4f46e5 !important; }
  
  .mentor-send-btn.bg-zinc-800 { background: #f3f4f6 !important; color: #9ca3af !important; }
  .mentor-send-btn.bg-violet-600 { background: #4f46e5 !important; color: #ffffff !important; }

  /* History Elements */
  .mentor-history-header { background: #f9fafb !important; border-color: #e5e7eb !important; border-bottom: 1px solid rgba(0,0,0,0.05) !important; }
  .mentor-history-header p { color: #4b5563 !important; }
  .mentor-history-date-btn { background: #fdfbf7 !important; border-color: #e5e7eb !important; border-bottom: 1px solid #e5e7eb !important; }
  .mentor-history-date-btn:hover { background: #f3f4f6 !important; }
  .mentor-history-date-text { color: #111827 !important; }
  .mentor-history-time { color: #9ca3af !important; }
  .mentor-history-pair { background: #ffffff !important; }
  .mentor-history-date-btn span.text-zinc-600 { color: #6b7280 !important; }
  .mentor-chat-area .border-zinc-800\\/60 { border-color: #e5e7eb !important; }
  .mentor-chat-area .divide-zinc-800\\/50 > div { border-color: #f3f4f6 !important; }

  /* ── Flashcard / Revision overrides ── */
  .flashcard-card {
    background: #ffffff !important;
    border-color: #e5e7eb !important;
  }
  .flashcard-text, .flashcard-card-grid p {
    color: #1f2937 !important;
  }
  .flashcard-option {
    background: #f9fafb !important;
    border-color: #e5e7eb !important;
    color: #374151 !important;
  }
  .flashcard-option-selected {
    background: #fff7ed !important;
    border-color: #fdba74 !important;
    color: #9a3412 !important;
  }
  .flashcard-card-grid {
    background: #ffffff !important;
    border-color: #e5e7eb !important;
    color: #1f2937 !important;
  }
  .flashcard-modal {
    background: #ffffff !important;
    border-color: #e5e7eb !important;
    color: #1f2937 !important;
  }

  /* ── Roadmap Topics explicit overrides ── */
  .roadmap-stage-title, .roadmap-stage-topic {
    color: #9a3412 !important;
  }

  /* ── New Flashcard Modal explicitly ── */
  .flashcard-create-modal {
    background: #ffffff !important;
    border-color: #e5e7eb !important;
    box-shadow: 0 10px 40px rgba(0,0,0,0.08) !important;
  }
  .flashcard-create-title { color: #1f2937 !important; }
  .flashcard-create-label { color: #6b7280 !important; }
  .flashcard-create-label-front { color: #9a3412 !important; border-bottom-color: #e5e7eb !important; }
  .flashcard-create-label-back { color: #4f46e5 !important; border-bottom-color: #e5e7eb !important; }
  .flashcard-create-input {
    background: #ffffff !important;
    border-color: #d1d5db !important;
    color: #1f2937 !important;
    caret-color: #ea580c !important;
  }
  .flashcard-create-input::selection {
    background: rgba(234, 88, 12, 0.2) !important;
    color: #1f2937 !important;
  }
  .flashcard-create-input::placeholder { color: #9ca3af !important; }
  .flashcard-create-box {
    background: #f9fafb !important;
    border-color: #e5e7eb !important;
  }
  label.flashcard-create-btn {
    background: #ffffff !important;
    border-color: #d1d5db !important;
    color: #4b5563 !important;
  }
  /* Front-side button in light mode (Question) */
  label.flashcard-create-btn.text-gold-400 {
    background: #fff7ed !important;
    border-color: rgba(249, 115, 22, 0.3) !important;
    color: #c2410c !important;
  }
  label.flashcard-create-btn.text-gold-400:hover {
    background: #ffedd5 !important;
    border-color: rgba(249, 115, 22, 0.5) !important;
  }
  /* Back-side button in light mode (Answer) */
  label.flashcard-create-btn.text-purple-400 {
    background: #f5f3ff !important;
    border-color: rgba(139, 92, 246, 0.3) !important;
    color: #6d28d9 !important;
  }
  label.flashcard-create-btn.text-purple-400:hover {
    background: #ede9fe !important;
    border-color: rgba(139, 92, 246, 0.5) !important;
  }
  /* Attachment preview box in light mode */
  .flashcard-create-box div.bg-white\\/10 {
    background-color: #f1f5f9 !important;
    border-color: #e2e8f0 !important;
  }
  .flashcard-create-box div.bg-black\\/40 {
    background-color: #e2e8f0 !important;
  }

  /* ── Analytics Tab Calendar and Cards ── */
  .analytics-card {
    background: #ffffff !important;
    border-color: #e5e7eb !important;
    box-shadow: 0 4px 15px rgba(0,0,0,0.03) !important;
  }
  .analytics-title {
    color: #1f2937 !important;
  }
  .analytics-text {
    color: #4b5563 !important;
  }
  .analytics-day-empty {
    color: #9ca3af !important;
  }
  .analytics-day-empty:hover {
    background: #f3f4f6 !important;
  }
  .analytics-day-due {
    background: #ede9fe !important;
    color: #4f46e5 !important;
  }
  .analytics-day-due span.text-purple-400 {
    color: #ea580c !important; 
  }

  /* ── File Speaker light mode overrides ── */
  .bg-zinc-950\\/30, .bg-zinc-900\\/40, .bg-zinc-900\\/60 { background-color: #ffffff !important; border-color: #e2e8f0 !important; }
  .bg-zinc-800, .bg-zinc-800\\/50, .bg-zinc-800\\/60 { background-color: #f8fafc !important; border-color: #e2e8f0 !important; }
  .bg-zinc-700 { background-color: #cbd5e1 !important; color: #1e293b !important; }
  .border-zinc-800, .border-zinc-800\\/60, .border-zinc-700, .border-zinc-700\\/50, .border-zinc-700\\/60 { border-color: #e2e8f0 !important; }
  .text-zinc-200, .text-zinc-300, .text-zinc-400 { color: #1e293b !important; }
  .text-zinc-500, .text-zinc-600 { color: #64748b !important; }
  .text-violet-300, .text-violet-400 { color: #6d28d9 !important; }
  .bg-violet-600\\/15, .bg-violet-600\\/20, .bg-violet-500\\/10 { background-color: #f3e8ff !important; border-color: #d8b4fe !important; }
  input.bg-zinc-900, input.bg-zinc-800, input.bg-zinc-800\\/50, input.bg-black\\/40 { background-color: #ffffff !important; color: #0f172a !important; border-color: #cbd5e1 !important; }
  option, select option { background-color: #ffffff !important; color: #0f172a !important; }

  /* ── Language accordion button in settings ── */
  .settings-lang-btn, button.settings-lang-btn {
    background: #f1f5f9 !important;
    border: 1px solid #e2e8f0 !important;
    color: #1f2937 !important;
  }
  .settings-lang-btn span { color: #1f2937 !important; }
  .settings-lang-btn span.ml-2 { color: #64748b !important; }
  .settings-lang-btn:hover { background: #e2e8f0 !important; }

  /* ── Roadmap timeline stage dot numbers ── */
  .roadmap-stage-number { 
    color: #4b5563 !important; 
    opacity: 1 !important; 
    font-weight: 800 !important;
    text-shadow: none !important;
  }

  /* ── Stats Card value text ── */
  .text-gold-100 { color: #111827 !important; }
  .text-gold-400\\/60 { color: #854d0e !important; }

  /* ── FileSpeaker send arrow - disabled state ── */
  button.disabled\\:bg-zinc-800:disabled { background-color: #e2e8f0 !important; color: #94a3b8 !important; }
  button.w-10.h-10.rounded-lg.bg-violet-600 { background-color: #7c3aed !important; }
  button.w-10.h-10.rounded-lg.bg-violet-600 svg { color: #ffffff !important; }
  /* Send arrow dark rounded box */
  .fs-send-btn { background: #7c3aed !important; color: #ffffff !important; }
  .fs-send-btn:disabled { background: #e2e8f0 !important; color: #94a3b8 !important; }

  /* ── Reward shower popup adapts to light mode ── */
  .reward-shower-card {
    background: linear-gradient(135deg, #ffffff, #faf5ff) !important;
    border-color: rgba(124,58,237,0.4) !important;
    box-shadow: 0 0 50px rgba(124,58,237,0.2), 0 20px 60px rgba(0,0,0,0.12) !important;
  }
  .reward-shower-card h2 { color: #1f2937 !important; }
  .reward-shower-card p { color: #4b5563 !important; }
  .reward-shower-label { color: #7c3aed !important; }
  .reward-shower-xp {
    background: rgba(124,58,237,0.12) !important;
    border-color: rgba(124,58,237,0.35) !important;
    color: #5b21b6 !important;
  }
  .reward-shower-xp span { color: #6d28d9 !important; }
  .reward-shower-backdrop { background-color: rgba(255,255,255,0.75) !important; }

  /* Fix Android WebView caret selection handle rendering artifacts in light mode modals */
  .backdrop-blur-md, .backdrop-blur-sm, [class*="backdrop-blur"] {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .bg-black\\/80, .bg-black\\/70, .bg-black\\/50 {
    background-color: rgba(0, 0, 0, 0.45) !important;
  }

  /* Global light mode text selection and caret accent alignment */
  input, textarea, [contenteditable="true"] {
    caret-color: #ea580c !important;
  }
  ::selection {
    background: rgba(234, 88, 12, 0.25) !important;
    color: #111827 !important;
  }
  input::selection, textarea::selection, [contenteditable="true"]::selection {
    background: rgba(234, 88, 12, 0.25) !important;
    color: #111827 !important;
  }

  /* ── Access Terminal (Login page) light mode ── */
  /* Handled via conditional inline styles in JSX — no CSS overrides needed */
`;


/* ── Logo component using provided image ── */
const KalamSparkLogo = ({ className = "w-full h-full", isLight = false }) => (
  <div className={`relative ${className} flex items-center justify-center`}>
    <img
      src={isLight ? "/assets/logo-light.png" : "/assets/logo.png"}
      className="relative z-10 w-full h-full object-cover rounded-full"
      style={{ 
        filter: isLight ? 'drop-shadow(0 2px 6px rgba(234,88,12,0.2))' : 'drop-shadow(0 2px 8px rgba(255,140,66,0.3))',
        borderRadius: '50%'
      }}
      alt="Kalam Spark Logo"
    />
  </div>
);

/* ── Cinematic splash Phoenix ── */
const CinematicPhoenix = ({ isLight = false }) => (
  <div className="relative flex items-center justify-center">
    <div className="relative z-20 w-[260px] h-[260px] md:w-[320px] md:h-[320px]" style={{ animation: 'splashLogoIn 3.5s cubic-bezier(0.22,1,0.36,1) forwards' }}>
      <KalamSparkLogo isLight={isLight} />
    </div>
  </div>
);

/* ── Reward Shower (global celebration popup) ── */
const CONFETTI_EMOJIS = ['✨','🌟','💫','🎊','🎉','⭐','🏅','💥'];
const RewardShower = () => {
  const [visible, setVisible] = useState(false);
  const [reward, setReward] = useState<Reward | null>(null);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; emoji: string; delay: number; dur: number }[]>([]);

  useEffect(() => {
    const unsub = rewardEvents.subscribe((r) => {
      setReward(r);
      setParticles(Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        emoji: CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length],
        delay: Math.random() * 0.8,
        dur: 1.5 + Math.random() * 1,
      })));
      setVisible(true);
      setTimeout(() => setVisible(false), 3500);
    });
    return unsub;
  }, []);

  if (!visible || !reward) return null;

  return (
    <div
      className="reward-shower-backdrop fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
    >
      {/* Confetti particles */}
      {particles.map(p => (
        <span
          key={p.id}
          className="absolute text-2xl animate-bounce"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            animation: `rewardFall ${p.dur}s ${p.delay}s ease-in forwards`,
          }}
        >{p.emoji}</span>
      ))}

      {/* Badge card */}
      <div
        className="reward-shower-card relative z-10 flex flex-col items-center gap-4 p-10 rounded-3xl text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(10,6,30,0.97), rgba(20,10,50,0.97))',
          border: '2px solid rgba(255,215,0,0.5)',
          boxShadow: '0 0 60px rgba(255,215,0,0.3), 0 0 120px rgba(124,58,237,0.2)',
          animation: 'rewardPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <span style={{ fontSize: 72, filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.8))' }}>{reward.icon}</span>
        <div>
          <p className="reward-shower-label text-xs text-gold-500/60 uppercase tracking-widest font-semibold mb-1">🏆 Badge Earned!</p>
          <h2 className="font-cinzel text-2xl font-bold text-gold-100">{reward.title}</h2>
          <p className="text-sm text-gold-400/60 mt-1">{reward.description}</p>
        </div>
        <div
          className="reward-shower-xp px-6 py-2 rounded-full font-bold text-lg"
          style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.4)', color: '#ffd700' }}
        >
          +{reward.xpValue} XP
        </div>
      </div>

      <style>{`
        @keyframes rewardFall {
          0%  { transform: translateY(0) rotate(0deg); opacity: 1; }
          100%{ transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes rewardPop {
          0%  { transform: scale(0.3) translateY(30px); opacity: 0; }
          100%{ transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

/* ── Splash Screen ── */
const SplashScreen = ({ onComplete, isLight = false }: { onComplete: () => void; isLight?: boolean }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      style={isLight
        ? { background: '#ffffff' }
        : { background: 'radial-gradient(circle at center, #071E3D 0%, #05102E 50%, #020713 100%)' }}
    >
      {!isLight && <div className="stars opacity-40" />}
      {isLight && (
        <>
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-50 blur-[100px] rounded-full pointer-events-none opacity-70" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-sky-50 blur-[100px] rounded-full pointer-events-none opacity-50" />
        </>
      )}
      <div className="relative z-10 flex flex-col items-center gap-8">
        <CinematicPhoenix isLight={isLight} />
        <div style={{ animation: 'splashTagIn 2s 2s ease-out forwards', opacity: 0 }}>
          <p className="text-xs font-bold uppercase tracking-[0.6em] font-mono"
            style={{ color: isLight ? 'rgba(154,52,18,0.7)' : 'rgba(255,140,66,0.65)', letterSpacing: '0.55em' }}>
            IGNITING YOUR FUTURE
          </p>
        </div>
      </div>
    </div>
  );
};

/* ── Sidebar logo (compact) ── */
const PhoenixLogo = ({ className = "w-8 h-8", isLight = false }) => (
  <div className={`relative flex items-center justify-center ${className}`}>
    {/* Logo image — transparent background PNG, no fill box */}
    <img
      src={isLight ? "/assets/logo-light.png" : "/assets/logo.png"}
      alt="Kalam Spark"
      className="w-full h-full object-contain relative z-10"
      style={{ 
        filter: isLight ? 'drop-shadow(0 2px 6px rgba(234,88,12,0.2))' : 'drop-shadow(0 2px 8px rgba(255,140,66,0.3))' 
      }}
    />
  </div>
);



/* ── Sidebar Nav Item ── */
const SidebarItem = ({
  to, icon: Icon, label, active, onClick, id,
}: {
  to: string; icon: any; label: string; active: boolean; onClick?: () => void; id?: string;
}) => (
  <Link
    to={to}
    id={id}
    onClick={onClick}
    className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
      active
        ? "nav-active"
        : "border-transparent text-gold-300/50 hover:text-gold-200 hover:bg-white/5 hover:border-gold-500/15"
    }`}
  >
    <Icon
      size={17}
      className={`nav-icon transition-colors ${
        active ? "text-gold-400" : "text-gold-500/40 group-hover:text-gold-300/70"
      }`}
    />
    <span className={`text-sm font-medium ${active ? "text-purple-200" : ""}`}>{label}</span>
    {active && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-gradient-to-b from-gold-400 to-purple-500 rounded-r-full shadow-[0_0_12px_rgba(211,156,59,0.8)]" />
    )}
  </Link>
);

/* ── Main App Content ── */
const AppContent = ({
  user, setUser, setShowSplash, setSessionLoading,
  cachedRoadmap, setCachedRoadmap, cachedCompletedStages, setCachedCompletedStages,
}: {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  setShowSplash: React.Dispatch<React.SetStateAction<boolean>>;
  setSessionLoading: React.Dispatch<React.SetStateAction<boolean>>;
  cachedRoadmap: CareerRoadmap | null;
  setCachedRoadmap: React.Dispatch<React.SetStateAction<CareerRoadmap | null>>;
  cachedCompletedStages: string[];
  setCachedCompletedStages: React.Dispatch<React.SetStateAction<string[]>>;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(networkService.isOnline());
  const [isInstallingPWA, setIsInstallingPWA] = useState(false);
  const [pwaProgress, setPwaProgress] = useState(0);

  // Track offline sync queue size
  useEffect(() => {
    const unsub = offlineSyncService.onQueueChange((count) => setPendingSyncCount(count));
    return unsub;
  }, []);

  // Trigger auto-sync flush on startup and whenever we go online
  useEffect(() => {
    if (isOnline) {
      offlineSyncService.flush().catch(err => console.warn('[App] Auto-sync flush on online status:', err));
    }
  }, [isOnline]);

  // Track online/offline status for UI indicator
  useEffect(() => {
    let nativeListener: any = null;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/network').then(({ Network }) => {
        Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected);
          if (status.connected) {
            offlineSyncService.flush();
          }
        }).then(h => {
          nativeListener = h;
        });
      });
    } else {
      const handleOnline = () => {
        setIsOnline(true);
        offlineSyncService.flush();
      };
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
    return () => {
      if (nativeListener) {
        nativeListener.remove();
      }
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    await offlineSyncService.flush();
    setIsSyncing(false);
  };

  // Persist last visited route
  useEffect(() => {
    if (user.isAuthenticated && user.onboardingComplete) {
      localStorage.setItem("kalamspark_last_route", location.pathname + location.search + location.hash);
    }
  }, [location, user.isAuthenticated, user.onboardingComplete]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [modelExists, setModelExists] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'done'>('idle');
  const [copyProgress, setCopyProgress] = useState(0);

  // ── PWA Install Prompt ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallOptionModal, setShowInstallOptionModal] = useState(false);


  useEffect(() => {
    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Detect if already installed as standalone PWA
    const standalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    setIsInstalled(standalone);

    // Only show on web (not inside Capacitor native app)
    if (Capacitor.isNativePlatform() || standalone) return;

    // Android Chrome: capture the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: show the banner after a short delay so user can see the app first
    if (ios) {
      const timer = setTimeout(() => setShowInstallBanner(true), 3000);
      return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handler); };
    }

    // Hide after install
    const onInstalled = () => { setShowInstallBanner(false); setIsInstalled(true); };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const downloadApkWithProgress = async () => {
    setIsInstallingPWA(true);
    setPwaProgress(0);
    try {
      const apkUrl = import.meta.env.VITE_APK_DOWNLOAD_URL || '/kalam-spark.apk';
      const response = await fetch(apkUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch APK: HTTP status ${response.status}`);
      }
      const contentLengthHeader = response.headers.get('content-length');
      const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported by browser.');
      }
      
      let receivedLength = 0;
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          chunks.push(value);
          receivedLength += value.length;
          if (contentLength > 0) {
            const percent = Math.round((receivedLength / contentLength) * 100);
            setPwaProgress(percent);
          } else {
            setPwaProgress(prev => Math.min(prev + 1, 99));
          }
        }
      }
      
      setPwaProgress(100);
      const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kalam-spark.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setTimeout(() => {
        setIsInstallingPWA(false);
        alert("🎉 Kalam Spark APK has been downloaded successfully! Please open the downloaded .apk file to install the app on your mobile device.");
      }, 500);
      
    } catch (error) {
      console.warn('[App] APK download failed, falling back to simulated PWA install:', error);
      setIsInstallingPWA(true);
      setPwaProgress(0);
      let simulatedProgress = 0;
      const interval = setInterval(() => {
        simulatedProgress += Math.floor(Math.random() * 12) + 6;
        if (simulatedProgress >= 100) {
          clearInterval(interval);
          setPwaProgress(100);
          setTimeout(async () => {
            setIsInstallingPWA(false);
            if (installPrompt) {
              installPrompt.prompt();
              const { outcome } = await installPrompt.userChoice;
              if (outcome === 'accepted') {
                setShowInstallBanner(false);
                setIsInstalled(true);
                alert("🎉 Kalam Spark PWA added to home screen successfully!");
              }
              setInstallPrompt(null);
            } else {
              alert("📥 PWA Installation Fallback:\n\n1. Tap your browser's menu button (three dots ⋮ at the top right).\n2. Select 'Install App' or 'Add to Home screen'.");
            }
          }, 500);
        } else {
          setPwaProgress(simulatedProgress);
        }
      }, 150);
    }
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      alert("📱 How to Install on iOS:\n\n1. Tap the Share button (⎙) in Safari.\n2. Scroll down and select 'Add to Home Screen'.\n3. Tap 'Add' in the top-right corner to install.");
      return;
    }
    setShowInstallOptionModal(true);
  };

  const handleInstallPWA = async () => {
    setShowInstallOptionModal(false);
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBanner(false);
        setIsInstalled(true);
        setIsInstallingPWA(true);
        setPwaProgress(0);
        const interval = setInterval(() => {
          setPwaProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              setTimeout(() => {
                setIsInstallingPWA(false);
                alert("🎉 Kalam Spark has been added to home screen successfully!");
              }, 600);
              return 100;
            }
            return prev + Math.floor(Math.random() * 12) + 6;
          });
        }, 200);
      }
      setInstallPrompt(null);
    } else {
      alert("📥 How to Add to Home Screen:\n\n1. Tap your browser's menu button (three dots ⋮ at the top right).\n2. Select 'Add to Home screen' or 'Install App'.\n\nIf you don't see this option, the app might already be installed!");
    }
  };

  const handleDownloadAPK = async () => {
    setShowInstallOptionModal(false);
    await downloadApkWithProgress();
  };

  useEffect(() => {
    if (showSettingsModal && Capacitor.isNativePlatform()) {
      llamaPlugin.checkModelExists().then(exists => {
        setModelExists(exists);
      });
    }
  }, [showSettingsModal]);

  const handlePickModel = async () => {
    try {
      setCopyStatus('copying');
      setCopyProgress(0);
      const success = await llamaPlugin.selectModelFile((progress) => {
        setCopyProgress(Math.round(progress));
      });
      if (success) {
        setCopyStatus('done');
        setModelExists(true);
      } else {
        setCopyStatus('idle');
        // User cancelled the file picker — no error message needed
      }
    } catch (err: any) {
      setCopyStatus('idle');
      const msg = err?.message || String(err);
      // Only show an alert for real errors (not user cancellation)
      const isCancelled = msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('result code: 0');
      if (!isCancelled) {
        const helpMsg = msg.includes('No document picker') 
          ? 'Your device does not support file browsing. Please copy the .gguf model file to your Downloads folder manually.'
          : msg.includes('Failed to open') || msg.includes('stream')
            ? 'Could not read the selected file. Ensure the .gguf file is not corrupted and try again.'
            : `Could not select model file: ${msg}\n\nTip: Place the file in your Downloads folder instead.`;
        alert(`⚠️ Model Selection Failed\n\n${helpMsg}`);
      }
    }
  };


  useEffect(() => {
    document.body.style.overflow = isSidebarOpen ? "hidden" : "auto";
  }, [isSidebarOpen]);

  const isLight = user.settings?.theme === 'light';
  if (!user.onboardingComplete) {
    return (
      <>
        {isLight && <style>{LIGHT_THEME_CSS}</style>}
        <Onboarding
          isLight={isLight}
          onComplete={async (profile) => {
            const avatar = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(profile.name || 'user')}`;
            const updated = { ...user, ...profile, avatar, onboardingComplete: true, currentStageIndex: 0 };
            localStorage.setItem("kalamspark_force_refresh", "true");
            navigate("/roadmap");
            setUser(updated);
            try {
              await dbService.saveUser(updated);
            } catch (err) {
              console.error('[Onboarding] Save failed — will retry on next load:', err);
              // Don't block the user. The debounced save effect will retry shortly.
            }
          }}
        />
      </>
    );
  }

  const pageTitle = {
    "/": `Kalam — ${user.dream || "Your Career"}`,
    "/dashboard": `Kalam — ${user.dream || "Home"}`,
    "/roadmap": `Kalam — ${user.dream || "My Plan"}`,
    "/planner": `Kalam — ${user.dream || "Tasks"}`,
    "/resources": `Kalam — ${user.dream || "Study"}`,
    "/revision": `Kalam — ${user.dream || "Revision"}`,
    "/opportunities": `Kalam — Jobs & Hackathons`,
    "/pivot": `Kalam — ${user.dream || "Pivot"}`,
    "/mentor": `Kalam — ${user.dream || "AI Mentor"}`,
    "/filespeaker": `Kalam — File Speaker`,
  }[location.pathname] ?? `Kalam Spark`;

  return (
    <div className="flex h-screen w-screen overflow-hidden text-gold-100/90 select-none">
      {/* Global Reward Shower */}
      <RewardShower />

      {/* PWA Installation Progress Overlay */}
      {isInstallingPWA && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="w-[320px] p-6 rounded-2xl glass-card flex flex-col items-center gap-5 text-center border border-gold-500/25">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center animate-bounce">
              <Smartphone size={32} className="text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold heading-gold font-cinzel">Installing Kalam Spark</h3>
              <p className="text-xs text-gold-500/60 mt-1">Downloading offline assets and configurations...</p>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden border border-gold-500/10 relative">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 transition-all duration-200"
                style={{ width: `${Math.min(pwaProgress, 100)}%` }}
              />
            </div>
            
            <span className="text-sm font-semibold text-gold-300">{Math.min(pwaProgress, 100)}% Complete</span>
          </div>
        </div>
      )}

      {/* Install Options Modal */}
      {showInstallOptionModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowInstallOptionModal(false)}>
          <div className="w-full max-w-md p-6 rounded-2xl glass-card border border-gold-500/25 flex flex-col gap-6 text-left relative" onClick={(e) => e.stopPropagation()} style={{ background: "rgba(6,3,18,0.95)" }}>
            <button onClick={() => setShowInstallOptionModal(false)} className="absolute top-4 right-4 text-gold-500/40 hover:text-gold-300 transition-colors">
              <X size={20} />
            </button>
            
            <div>
              <h3 className="text-xl font-bold heading-gold font-cinzel">Install Kalam Spark</h3>
              <p className="text-xs text-gold-500/60 mt-1">Select your preferred way to run Kalam Spark on your device.</p>
            </div>
            
            <div className="flex flex-col gap-4">
              {/* Option 1: PWA */}
              <div 
                className="flex items-start gap-4 p-4 rounded-xl cursor-pointer hover:bg-white/5 border border-gold-500/10 hover:border-gold-500/30 transition-all group active:scale-[0.98]"
                onClick={handleInstallPWA}
              >
                <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-violet-600/20">
                  <Smartphone size={20} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gold-200 group-hover:text-gold-100 flex items-center gap-1.5">
                    Add to Home Screen (PWA)
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">Instant</span>
                  </h4>
                  <p className="text-[11px] text-gold-500/60 mt-1 leading-relaxed">
                    Adds an icon directly to your phone's home screen. Runs the fast web version of the app. (Note: cannot load local offline AI models due to browser safety limits).
                  </p>
                </div>
              </div>

              {/* Option 2: APK */}
              <div 
                className="flex items-start gap-4 p-4 rounded-xl cursor-pointer hover:bg-white/5 border border-gold-500/10 hover:border-gold-500/30 transition-all group active:scale-[0.98]"
                onClick={handleDownloadAPK}
              >
                <div className="w-10 h-10 rounded-xl bg-orange-600/10 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-orange-600/20">
                  <Download size={20} className="text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gold-200 group-hover:text-gold-100 flex items-center gap-1.5">
                    Download Android App (.apk)
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/25">Offline AI</span>
                  </h4>
                  <p className="text-[11px] text-gold-500/60 mt-1 leading-relaxed">
                    Downloads the native Android App binary with progress tracking. Open the downloaded file to install. **Required to load local AI models (.gguf) and run fully offline**.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-[10px] text-gold-500/40 text-center mt-2 border-t border-gold-500/10 pt-3">
              💡 Tip: The mobile app works exactly like the website but allows running heavy AI models offline using your phone's processor.
            </div>
          </div>
        </div>
      )}

      {/* Sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150]"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-[160] w-64 glass-sidebar transition-transform duration-500 ease-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full p-4">
          {/* Logo area */}
          <div className="flex flex-col items-center justify-center py-5 mb-4">
            <div className="w-28 h-28 mb-3">
              <PhoenixLogo className="w-28 h-28" isLight={user.settings?.theme === 'light'} />
            </div>
            <h2 className="heading-gold font-cinzel text-lg font-bold tracking-[0.2em] uppercase">
              Kalam Spark
            </h2>
            <p className="text-gold-500/40 text-[10px] uppercase tracking-[0.3em] mt-0.5 mono">
              AI Career Guide
            </p>
          </div>

          {/* Gold divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-gold-500/30 to-transparent mb-4" />

          {/* Nav */}
          <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
            <SidebarItem to="/" icon={LayoutDashboard} label="Home" active={location.pathname === "/"} onClick={() => setIsSidebarOpen(false)} />
            <SidebarItem id="nav-roadmap" to="/roadmap" icon={MapIcon} label="Roadmap" active={location.pathname === "/roadmap"} onClick={() => setIsSidebarOpen(false)} />
            <SidebarItem id="nav-planner" to="/planner" icon={Calendar} label="Task List" active={location.pathname === "/planner"} onClick={() => setIsSidebarOpen(false)} />
            <SidebarItem id="nav-resources" to="/resources" icon={BookOpen} label="Study Center" active={location.pathname === "/resources"} onClick={() => setIsSidebarOpen(false)} />
            <SidebarItem id="nav-revision" to="/revision" icon={RotateCcw} label="Revision" active={location.pathname === "/revision"} onClick={() => setIsSidebarOpen(false)} />
            <SidebarItem id="nav-opportunities" to="/opportunities" icon={Radio} label="Jobs & Hackathons" active={location.pathname === "/opportunities"} onClick={() => setIsSidebarOpen(false)} />
            <SidebarItem id="nav-filespeaker" to="/filespeaker" icon={Volume2} label="File Speaker" active={location.pathname === "/filespeaker"} onClick={() => setIsSidebarOpen(false)} />
            <SidebarItem id="nav-mentor" to="/mentor" icon={MessageSquare} label="AI Mentor" active={location.pathname === "/mentor"} onClick={() => setIsSidebarOpen(false)} />
          </nav>
        </div>
      </aside>

      {/* ── Main Content ── */}
      {/* Main is the scroll container. Header inside uses sticky top:0 to never disappear */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full overflow-y-auto overscroll-contain scroll-smooth">
        {/* Header — sticky so it never hides on scroll */}
        <header
          className="h-16 glass-header flex items-center justify-between px-4 sm:px-6 lg:px-10 shrink-0"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <div className="flex items-center gap-3 sm:gap-4 flex-1">
            <button
              className="text-gold-400/60 hover:text-gold-300 transition-colors p-2 rounded-lg hover:bg-white/5"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle Sidebar"
            >
              <Menu size={22} />
            </button>
            {/* Logo + App name — visible on all pages */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,140,66,0.25)' }}>
                <img src={user.settings?.theme === 'light' ? "/assets/logo-light.png" : "/assets/logo.png"} alt="Kalam Spark" className="w-full h-full object-contain" />
              </div>
              <span className="heading-gold font-cinzel text-base font-bold hidden sm:block" style={{ letterSpacing: '0.08em' }}>
                Kalam Spark
              </span>
              <span className="text-gold-500/30 hidden sm:block">—</span>
            </div>
            <h1
              className="heading-gold font-cinzel text-lg sm:text-xl font-semibold hidden sm:block truncate"
              style={{ letterSpacing: "0.05em" }}
            >
              {pageTitle.replace(/^Kalam — /, '')}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* XP Counter */}
            <div
              className="hidden xs:flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-gold-300"
              style={{
                background: "rgba(211,156,59,0.08)",
                border: "1px solid rgba(211,156,59,0.25)",
                boxShadow: "0 0 12px rgba(211,156,59,0.08)",
              }}
            >
              <Sparkles size={13} className="text-gold-400" />
              <span>{user.xp || 0} XP</span>
            </div>

            {/* Install App Badge (First place, before Stage) */}
            {!Capacitor.isNativePlatform() && !isInstalled && (
              <button
                onClick={handleInstallClick}
                title={isIOS ? 'Tap Share → Add to Home Screen to install' : 'Install Kalam Spark App'}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-gold-300 transition-all active:scale-95 select-none hover:bg-white/5"
                style={{
                  background: "rgba(211,156,59,0.08)",
                  border: "1px solid rgba(211,156,59,0.25)",
                  boxShadow: "0 0 12px rgba(211,156,59,0.08)",
                }}
              >
                <Smartphone size={13} className="text-gold-400" />
                <span className="hidden sm:inline">Install App</span>
                <span className="sm:hidden">Install</span>
              </button>
            )}

            {/* Stage Badge */}
            <div
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-gold-300"
              style={{
                background: "rgba(211,156,59,0.08)",
                border: "1px solid rgba(211,156,59,0.25)",
                boxShadow: "0 0 12px rgba(211,156,59,0.08)",
              }}
            >
              <Trophy size={13} className="text-gold-400" />
              <span className="hidden sm:inline">Stage {(user.currentStageIndex || 0) + 1}</span>
              <span className="sm:hidden">{(user.currentStageIndex || 0) + 1}</span>
            </div>

            {/* Pomodoro Timer — inline chip */}
            <PomodoroTimer />

            {/* Offline Sync Badge — shows pending changes and allows manual sync */}
            {pendingSyncCount > 0 && (
              <button
                onClick={handleManualSync}
                disabled={isSyncing || !isOnline}
                title={isOnline ? `Sync ${pendingSyncCount} offline changes to cloud` : `${pendingSyncCount} changes pending (offline)`}
                className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all"
                style={{
                  background: isOnline ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
                  border: isOnline ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(239,68,68,0.3)',
                  animation: isSyncing ? 'spin 1s linear infinite' : 'none',
                }}
              >
                {/* Cloud icon */}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: isOnline ? '#34d399' : '#f87171' }}>
                  {isSyncing
                    ? <><path d="M21 12a9 9 0 1 1-6.219-8.56"/></>
                    : isOnline
                      ? <><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/></>
                      : <><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="12" y1="13" x2="12" y2="17"/><line x1="12" y1="21" x2="12.01" y2="21"/></>}
                </svg>
                {/* Count badge */}
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: isOnline ? '#10b981' : '#ef4444', color: '#fff' }}
                >
                  {pendingSyncCount > 9 ? '9+' : pendingSyncCount}
                </span>
              </button>
            )}


            {/* Settings Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:bg-white/5"
              style={{ 
                background: "rgba(255,140,66,0.08)", 
                border: "1px solid rgba(255,140,66,0.25)",
              }}
              title="Settings"
            >
              <Settings size={18} className="text-gold-400 cursor-pointer" />
            </button>
          </div>
        </header>

        {/* Dynamic Theme Injection */}
        {user.settings?.theme === 'light' && <style>{LIGHT_THEME_CSS}</style>}

        {/* Page content */}
        <div className="flex-1 relative">
          {/* Subtle center glow on pages */}
          <div className="absolute top-20 right-10 w-[400px] h-[400px] bg-purple-700/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="p-5 lg:p-8 page-transition pb-28 lg:pb-10">
            <Routes>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route
                path="/roadmap"
                element={
                  <RoadmapView
                    user={user}
                    setUser={setUser}
                    onXpGain={(amount: number) => setUser((prev) => ({ ...prev, xp: (prev.xp || 0) + amount }))}
                    onStageAdvance={(newIndex: number) =>
                      setUser((prev) => ({ ...prev, currentStageIndex: Math.max(prev.currentStageIndex, newIndex) }))
                    }
                    cachedRoadmap={cachedRoadmap}
                    setCachedRoadmap={setCachedRoadmap}
                    cachedCompletedStages={cachedCompletedStages}
                    setCachedCompletedStages={setCachedCompletedStages}
                  />
                }
              />
              <Route
                path="/planner"
                element={
                  <Planner
                    user={user}
                    setUser={setUser}
                    onXpGain={(amount: number) => setUser((prev) => ({ ...prev, xp: (prev.xp || 0) + amount }))}
                  />

                }
              />
              <Route path="/resources" element={<Resources user={user} />} />
              <Route
                path="/revision"
                element={
                  <RevisionEngine
                    user={user}
                    onXpGain={(amount: number) => setUser((prev) => ({ ...prev, xp: (prev.xp || 0) + amount }))}
                  />
                }
              />
              <Route path="/opportunities" element={<Opportunities user={user} />} />
              <Route path="/filespeaker" element={<FileSpeaker user={user} setUser={setUser} isLight={isLight} />} />
              <Route path="/mentor" element={<MentorChat user={user} isLight={isLight} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowSettingsModal(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 relative flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar settings-modal" style={{ background: "rgba(6,3,18,0.9)", border: "1px solid rgba(255,140,66,0.22)", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 text-gold-500/40 hover:text-gold-300 transition-colors">
              <X size={20} />
            </button>
            <h2 className="heading-gold font-cinzel text-xl font-bold mb-6 flex items-center gap-2"><Settings size={18} /> Settings</h2>

            {/* PWA Install Card — only on web, only if installable */}
            {!Capacitor.isNativePlatform() && !isInstalled && (
              <div
                className="flex items-center gap-3 p-4 rounded-xl mb-5 cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,140,66,0.12), rgba(124,58,237,0.1))',
                  border: '1px solid rgba(255,140,66,0.35)',
                  boxShadow: '0 0 20px rgba(255,140,66,0.08)',
                }}
                onClick={() => { setShowSettingsModal(false); handleInstallClick(); }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,140,66,0.15)', border: '1px solid rgba(255,140,66,0.3)' }}>
                  <Smartphone size={20} className="text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gold-200">{isIOS ? 'Add to Home Screen' : 'Install App'}</p>
                  <p className="text-[10px] text-gold-500/60 mt-0.5">
                    {isIOS
                      ? 'Tap Share (⎙) → "Add to Home Screen" in Safari'
                      : 'Install on your phone for offline access'}
                  </p>
                </div>
                {!isIOS && <Download size={16} className="text-gold-400 flex-shrink-0" />}
              </div>
            )}
            
            <div className="flex flex-col items-center gap-3 p-5 mb-5 rounded-xl text-center" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
              <div className="relative group cursor-pointer w-20 h-20 rounded-full border border-gold-500/30 bg-black overflow-hidden flex items-center justify-center mx-auto"
                   onClick={() => document.getElementById('profile-pic-upload')?.click()}>
                {user.avatar ? (
                  <img src={user.avatar} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600/40 to-gold-600/20 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gold-400">{user.name ? user.name.charAt(0).toUpperCase() : "E"}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gold-300">Change</span>
                </div>
              </div>
              <input
                type="file"
                id="profile-pic-upload"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const base64 = reader.result as string;
                      const updated = { ...user, avatar: base64 };
                      setUser(updated);
                        localStorage.setItem("kalamspark_user_session", JSON.stringify(updated));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div>
                <p className="text-lg font-bold text-gold-100">{user.name || "Explorer"}</p>
                <p className="text-xs text-gold-500/60 font-medium tracking-wide uppercase mt-1">{user.dream || "Discovering future"}</p>
                <p className="text-xs text-gold-500/40 mt-1">{user.year || "Getting Started"}</p>
                {user.email && <p className="text-[10px] text-purple-300/40 mt-2 font-mono">{user.email}</p>}
              </div>
            </div>

            {/* App Settings Toggles */}
            <div className="flex flex-col gap-3 mb-5">

              <label className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-gold-500/20 cursor-pointer hover:bg-black/60 transition-colors">
                <span className="text-sm font-medium text-gold-200">Follow System Theme</span>
                <input 
                  type="checkbox" 
                  checked={!user.settings?.hasManualTheme} 
                  onChange={(e) => {
                    const useSystem = e.target.checked;
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    const systemTheme = prefersDark ? 'dark' : 'light';
                    const newTheme = useSystem ? systemTheme : user.settings?.theme || 'dark';
                    const updated = { 
                      ...user, 
                      settings: { 
                        ...user.settings, 
                        theme: newTheme as any, 
                        hasManualTheme: !useSystem,
                        autoScheduleRevisions: user.settings?.autoScheduleRevisions ?? true, 
                        notificationsEnabled: user.settings?.notificationsEnabled ?? true, 
                        soundEnabled: user.settings?.soundEnabled ?? true 
                      } 
                    };
                    setUser(updated);
                    dbService.saveUser(updated);
                  }}
                  className="w-4 h-4 accent-gold-500 cursor-pointer"
                />
              </label>

              <label className={`flex items-center justify-between p-3 rounded-lg bg-black/40 border border-gold-500/20 transition-colors ${user.settings?.hasManualTheme ? 'cursor-pointer hover:bg-black/60' : 'opacity-50 cursor-not-allowed'}`}>
                <span className="text-sm font-medium text-gold-200">Dark Mode</span>
                <input 
                  type="checkbox" 
                  disabled={!user.settings?.hasManualTheme}
                  checked={user.settings?.theme !== 'light'} 
                  onChange={(e) => {
                    if (!user.settings?.hasManualTheme) return;
                    const newTheme = e.target.checked ? 'dark' : 'light';
                    const updated = { 
                      ...user, 
                      settings: { 
                        ...user.settings, 
                        theme: newTheme as any, 
                        hasManualTheme: true,
                        autoScheduleRevisions: user.settings?.autoScheduleRevisions ?? true, 
                        notificationsEnabled: user.settings?.notificationsEnabled ?? true, 
                        soundEnabled: user.settings?.soundEnabled ?? true 
                      } 
                    };
                    setUser(updated);
                    dbService.saveUser(updated);
                  }}
                  className="w-4 h-4 accent-gold-500 cursor-pointer"
                />
              </label>
              
              <label className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-gold-500/20 cursor-pointer hover:bg-black/60 transition-colors">
                <span className="text-sm font-medium text-gold-200">Auto-Schedule Revisions</span>
                <input 
                  type="checkbox" 
                  checked={user.settings?.autoScheduleRevisions !== false} 
                  onChange={(e) => {
                    const updated = { ...user, settings: { ...user.settings, theme: user.settings?.theme || 'dark', autoScheduleRevisions: e.target.checked, notificationsEnabled: user.settings?.notificationsEnabled ?? true, soundEnabled: user.settings?.soundEnabled ?? true } };
                    setUser(updated);
                    dbService.saveUser(updated);
                  }}
                  className="w-4 h-4 accent-gold-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-gold-500/20 cursor-pointer hover:bg-black/60 transition-colors">
                <span className="text-sm font-medium text-gold-200">Push Notifications</span>
                <input 
                  type="checkbox" 
                  checked={user.settings?.notificationsEnabled !== false} 
                  onChange={(e) => {
                    const updated = { 
                      ...user, 
                      settings: { 
                        ...user.settings, 
                        theme: user.settings?.theme || 'dark', 
                        autoScheduleRevisions: user.settings?.autoScheduleRevisions ?? true, 
                        notificationsEnabled: e.target.checked, 
                        soundEnabled: user.settings?.soundEnabled ?? true 
                      } 
                    };
                    setUser(updated);
                    dbService.saveUser(updated);
                    if (e.target.checked) {
                      notificationService.init();
                    } else {
                      notificationService.cancelAll();
                    }
                  }}
                  className="w-4 h-4 accent-gold-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-gold-500/20 cursor-pointer hover:bg-black/60 transition-colors">
                <span className="text-sm font-medium text-gold-200">Enable Sound Effects</span>
                <input 
                  type="checkbox" 
                  checked={user.settings?.soundEnabled !== false} 
                  onChange={(e) => {
                    const updated = { ...user, settings: { ...user.settings, theme: user.settings?.theme || 'dark', autoScheduleRevisions: user.settings?.autoScheduleRevisions ?? true, notificationsEnabled: user.settings?.notificationsEnabled ?? true, soundEnabled: e.target.checked } };
                    setUser(updated);
                    dbService.saveUser(updated);
                  }}
                  className="w-4 h-4 accent-gold-500 cursor-pointer"
                />
              </label>
            </div>

            {Capacitor.isNativePlatform() ? (
              <div className="flex flex-col mb-5 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,140,66,0.25)', background: 'rgba(0,0,0,0.35)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(255,140,66,0.08)', borderBottom: '1px solid rgba(255,140,66,0.15)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧠</span>
                    <div>
                      <p className="text-sm font-bold text-gold-200">Offline AI Brain</p>
                      <p className="text-[10px] text-gold-500/50">Works without internet</p>
                    </div>
                  </div>
                  {/* Status Badge */}
                  {copyStatus !== 'copying' && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${modelExists ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
                      <span>{modelExists ? '✓' : '!'}</span>
                      <span>{modelExists ? 'Active' : 'Not Set Up'}</span>
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 flex flex-col gap-3">
                  {/* What this does */}
                  <p className="text-[11px] text-gold-400/70 leading-relaxed">
                    {modelExists
                      ? '✅ Your AI brain is ready! The app can now generate roadmaps, tasks & answers fully offline — no internet needed.'
                      : 'Set up a local AI model once, and Kalam Spark will work fully offline — generate roadmaps, get answers and create tasks without any internet connection.'}
                  </p>

                  {copyStatus === 'copying' ? (
                    /* Progress state */
                    <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: 'rgba(255,140,66,0.06)', border: '1px solid rgba(255,140,66,0.15)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gold-300">Loading Model...</span>
                        <span className="text-xs font-bold text-orange-400">{copyProgress}%</span>
                      </div>
                      <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-gold-400 h-2 rounded-full transition-all duration-300" style={{ width: `${copyProgress}%` }} />
                      </div>
                      <p className="text-[10px] text-gold-500/50 text-center">Please wait, this may take a minute…</p>
                    </div>
                  ) : !modelExists ? (
                    /* Setup steps */
                    <div className="flex flex-col gap-2">
                      {/* Step 1 */}
                      <div className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                        <div className="w-6 h-6 rounded-full bg-purple-600/40 border border-purple-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-purple-300">1</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-purple-200 mb-0.5">Download the AI Model</p>
                          <p className="text-[10px] text-purple-300/60 leading-relaxed">Get the <strong className="text-purple-200">Gemma 4B</strong> model file <span className="text-purple-300/50">(~700 MB)</span> from Hugging Face and save it to your <strong className="text-purple-200">Downloads</strong> folder.</p>
                          <a
                            href="https://huggingface.co/google/gemma-4-E2B-it-GGUF/resolve/main/google_gemma-4-E2B-it-Q2_K.gguf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-purple-300 hover:text-purple-200 underline transition-colors"
                          >
                            ↗ Open Download Link
                          </a>
                        </div>
                      </div>
                      {/* Step 2 */}
                      <div className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: 'rgba(255,140,66,0.06)', border: '1px solid rgba(255,140,66,0.18)' }}>
                        <div className="w-6 h-6 rounded-full bg-orange-500/30 border border-orange-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-orange-300">2</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-gold-200 mb-0.5">Load it into Kalam Spark</p>
                          <p className="text-[10px] text-gold-400/60 leading-relaxed">After downloading, tap the button below to select the <strong className="text-gold-300">.gguf</strong> file from your device storage.</p>
                        </div>
                      </div>
                      {/* Load button */}
                      <button
                        onClick={handlePickModel}
                        className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                        style={{ background: 'linear-gradient(135deg, rgba(255,140,66,0.25), rgba(124,58,237,0.2))', border: '1px solid rgba(255,140,66,0.4)', color: '#fde68a' }}
                      >
                        <span>📂</span> Select Model File (.gguf)
                      </button>
                    </div>
                  ) : (
                    /* Model ready state */
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <span className="text-2xl">🎉</span>
                        <div>
                          <p className="text-xs font-semibold text-emerald-300">Gemma 4B Model Ready</p>
                          <p className="text-[10px] text-emerald-400/60">All offline features are now available</p>
                        </div>
                      </div>
                      <button
                        onClick={handlePickModel}
                        className="w-full py-2 rounded-lg text-[11px] font-semibold transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(253,230,138,0.5)' }}
                      >
                        Replace Model File
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col mb-5 rounded-xl overflow-hidden text-left" style={{ border: '1px solid rgba(255,140,66,0.25)', background: 'rgba(0,0,0,0.35)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(255,140,66,0.08)', borderBottom: '1px solid rgba(255,140,66,0.15)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧠</span>
                    <div>
                      <p className="text-sm font-bold text-gold-200">Offline AI Brain</p>
                      <p className="text-[10px] text-gold-500/50">Local Quantized Model</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
                    <span>App Feature</span>
                  </div>
                </div>

                <div className="px-4 py-3 flex flex-col gap-3">
                  <p className="text-[11px] text-gold-400/70 leading-relaxed">
                    To run local quantized AI models (.gguf) completely offline, please download and install our native Android App (.apk).
                  </p>
                  
                  <button
                    onClick={() => { setShowSettingsModal(false); handleInstallClick(); }}
                    className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-gold-200"
                    style={{ background: 'linear-gradient(135deg, rgba(255,140,66,0.25), rgba(124,58,237,0.2))', border: '1px solid rgba(255,140,66,0.4)' }}
                  >
                    <Download size={16} className="text-gold-400 animate-pulse" />
                    <span>Download Android App (.apk)</span>
                  </button>
                </div>
              </div>
            )}




            <button
              onClick={async () => {
                setShowSettingsModal(false);
                // Show splash first for a smooth transition experience
                setShowSplash(true);
                // Brief delay so splash is visible, then clear session
                setTimeout(async () => {
                  await dbService.clearSession();
                  // Force state reset in case onAuthStateChange doesn't fire (e.g. manual login)
                  setUser(prev => ({ ...prev, isAuthenticated: false }));
                  setSessionLoading(false);
                  // Reload the page to wipe any residual React memory states completely
                  window.location.reload();
                }, 1000);
              }}
              className="w-full py-3 text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all rounded-xl flex items-center justify-center gap-2"
              style={{ border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <LogOut size={16} /> Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  // Always show React splash on fresh page load/launch for a premium cinematic entrance experience
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<UserProfile>(() => {
    const cachedProfileRaw = localStorage.getItem('kalamspark_cached_profile');
    if (cachedProfileRaw) {
      try {
        const cached = JSON.parse(cachedProfileRaw) as UserProfile;
        if (cached && cached.id) {
          if (!cached.settings?.hasManualTheme) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const systemTheme = prefersDark ? 'dark' : 'light';
            if (cached.settings) {
              cached.settings.theme = systemTheme;
            }
          }
          return cached;
        }
      } catch (e) {}
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const systemTheme = prefersDark ? 'dark' : 'light';
    return {
      id: '', // Will be set by Supabase
      name: '',
      email: '',
      branch: '',
      year: '',
      dream: '',
      educationLevel: '',
      isAuthenticated: false,
      onboardingComplete: false,
      currentStageIndex: 0,
      xp: 0,
      streak: 0,
      rewards: [],
      settings: { theme: systemTheme, autoScheduleRevisions: true, notificationsEnabled: true, soundEnabled: true },
    };
  });

  const [sessionLoading, setSessionLoading] = useState(() => {
    const cachedProfileRaw = localStorage.getItem('kalamspark_cached_profile');
    if (cachedProfileRaw) {
      try {
        const cached = JSON.parse(cachedProfileRaw);
        return !(cached && cached.isAuthenticated && cached.id);
      } catch (e) {}
    }
    return true;
  });

  const [sessionLoadingMsg, setSessionLoadingMsg] = useState('Verifying session...');
  const [cachedRoadmap, setCachedRoadmap] = useState<CareerRoadmap | null>(null);
  const [cachedCompletedStages, setCachedCompletedStages] = useState<string[]>([]);

  // Tracks which user's profile has already been loaded from Supabase this session.
  // Stores the user ID string when loaded, null when not. Used to prevent the
  // onAuthStateChange duplicate call from overwriting a successfully-loaded profile.
  const profileLoadedRef = React.useRef<string | null>(null);

  // ── Supabase Auth Listener ──
  useEffect(() => {
    // ── 1. Initialize IndexedDB (KalamSparkDB) first — everything depends on it ──
    localDB.init().then(() => {
      localDB.migrateFromLocalStorage();
    }).catch(err => {
      console.warn('[App] IndexedDB init failed (will fall back to Supabase only):', err);
    });

    // ── 2. Instant session restore from localStorage cache ──
    // This prevents the flicker back to the login screen on Android app restarts.
    // If we have a backup profile in localStorage, restore it immediately so
    // the user doesn't see the login page while Supabase is still initializing.
    const cachedProfileRaw = localStorage.getItem('kalamspark_cached_profile');
    if (cachedProfileRaw) {
      try {
        const cachedProfile = JSON.parse(cachedProfileRaw) as UserProfile;
        if (cachedProfile?.isAuthenticated && cachedProfile?.id) {
          console.log('[App] Restored session from localStorage cache for:', cachedProfile.email || cachedProfile.id);
          profileLoadedRef.current = cachedProfile.id;
          
          let finalProfile = cachedProfile;
          if (!cachedProfile.settings?.hasManualTheme) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const systemTheme = prefersDark ? 'dark' : 'light';
            if (cachedProfile.settings?.theme !== systemTheme) {
              finalProfile = {
                ...cachedProfile,
                settings: {
                  ...cachedProfile.settings,
                  theme: systemTheme
                }
              };
            }
          }
          setUser(finalProfile);
          setSessionLoading(false);
        }
      } catch (e) {
        localStorage.removeItem('kalamspark_cached_profile');
      }
    }

    const handleSession = async (session: any, isInitial: boolean) => {
      // ── ALWAYS handle sign-out (null session) regardless of any guard ──
      // This must run first before any other check, so logout always works.
      if (!session) {
        // ── Priority 1: Explicit logout check ──
        // Only log the user out if THEY clicked "Log Out".
        // Token expiry, network failures, and Supabase errors must NEVER force a logout.
        const wasExplicitlyLoggedOut = localStorage.getItem('kalamspark_explicitly_logged_out') === 'true';

        if (!wasExplicitlyLoggedOut) {
          // ── Priority 2: Restore from localStorage cache (instant, no network needed) ──
          const cachedRaw = localStorage.getItem('kalamspark_cached_profile');
          if (cachedRaw) {
            try {
              const cached = JSON.parse(cachedRaw) as UserProfile;
              if (cached?.isAuthenticated && cached?.id) {
                console.log('[App] Session null but valid cache found — keeping user logged in:', cached.email || cached.id);
                if (!profileLoadedRef.current) {
                  profileLoadedRef.current = cached.id;
                  setUser({ ...cached, isAuthenticated: true });
                }
                setSessionLoading(false);
                return;
              }
            } catch (e) {
              localStorage.removeItem('kalamspark_cached_profile');
            }
          }

          // ── Priority 3: Manual email fallback — try DB, but don't fail hard ──
          const manualEmail = localStorage.getItem("kalamspark_manual_email");
          if (manualEmail) {
            try {
              const dbUser = await dbService.getUserByEmail(manualEmail);
              if (dbUser) {
                console.log('[App] Restored session from DB for manual email:', manualEmail);
                profileLoadedRef.current = dbUser.id;
                setUser({ ...dbUser, isAuthenticated: true });
                // Re-cache so next launch is instant
                localStorage.setItem('kalamspark_cached_profile', JSON.stringify({ ...dbUser, isAuthenticated: true }));
                setSessionLoading(false);
                return;
              } else {
                // Email in DB not found — must have been deleted, safe to remove
                localStorage.removeItem("kalamspark_manual_email");
              }
            } catch (err) {
              // Network error: keep the user logged in using whatever we have
              console.warn('[App] DB lookup failed during session restore — staying logged in:', err);
              if (profileLoadedRef.current) {
                // Already have a user loaded, just unblock the loading state
                setSessionLoading(false);
                return;
              }
            }
          }
        }

        // ── Priority 4: True logout ── (explicit logout OR no session data anywhere)
        console.log('[App] No session data found or explicit logout — showing login screen');
        localStorage.removeItem('kalamspark_explicitly_logged_out'); // consume the flag
        profileLoadedRef.current = null;
        setUser(prev => ({ ...prev, isAuthenticated: false, onboardingComplete: false }));
        setSessionLoading(false);
        return;
      }

      // For non-initial calls (onAuthStateChange duplicates): skip if we already
      // have this exact user's profile loaded, to prevent race conditions.
      if (!isInitial && profileLoadedRef.current === session.user.id) {
        setSessionLoading(false);
        return;
      }

      try {
        // 1. Try to find user by their email first. This is crucial for fixing the bug where 
        // using Google Auth with the same email creates a new user and resets onboarding.
        let dbUser = null;
        if (session.user.email) {
          dbUser = await dbService.getUserByEmail(session.user.email);
        }
        // 2. Fallback to ID lookup if no email exists
        if (!dbUser) {
          dbUser = await dbService.getUser(session.user.id);
        }

        if (dbUser) {
          // Existing user — restore full profile from Supabase
          profileLoadedRef.current = session.user.id;

          // IMPORTANT: If they logged in via a different provider (e.g. Google vs Magic Link),
          // Supabase Auth might have given them a new ID, but we found their old profile via email.
          // We MUST keep the old ID in the app state so that foreign keys (roadmaps, tasks, etc.)
          // remain perfectly connected to this user.
          if (dbUser.id !== session.user.id) {
             console.log('[App] Auth ID changed for existing email. Preserving original DB identity...');
          }

          let finalUser = dbUser;
          if (!dbUser.settings?.hasManualTheme) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const systemTheme = prefersDark ? 'dark' : 'light';
            if (dbUser.settings?.theme !== systemTheme) {
              finalUser = {
                ...dbUser,
                settings: {
                  ...dbUser.settings,
                  theme: systemTheme
                }
              };
            }
          }

          // Await background database restore if the local IndexedDB was wiped (Google/OAuth login)
          setSessionLoadingMsg('Synchronizing your workspace...');
          const localRoadmap = await localDB.get('roadmaps', finalUser.id).catch(() => null);
          if (!localRoadmap) {
            await dbService.populateLocalDB(finalUser.id).catch(err =>
              console.warn('[App] populateLocalDB failed during session change:', err)
            );
          }

          setUser(finalUser);
          // Save to localStorage cache for instant restore on next app open
          localStorage.setItem('kalamspark_cached_profile', JSON.stringify({ ...finalUser, isAuthenticated: true }));
          // Populate IndexedDB with all user data from Supabase (background, non-blocking)
          // This ensures all data is available offline on the next app launch
          if (isInitial) {
            dbService.populateLocalDB(finalUser.id).catch(err =>
              console.warn('[App] populateLocalDB failed (non-fatal):', err)
            );
          }
        } else {
          // Truly a NEW user — no row in DB yet. Build a clean initial record.
          const name = session.user.user_metadata?.name || session.user.user_metadata?.full_name || '';
          const newUser: UserProfile = {
            id: session.user.id,
            email: session.user.email,
            name: name,
            branch: '',
            year: '',
            educationLevel: '',
            dream: '',
            currentStageIndex: 0,
            isAuthenticated: true,
            onboardingComplete: false,
            xp: 0,
            streak: 0,
            rewards: [],
            settings: {
              theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
              autoScheduleRevisions: true,
              notificationsEnabled: true,
              soundEnabled: true,
            },
          };
          profileLoadedRef.current = session.user.id;
          setUser(newUser);
          await dbService.saveUser(newUser);
        }
      } catch (err) {
        // DB fetch or save failed — do NOT overwrite a successfully-loaded profile.
        console.error('[App] handleSession: DB error — preserving existing state.', err);
        if (!profileLoadedRef.current) {
          setUser(prev => ({
            ...prev,
            id: session.user.id,
            email: prev.email || session.user.email,
            isAuthenticated: true,
          }));
        }
      }

      setSessionLoading(false);
    };

    // isInitial=true: fired by getSession() on app start / page reload
    // isInitial=false: fired by onAuthStateChange (login, logout, token refresh)
    //
    // ── Offline Guard: If Supabase hangs (no internet), unblock after 4s ──
    // On Android without internet, supabase.auth.getSession() never resolves.
    // This timeout ensures the app always shows content from the localStorage cache.
    let sessionResolved = false;
    const offlineUnblockTimer = setTimeout(() => {
      if (sessionResolved) return; // already handled
      sessionResolved = true;
      console.warn('[App] getSession() timed out (offline?) — restoring from cache');
      const cachedRaw = localStorage.getItem('kalamspark_cached_profile');
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as UserProfile;
          if (cached?.isAuthenticated && cached?.id) {
            profileLoadedRef.current = cached.id;
            setUser({ ...cached, isAuthenticated: true });
            setSessionLoading(false);
            return;
          }
        } catch (e) {}
      }
      // No cache and still offline → show login screen
      setSessionLoading(false);
    }, 4000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      sessionResolved = true;
      clearTimeout(offlineUnblockTimer);
      handleSession(session, true);
    }).catch(() => {
      sessionResolved = true;
      clearTimeout(offlineUnblockTimer);
      // getSession threw — treat as offline, restore from cache
      const cachedRaw = localStorage.getItem('kalamspark_cached_profile');
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as UserProfile;
          if (cached?.isAuthenticated && cached?.id) {
            profileLoadedRef.current = cached.id;
            setUser({ ...cached, isAuthenticated: true });
          }
        } catch (e) {}
      }
      setSessionLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Show loading spinner for genuine state changes (login/logout),
      // but NOT for the duplicate INITIAL_SESSION event on every page load.
      if (!profileLoadedRef.current) {
        setSessionLoading(true);
      }
      handleSession(session, false);
    });

    // ── Capacitor Deep Link Listener for OAuth Redirects ──
    let appUrlListener: any = null;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        appUrlListener = App.addListener('appUrlOpen', async (data: any) => {
          console.log('[App] Deep link received:', data.url);
          if (data.url && data.url.startsWith('com.kalamspark.app://')) {
            try {
              // Convert custom scheme to an HTTP URL for URL parser
              const urlVal = data.url.replace('com.kalamspark.app://', 'http://localhost/');
              const parsedUrl = new URL(urlVal);
              
              if (parsedUrl.hash) {
                const params = new URLSearchParams(parsedUrl.hash.substring(1));
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');
                
                if (access_token && refresh_token) {
                  console.log('[App] Deep link credentials found, setting Supabase session...');
                  setSessionLoading(true);
                  import('@capacitor/browser').then(({ Browser }) => {
                    Browser.close().catch(() => {});
                  });
                  const { error } = await supabase.auth.setSession({
                    access_token,
                    refresh_token
                  });
                  if (error) {
                    console.error('[App] Failed to set deep link session:', error.message);
                    setSessionLoading(false);
                  }
                }
              }
            } catch (err) {
              console.error('[App] Error parsing deep link URL:', err);
            }
          }
        });
      });
    }

    return () => {
      clearTimeout(offlineUnblockTimer);
      subscription.unsubscribe();
      if (appUrlListener) {
        appUrlListener.then((l: any) => l.remove());
      }
    };
  }, []);



  // ── Sync theme class on HTML element ──
  useEffect(() => {
    const isDark = user.settings?.theme !== 'light';
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [user.settings?.theme]);

  // ── Sync theme when system color-scheme changes ──
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setUser(prev => {
        // Only auto-follow system if user hasn't manually set a theme
        if (prev.settings?.hasManualTheme) return prev;
        const newTheme = e.matches ? 'dark' : 'light';
        return { ...prev, settings: { ...prev.settings, theme: newTheme } as any };
      });
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Sync Retention Notifications on App State Changes ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let appStateListener: any = null;
    import('@capacitor/app').then(({ App }) => {
      appStateListener = App.addListener('appStateChange', (state) => {
        console.log('[App] App state changed:', state.isActive);
        if (!state.isActive && user.isAuthenticated && user.id) {
          notificationService.scheduleSmartRetentionNotifications(user);
        }
      });
    });

    if (user.isAuthenticated && user.id) {
      notificationService.scheduleSmartRetentionNotifications(user);
    }

    return () => {
      if (appStateListener) {
        appStateListener.then((l: any) => l.remove());
      }
    };
  }, [user.isAuthenticated, user.id, user.streak, user.dream, user.branch, user.settings?.notificationsEnabled]);

  // No Google OAuth — users start with name-only local session

  useEffect(() => {
    if (!user.isAuthenticated || !user.id) return;
    // Debounce saves to avoid hammering Supabase on rapid state changes
    const timer = setTimeout(() => {
      dbService.saveUser(user).catch(err =>
        console.warn('[App] Background save failed (will retry on next change):', err)
      );
    }, 800);
    return () => clearTimeout(timer);
  }, [user.id, user.xp, user.streak, user.currentStageIndex, user.onboardingComplete, user.settings, user.dream, user.avatar]);

  // ── Streak Logic — Auto-increment streak on daily login ───────────────────
  useEffect(() => {
    if (!user.isAuthenticated || !user.id) return;
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = localStorage.getItem('kalamspark_last_login_date');
    if (lastLogin !== today) {
       let newStreak = user.streak || 0;
       if (lastLogin) {
         const lastDate = new Date(lastLogin);
         const diff = Math.floor((new Date(today).getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
         if (diff === 1) newStreak += 1;
         else if (diff > 1) newStreak = 1;
       } else {
         newStreak = 1; // First day
       }
       localStorage.setItem('kalamspark_last_login_date', today);
       if (newStreak !== user.streak) {
         setUser(prev => ({ ...prev, streak: newStreak }));
       }
    }
  }, [user.isAuthenticated, user.id]);

  if (showSplash) {
    return (
      <>
        {user.settings?.theme === 'light' && <style>{LIGHT_THEME_CSS}</style>}
        <SplashScreen onComplete={() => setShowSplash(false)} isLight={user.settings?.theme === 'light'} />
      </>
    );
  }

  if (sessionLoading) {
    const isLight = user.settings?.theme === 'light';
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center gap-4 ${isLight ? 'bg-zinc-50' : 'bg-zinc-950'}`}>
        {isLight && <style>{LIGHT_THEME_CSS}</style>}
        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className={`text-sm font-semibold animate-pulse ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
          {sessionLoadingMsg}
        </p>
      </div>
    );
  }

  // ── Manual Zero-Verification Login ──
  const handleManualLogin = async (email: string, name: string) => {
    setSessionLoading(true);
    // Clear the explicit logout flag — user is actively logging in
    localStorage.removeItem('kalamspark_explicitly_logged_out');
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim() || cleanEmail.split('@')[0];

      // ── Clear ALL previous user data from localStorage before switching accounts ──
      // This prevents old user's data (tasks, roadmap, FileSpeaker, planner, etc.)
      // from leaking into the new user's session.
      const prevEmail = localStorage.getItem('kalamspark_manual_email');
      if (prevEmail && prevEmail !== cleanEmail) {
        // Different user logging in — wipe all user-scoped localStorage keys
        const keysToWipe = [
          'kalamspark_user_session', 'kalamspark_roadmap_data', 'kalamspark_cached_profile',
          'kalamspark_force_refresh', 'kalamspark_last_route', 'kalamspark_last_login_date',
          'kalamspark_roadmap_cache', 'kalamspark_concept_progress', 'kalamspark_mentor_titles',
          'fs_sources', 'fs_active_id', 'fs_states', 'fs_checked', 'fs_podcast_library',
          'ks_task_variety', 'ks_last_task_reset', 'ks_task_target',
        ];
        keysToWipe.forEach(k => localStorage.removeItem(k));
        sessionStorage.removeItem('kalamspark_radar');
        sessionStorage.removeItem('fs_import_url');
        // Also wipe the old user's IndexedDB data
        const prevUser = await dbService.getUserByEmail(prevEmail).catch(() => null);
        if (prevUser?.id) {
          localDB.clearUserData(prevUser.id).catch(() => {});
        }
        console.log('[App] Cleared previous user data for account switch');
      }

      let dbUser = await dbService.getUserByEmail(cleanEmail);
      
      if (dbUser) {
        // Log in as existing user
        profileLoadedRef.current = dbUser.id;
        
        // Populate IndexedDB with all user data BEFORE routing to app, to prevent race conditions
        setSessionLoadingMsg('Restoring your learning progress...');
        await dbService.populateLocalDB(dbUser.id).catch(err => {
          console.warn('[App] populateLocalDB failed:', err);
        });

        setUser({ ...dbUser, isAuthenticated: true });
        localStorage.setItem("kalamspark_manual_email", cleanEmail);
        // Cache for instant restore on next app open
        localStorage.setItem('kalamspark_cached_profile', JSON.stringify({ ...dbUser, isAuthenticated: true }));
      } else {
        // Create new user instantly
        const newId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newUser: UserProfile = {
          id: newId,
          email: cleanEmail,
          name: cleanName,
          branch: '',
          year: '',
          educationLevel: '',
          dream: '',
          currentStageIndex: 0,
          isAuthenticated: true,
          onboardingComplete: false,
          xp: 0,
          streak: 0,
          rewards: [],
          settings: {
            theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
            autoScheduleRevisions: true,
            notificationsEnabled: true,
            soundEnabled: true,
          },
        };
        profileLoadedRef.current = newId;
        setUser(newUser);
        await dbService.saveUser(newUser);
        localStorage.setItem("kalamspark_manual_email", cleanEmail);
        // Cache for instant restore on next app open
        localStorage.setItem('kalamspark_cached_profile', JSON.stringify(newUser));
      }
    } catch (err) {
      console.error("[App] Manual login failed", err);
    }
    setSessionLoading(false);
  };

  if (!user.isAuthenticated) {
    return (
      <>
        {user.settings?.theme === 'light' && <style>{LIGHT_THEME_CSS}</style>}
        <LoginScreen isLight={user.settings?.theme === 'light'} onManualLogin={handleManualLogin} />
      </>
    );
  }

  return (
    <>
      {/* Inject light theme globally so splash + login pages are also styled */}
      {user.settings?.theme === 'light' && <style>{LIGHT_THEME_CSS}</style>}
      <Router>
        <AppContent
          user={user}
          setUser={setUser}
          setShowSplash={setShowSplash}
          setSessionLoading={setSessionLoading}
          cachedRoadmap={cachedRoadmap}
          setCachedRoadmap={setCachedRoadmap}
          cachedCompletedStages={cachedCompletedStages}
          setCachedCompletedStages={setCachedCompletedStages}
        />
      </Router>
    </>
  );
}
