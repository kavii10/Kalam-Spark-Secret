/**
 * Flashcard Service
 * Manages flashcard CRUD operations and integrates FSRS + Ebisu algorithms
 */

import { supabase } from "./supabaseClient";
import { fsrsService, FSRSCard } from "./fsrsService";
import { ebisuService, EbisuModel } from "./ebisuService";
import { UserProfile } from '../types';

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
    
    const { data, error } = await supabase
      .from("flashcards")
      .insert({
        id,
        user_id: userId,
        deck_id: deckId,
        front,
        back,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Initialize stats
    await this.initializeCardStats(userId, id);

    return {
      id: data.id,
      userId: data.user_id,
      deckId: data.deck_id,
      front: data.front,
      back: data.back,
      active: data.active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Initialize stats for a new card
   */
  private async initializeCardStats(userId: string, flashcardId: string): Promise<void> {
    const statsId = `stats_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fsrsCard = fsrsService.initializeCard();
    const ebisuModel = ebisuService.initializeModel();

    const { error } = await supabase
      .from("flashcard_stats")
      .insert({
        id: statsId,
        user_id: userId,
        flashcard_id: flashcardId,
        stability: fsrsCard.stability,
        difficulty: fsrsCard.difficulty,
        repetition_count: fsrsCard.repetitionCount,
        ebisu_model: ebisuService.serializeModel(ebisuModel),
        next_review: fsrsCard.nextReview.toISOString(),
        review_count: 0,
      });

    if (error) throw error;
  }

  /**
   * Get all flashcards for a user in a deck
   */
  async getFlashcardsInDeck(userId: string, deckId: string): Promise<CardWithStats[]> {
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

    return (data || []).map((card: any) => ({
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
      stats: card.flashcard_stats[0] ? {
        id: card.flashcard_stats[0].id,
        userId: card.flashcard_stats[0].user_id,
        flashcardId: card.flashcard_stats[0].flashcard_id,
        stability: card.flashcard_stats[0].stability,
        difficulty: card.flashcard_stats[0].difficulty,
        repetitionCount: card.flashcard_stats[0].repetition_count,
        ebisuModel: ebisuService.parseModel(card.flashcard_stats[0].ebisu_model),
        nextReview: new Date(card.flashcard_stats[0].next_review),
        lastReview: card.flashcard_stats[0].last_review ? new Date(card.flashcard_stats[0].last_review) : null,
        lastGrade: card.flashcard_stats[0].last_grade,
        reviewCount: card.flashcard_stats[0].review_count,
        createdAt: new Date(card.flashcard_stats[0].created_at),
        updatedAt: new Date(card.flashcard_stats[0].updated_at),
      } : this.createEmptyStats(card.id, userId),
    }));
  }

  /**
   * Get due cards for review
   */
  async getDueCards(userId: string): Promise<CardWithStats[]> {
    const now = new Date();

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
    // Get current stats
    const { data: statData, error: statError } = await supabase
      .from("flashcard_stats")
      .select("*")
      .eq("flashcard_id", flashcardId)
      .single();

    if (statError) throw statError;

    // FSRS update
    const fsrsCard: FSRSCard = {
      stability: statData.stability,
      difficulty: statData.difficulty,
      lastReview: new Date(statData.last_review || new Date()),
      nextReview: new Date(statData.next_review),
      repetitionCount: statData.repetition_count,
    };

    const fsrsResult = fsrsService.calculateNextReview(fsrsCard, grade);

    // Ebisu update
    const ebisuModel = ebisuService.parseModel(statData.ebisu_model);
    const lastReview = statData.last_review ? new Date(statData.last_review) : new Date();
    const hoursElapsed = (Date.now() - lastReview.getTime()) / (1000 * 60 * 60);
    const updatedEbisuModel = ebisuService.updateModel(ebisuModel, difficulty, hoursElapsed);

    // Calculate XP gain based on performance
    let xpGain = 0;
    if (grade === 4) xpGain = 25; // Easy
    else if (grade === 3) xpGain = 20; // Good
    else if (grade === 2) xpGain = 10; // Hard
    else xpGain = 5; // Again

    // Update stats
    const { data: updatedStats, error: updateError } = await supabase
      .from("flashcard_stats")
      .update({
        stability: fsrsResult.newStability,
        difficulty: fsrsResult.newDifficulty,
        repetition_count: statData.repetition_count + 1,
        ebisu_model: ebisuService.serializeModel(updatedEbisuModel),
        next_review: fsrsResult.nextReviewDate.toISOString(),
        last_review: new Date().toISOString(),
        last_grade: grade,
        review_count: statData.review_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("flashcard_id", flashcardId)
      .select()
      .single();

    if (updateError) throw updateError;

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
        hoursElapsed: (Date.now() - c.stats.lastReview!.getTime()) / (1000 * 60 * 60),
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
    const { data, error } = await supabase
      .from("flashcard_stats")
      .select("ebisu_model, last_review")
      .eq("id", statsId)
      .single();

    if (error) throw error;

    const ebisuModel = ebisuService.parseModel(data.ebisu_model);
    const lastReview = data.last_review ? new Date(data.last_review) : new Date();
    const hoursElapsed = (Date.now() - lastReview.getTime()) / (1000 * 60 * 60);

    return ebisuService.predictRecall(ebisuModel, hoursElapsed);
  }

  /**
   * Update flashcard content
   */
  async updateFlashcard(id: string, front: string, back: string, deckId: string): Promise<void> {
    const { error } = await supabase
      .from("flashcards")
      .update({ front, back, deck_id: deckId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  /**
   * Soft delete flashcard
   */
  async deleteFlashcard(id: string): Promise<void> {
    const { error } = await supabase
      .from("flashcards")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }
}

export const flashcardService = new FlashcardService();
