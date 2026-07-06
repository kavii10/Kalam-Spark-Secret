/**
 * Flashcard Service
 * Manages flashcard CRUD operations and integrates FSRS + Ebisu algorithms
 */

import { supabase } from "./supabaseClient";
import { fsrsService, FSRSCard } from "./fsrsService";
import { ebisuService, EbisuModel } from "./ebisuService";
import { UserProfile } from '../types';
import { localDB, DEVICE_ID, nowISO } from "./localDB";
import { offlineSyncService } from "./offlineSyncService";
import { networkService } from "./networkService";

export interface Flashcard {
  id: string;
  userId: string;
  deckId: string;
  front: string;
  back: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlashcardStats {
  id: string;
  userId: string;
  flashcardId: string;
  
  // FSRS
  stability: number;
  difficulty: number;
  repetitionCount: number;
  
  // Ebisu
  ebisuModel: EbisuModel;
  
  // Common
  nextReview: Date;
  lastReview: Date | null;
  lastGrade: number | null;
  reviewCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CardWithStats {
  card: Flashcard;
  stats: FlashcardStats;
}

export class FlashcardService {
  /**
   * Create a new flashcard
   */
  async createFlashcard(
    userId: string,
    deckId: string,
    front: string,
    back: string
  ): Promise<Flashcard> {
    const id = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const statsId = `stats_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = nowISO();
    
    const newCard = {
      id,
      user_id: userId,
      deck_id: deckId,
      front,
      back,
      active: true,
      created_at: now,
      updated_at: now,
    };

    const fsrsCard = fsrsService.initializeCard();
    const ebisuModel = ebisuService.initializeModel();

    const newStats = {
      id: statsId,
      user_id: userId,
      flashcard_id: id,
      stability: fsrsCard.stability,
      difficulty: fsrsCard.difficulty,
      repetition_count: fsrsCard.repetitionCount,
      ebisu_model: ebisuService.serializeModel(ebisuModel),
      next_review: fsrsCard.nextReview.toISOString(),
      last_review: null,
      last_grade: null,
      review_count: 0,
      created_at: now,
      updated_at: now,
    };

    // Save locally
    await localDB.put('flashcards', newCard, true);
    await localDB.put('flashcard_stats', newStats, true);

    // Sync to Supabase in background
    const enrichedCard = { ...newCard, _device_id: DEVICE_ID };
    const enrichedStats = { ...newStats, _device_id: DEVICE_ID };
    if (networkService.isOnline()) {
      try {
        await offlineSyncService.executeOne('save_flashcard', enrichedCard);
        await localDB.markSynced('flashcards', id);
      } catch (e) {
        await offlineSyncService.enqueue('save_flashcard', enrichedCard);
      }
      try {
        await offlineSyncService.executeOne('save_flashcard_stats', enrichedStats);
        await localDB.markSynced('flashcard_stats', statsId);
      } catch (e) {
        await offlineSyncService.enqueue('save_flashcard_stats', enrichedStats);
      }
    } else {
      await offlineSyncService.enqueue('save_flashcard', enrichedCard);
      await offlineSyncService.enqueue('save_flashcard_stats', enrichedStats);
    }

    return {
      id: newCard.id,
      userId: newCard.user_id,
      deckId: newCard.deck_id,
      front: newCard.front,
      back: newCard.back,
      active: newCard.active,
      createdAt: new Date(newCard.created_at),
      updatedAt: new Date(newCard.updated_at),
    };
  }

  /**
   * Get all flashcards for a user in a deck
   */
  async getFlashcardsInDeck(userId: string, deckId: string): Promise<CardWithStats[]> {
    if (networkService.isOnline()) {
      try {
        const { data, error } = await supabase
          .from("flashcards")
          .select(`
            id,
            user_id,
            deck_id,
            front,
            back,
            active,
            created_at,
            updated_at,
            flashcard_stats (
              id,
              user_id,
              flashcard_id,
              stability,
              difficulty,
              repetition_count,
              ebisu_model,
              next_review,
              last_review,
              last_grade,
              review_count,
              created_at,
              updated_at
            )
          `)
          .eq("user_id", userId)
          .eq("deck_id", deckId)
          .eq("active", true);

        if (error) throw error;

        if (data) {
          const cardsToPut: any[] = [];
          const statsToPut: any[] = [];
          data.forEach((card: any) => {
            cardsToPut.push({
              id: card.id,
              user_id: card.user_id,
              deck_id: card.deck_id,
              front: card.front,
              back: card.back,
              active: card.active,
              created_at: card.created_at,
              updated_at: card.updated_at,
            });
            if (card.flashcard_stats && card.flashcard_stats[0]) {
              statsToPut.push(card.flashcard_stats[0]);
            }
          });

          if (cardsToPut.length > 0) {
            await localDB.putMany('flashcards', cardsToPut, false);
          }
          if (statsToPut.length > 0) {
            await localDB.putMany('flashcard_stats', statsToPut, false);
          }
        }
      } catch (err) {
        console.warn("[FlashcardService] Error pre-fetching cards from Supabase, falling back to local:", err);
      }
    }

    // Load from local IndexedDB
    const allLocalCards = await localDB.getAll<any>('flashcards', 'user_id', userId);
    const deckCards = allLocalCards.filter(c => c.deck_id === deckId && c.active !== false);

    const allLocalStats = await localDB.getAll<any>('flashcard_stats', 'user_id', userId);
    const statsMap = new Map(allLocalStats.map(s => [s.flashcard_id, s]));

    return deckCards.map((card: any) => {
      const stat = statsMap.get(card.id);
      return {
        card: {
          id: card.id,
          userId: card.user_id,
          deckId: card.deck_id,
          front: card.front,
          back: card.back,
          active: card.active,
          createdAt: new Date(card.created_at),
          updatedAt: new Date(card.updated_at),
        },
        stats: stat ? {
          id: stat.id,
          userId: stat.user_id,
          flashcardId: stat.flashcard_id,
          stability: stat.stability,
          difficulty: stat.difficulty,
          repetitionCount: stat.repetition_count,
          ebisuModel: ebisuService.parseModel(stat.ebisu_model),
          nextReview: new Date(stat.next_review),
          lastReview: stat.last_review ? new Date(stat.last_review) : null,
          lastGrade: stat.last_grade,
          reviewCount: stat.review_count,
          createdAt: new Date(stat.created_at),
          updatedAt: new Date(stat.updated_at),
        } : this.createEmptyStats(card.id, userId),
      };
    });
  }

  /**
   * Get due cards for review
   */
  async getDueCards(userId: string): Promise<CardWithStats[]> {
    const now = new Date();

    if (networkService.isOnline()) {
      try {
        const { data, error } = await supabase
          .from("flashcard_stats")
          .select(`
            id,
            user_id,
            flashcard_id,
            stability,
            difficulty,
            repetition_count,
            ebisu_model,
            next_review,
            last_review,
            last_grade,
            review_count,
            created_at,
            updated_at,
            flashcards (
              id,
              user_id,
              deck_id,
              front,
              back,
              active,
              created_at,
              updated_at
            )
          `)
          .eq("user_id", userId)
          .lte("next_review", now.toISOString())
          .order("next_review", { ascending: true })
          .limit(50);

        if (error) throw error;

        if (data) {
          const cardsToPut: any[] = [];
          const statsToPut: any[] = [];
          
          data.forEach((stat: any) => {
            if (stat.flashcards) {
              const { flashcards, ...statProps } = stat;
              cardsToPut.push(flashcards);
              statsToPut.push(statProps);
            }
          });

          if (cardsToPut.length > 0) {
            await localDB.putMany('flashcards', cardsToPut, false);
          }
          if (statsToPut.length > 0) {
            await localDB.putMany('flashcard_stats', statsToPut, false);
          }
        }

        return (data || [])
          .filter((stat: any) => stat.flashcards && stat.flashcards.active)
          .map((stat: any) => ({
            card: {
              id: stat.flashcards.id,
              userId: stat.flashcards.user_id,
              deckId: stat.flashcards.deck_id,
              front: stat.flashcards.front,
              back: stat.flashcards.back,
              active: stat.flashcards.active,
              createdAt: new Date(stat.flashcards.created_at),
              updatedAt: new Date(stat.flashcards.updated_at),
            },
            stats: {
              id: stat.id,
              userId: stat.user_id,
              flashcardId: stat.flashcard_id,
              stability: stat.stability,
              difficulty: stat.difficulty,
              repetitionCount: stat.repetition_count,
              ebisuModel: ebisuService.parseModel(stat.ebisu_model),
              nextReview: new Date(stat.next_review),
              lastReview: stat.last_review ? new Date(stat.last_review) : null,
              lastGrade: stat.last_grade,
              reviewCount: stat.review_count,
              createdAt: new Date(stat.created_at),
              updatedAt: new Date(stat.updated_at),
            },
          }));
      } catch (err) {
        console.warn("[FlashcardService] Error fetching due cards from Supabase, falling back to local:", err);
      }
    }

    // Offline or fallback flow
    const allCards = await localDB.getAll<any>('flashcards', 'user_id', userId);
    const activeCardsMap = new Map(allCards.filter(c => c.active !== false).map(c => [c.id, c]));
    
    const allStats = await localDB.getAll<any>('flashcard_stats', 'user_id', userId);
    const nowStr = now.toISOString();
    
    const dueStats = allStats
      .filter(s => activeCardsMap.has(s.flashcard_id) && s.next_review <= nowStr)
      .sort((a, b) => a.next_review.localeCompare(b.next_review))
      .slice(0, 50);

    return dueStats.map(s => {
      const card = activeCardsMap.get(s.flashcard_id)!;
      return {
        card: {
          id: card.id,
          userId: card.user_id,
          deckId: card.deck_id,
          front: card.front,
          back: card.back,
          active: card.active,
          createdAt: new Date(card.created_at),
          updatedAt: new Date(card.updated_at),
        },
        stats: {
          id: s.id,
          userId: s.user_id,
          flashcardId: s.flashcard_id,
          stability: s.stability,
          difficulty: s.difficulty,
          repetitionCount: s.repetition_count,
          ebisuModel: ebisuService.parseModel(s.ebisu_model),
          nextReview: new Date(s.next_review),
          lastReview: s.last_review ? new Date(s.last_review) : null,
          lastGrade: s.last_grade,
          reviewCount: s.review_count,
          createdAt: new Date(s.created_at),
          updatedAt: new Date(s.updated_at),
        },
      };
    });
  }

  /**
   * Update card after a review
   */
  async reviewCard(
    userProfile: UserProfile,
    flashcardId: string,
    grade: number, // 1-4 for FSRS
    difficulty: 0 | 1 // 0=forgot, 1=recalled for Ebisu
  ): Promise<{ xpGain: number; stats: FlashcardStats }> {
    // Get current stats from local DB first
    let currentStats: any = null;
    const statData = await localDB.getAll<any>('flashcard_stats', 'flashcard_id', flashcardId);
    if (statData && statData.length > 0) {
      currentStats = statData[0];
    }
    
    // If not found locally but online, fetch from Supabase
    if (!currentStats && networkService.isOnline()) {
      try {
        const { data, error } = await supabase
          .from("flashcard_stats")
          .select("*")
          .eq("flashcard_id", flashcardId)
          .single();
        if (data && !error) {
          currentStats = data;
          await localDB.put('flashcard_stats', data, false);
        }
      } catch (err) {
        console.warn("[FlashcardService] Error fetching stats from Supabase in reviewCard:", err);
      }
    }

    if (!currentStats) {
      const emptyStats = this.createEmptyStats(flashcardId, userProfile.id);
      currentStats = {
        id: emptyStats.id || `stats_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userProfile.id,
        flashcard_id: flashcardId,
        stability: emptyStats.stability,
        difficulty: emptyStats.difficulty,
        repetition_count: emptyStats.repetitionCount,
        ebisu_model: ebisuService.serializeModel(emptyStats.ebisuModel),
        next_review: emptyStats.nextReview.toISOString(),
        last_review: emptyStats.lastReview ? emptyStats.lastReview.toISOString() : null,
        last_grade: emptyStats.lastGrade,
        review_count: emptyStats.reviewCount,
        created_at: emptyStats.createdAt.toISOString(),
        updated_at: emptyStats.updatedAt.toISOString(),
      };
    }

    // FSRS update
    const fsrsCard: FSRSCard = {
      stability: currentStats.stability,
      difficulty: currentStats.difficulty,
      lastReview: new Date(currentStats.last_review || new Date()),
      nextReview: new Date(currentStats.next_review),
      repetitionCount: currentStats.repetition_count,
    };

    const fsrsResult = fsrsService.calculateNextReview(fsrsCard, grade);

    // Ebisu update
    const ebisuModel = ebisuService.parseModel(currentStats.ebisu_model);
    const lastReview = currentStats.last_review ? new Date(currentStats.last_review) : new Date();
    const hoursElapsed = (Date.now() - lastReview.getTime()) / (1000 * 60 * 60);
    const updatedEbisuModel = ebisuService.updateModel(ebisuModel, difficulty, hoursElapsed);

    // Calculate XP gain based on performance
    let xpGain = 0;
    if (grade === 4) xpGain = 25; // Easy
    else if (grade === 3) xpGain = 20; // Good
    else if (grade === 2) xpGain = 10; // Hard
    else xpGain = 5; // Again

    // Update stats locally
    const now = nowISO();
    const updatedStats = {
      id: currentStats.id,
      user_id: userProfile.id,
      flashcard_id: flashcardId,
      stability: fsrsResult.newStability,
      difficulty: fsrsResult.newDifficulty,
      repetition_count: currentStats.repetition_count + 1,
      ebisu_model: ebisuService.serializeModel(updatedEbisuModel),
      next_review: fsrsResult.nextReviewDate.toISOString(),
      last_review: now,
      last_grade: grade,
      review_count: currentStats.review_count + 1,
      created_at: currentStats.created_at || now,
      updated_at: now,
    };

    await localDB.put('flashcard_stats', updatedStats, true);

    // Sync to Supabase in background
    const enriched = { ...updatedStats, _device_id: DEVICE_ID };
    if (networkService.isOnline()) {
      try {
        await offlineSyncService.executeOne('save_flashcard_stats', enriched);
        await localDB.markSynced('flashcard_stats', updatedStats.id);
      } catch (e) {
        await offlineSyncService.enqueue('save_flashcard_stats', enriched);
      }
    } else {
      await offlineSyncService.enqueue('save_flashcard_stats', enriched);
    }

    return {
      xpGain,
      stats: {
        id: updatedStats.id,
        userId: updatedStats.user_id,
        flashcardId: updatedStats.flashcard_id,
        stability: updatedStats.stability,
        difficulty: updatedStats.difficulty,
        repetitionCount: updatedStats.repetition_count,
        ebisuModel: ebisuService.parseModel(updatedStats.ebisu_model),
        nextReview: new Date(updatedStats.next_review),
        lastReview: new Date(updatedStats.last_review),
        lastGrade: updatedStats.last_grade,
        reviewCount: updatedStats.review_count,
        createdAt: new Date(updatedStats.created_at),
        updatedAt: new Date(updatedStats.updated_at),
      },
    };
  }

