/**
 * rewardService.ts
 * Central service for checking and granting rewards (badges) to users.
 * Import and call checkAndGrantReward() from any component.
 */

import { Reward, UserProfile } from '../types';
import { dbService } from './dbService';

// Emitter for global reward notifications (popup shower)
type RewardListener = (reward: Reward, user: UserProfile) => void;
const listeners: RewardListener[] = [];

export const rewardEvents = {
  subscribe(fn: RewardListener) {
    listeners.push(fn);
    return () => { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); };
  },
  emit(reward: Reward, user: UserProfile) {
    listeners.forEach(fn => fn(reward, user));
  }
};

function alreadyHas(user: UserProfile, rewardId: string): boolean {
  return (user.rewards || []).some(r => r.id === rewardId);
}

/**
 * Grant a reward if the user doesn't already have it.
 * Returns the new UserProfile (updated rewards + xp) so the caller can setUser.
 */
export async function grantReward(
  user: UserProfile,
  reward: Reward,
  setUser: (u: UserProfile) => void,
  quiet: boolean = false
) {
  if (alreadyHas(user, reward.id)) return;

  const updatedRewards = [...(user.rewards || []), reward];
  const updatedUser: UserProfile = {
    ...user,
    rewards: updatedRewards,
    xp: (user.xp || 0) + reward.xpValue,
  };

  // Persist
  await dbService.saveReward(user.id, reward, user.rewards || []);
  setUser(updatedUser);

  // Fire shower event if not quiet
  if (!quiet) rewardEvents.emit(reward, updatedUser);
}

// ── Pre-built reward factories ────────────────────────────────────────────────

export function makeFirstRoadmapReward(): Reward {
  return {
    id: 'first_roadmap',
    type: 'first_roadmap',
    title: 'Roadmap Pioneer',
    description: 'Generated your first career roadmap!',
    icon: '🚀',
    earnedAt: new Date().toISOString(),
    xpValue: 50,
  };
}

export function makeStageCompleteReward(stageName: string, stageIndex: number, dream: string): Reward {
  // Sanitize dream to use in ID
  const safeDream = (dream || 'career').toLowerCase().replace(/[^a-z0-9]/g, '_');
  return {
    id: `stage_complete_${safeDream}_${stageIndex}`,
    type: 'stage_complete',
    title: `Stage ${stageIndex + 1} Complete`,
    description: `Completed "${stageName}" in your roadmap!`,
    icon: '🗺️',
    earnedAt: new Date().toISOString(),
    xpValue: 100,
  };
}

export function makeDailyTasksReward(date: string): Reward {
  return {
    id: `daily_tasks_${date}`,
    type: 'daily_tasks_complete',
    title: 'Day Champion',
    description: 'Completed all daily tasks!',
    icon: '✅',
    earnedAt: new Date().toISOString(),
    xpValue: 40,
  };
}

export function makePerfectQuizReward(topic: string, date: string): Reward {
  return {
    id: `perfect_quiz_${date}`,
    type: 'perfect_quiz',
    title: 'Quiz Master',
    description: `Got a perfect score on "${topic}" quiz!`,
    icon: '🎯',
    earnedAt: new Date().toISOString(),
    xpValue: 60,
  };
}

export function makeStreakReward(days: number): Reward {
  return {
    id: `streak_${days}`,
    type: 'streak_milestone',
    title: `${days}-Day Streak`,
    description: `Studied for ${days} days in a row!`,
    icon: '🔥',
    earnedAt: new Date().toISOString(),
    xpValue: days >= 30 ? 500 : 150,
  };
}