  /**
   * Get deck statistics
   */
  async getDeckStatistics(userId: string, deckId: string): Promise<any> {
    const cards = await this.getFlashcardsInDeck(userId, deckId);
    
    const fsrsStats = fsrsService.getStatistics(
      cards.map((c) => ({
        ...c.stats,
        id: c.stats.id,
        lastReview: c.stats.lastReview || new Date(),
        nextReview: c.stats.nextReview,
      }))
    );

    const ebisuStats = ebisuService.getStatistics(
      cards.map((c) => ({
        model: c.stats.ebisuModel,
        hoursElapsed: c.stats.lastReview ? (Date.now() - c.stats.lastReview.getTime()) / (1000 * 60 * 60) : 0,
      }))
    );

    return {
      fsrs: fsrsStats,
      ebisu: ebisuStats,
      totalCards: cards.length,
    };
  }

  /**
   * Create empty stats for new card
   */
  private createEmptyStats(flashcardId: string, userId: string): FlashcardStats {
    const fsrsCard = fsrsService.initializeCard();
    const ebisuModel = ebisuService.initializeModel();

    return {
      id: "",
      userId,
      flashcardId,
      stability: fsrsCard.stability,
      difficulty: fsrsCard.difficulty,
      repetitionCount: 0,
      ebisuModel,
      nextReview: fsrsCard.nextReview,
      lastReview: null,
      lastGrade: null,
      reviewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get memory strength for a card
   */
  async getMemoryStrength(statsId: string): Promise<number> {
    let stat = await localDB.get<any>('flashcard_stats', statsId);
    
    if (!stat && networkService.isOnline()) {
      try {
        const { data, error } = await supabase
          .from("flashcard_stats")
          .select("ebisu_model, last_review")
          .eq("id", statsId)
          .single();
        if (data && !error) {
          stat = data;
        }
      } catch (err) {
        console.warn("[FlashcardService] Error fetching stats in getMemoryStrength:", err);
      }
    }

    if (!stat) return 0;

    const ebisuModel = ebisuService.parseModel(stat.ebisu_model);
    const lastReview = stat.last_review ? new Date(stat.last_review) : new Date();
    const hoursElapsed = (Date.now() - lastReview.getTime()) / (1000 * 60 * 60);

    return ebisuService.predictRecall(ebisuModel, hoursElapsed);
  }

  /**
   * Update flashcard content
   */
  async updateFlashcard(id: string, front: string, back: string, deckId: string): Promise<void> {
    const now = nowISO();
    const existing = await localDB.get<any>('flashcards', id);
    const updatedCard = {
      ...existing,
      id,
      front,
      back,
      deck_id: deckId,
      updated_at: now,
    };

    // Save locally first
    await localDB.put('flashcards', updatedCard, true);

    // Sync to Supabase in background
    const enriched = { ...updatedCard, _device_id: DEVICE_ID };
    if (networkService.isOnline()) {
      try {
        await offlineSyncService.executeOne('save_flashcard', enriched);
        await localDB.markSynced('flashcards', id);
      } catch (e) {
        await offlineSyncService.enqueue('save_flashcard', enriched);
      }
    } else {
      await offlineSyncService.enqueue('save_flashcard', enriched);
    }
  }

  /**
   * Soft delete flashcard
   */
  async deleteFlashcard(id: string): Promise<void> {
    const now = nowISO();
    const existing = await localDB.get<any>('flashcards', id);
    const updatedCard = {
      ...existing,
      id,
      active: false,
      updated_at: now,
    };

    // Save locally first
    await localDB.put('flashcards', updatedCard, true);

    // Sync to Supabase in background
    const enriched = { id, updated_at: now, _device_id: DEVICE_ID };
    if (networkService.isOnline()) {
      try {
        await offlineSyncService.executeOne('delete_flashcard', enriched);
        await localDB.markSynced('flashcards', id);
      } catch (e) {
        await offlineSyncService.enqueue('delete_flashcard', enriched);
      }
    } else {
      await offlineSyncService.enqueue('delete_flashcard', enriched);
    }
  }
}

export const flashcardService = new FlashcardService();

