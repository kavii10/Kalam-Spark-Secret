/**
 * FSRS (Free Spaced Repetition Scheduler) Service
 * Handles card scheduling based on user performance
 * Reference: https://github.com/open-spaced-repetition/ts-fsrs
 */

export interface FSRSCard {
  stability: number;  // Represents how stable the memory is
  difficulty: number; // Represents how difficult the card is (1-10)
  lastReview: Date;
  nextReview: Date;
  repetitionCount: number;
}

export interface FSRSReviewResult {
  newStability: number;
  newDifficulty: number;
  nextReviewDate: Date;
  interval: number; // Days until next review
}

export class FSRSService {
  // FSRS Configuration Constants
  private readonly REQUEST_RETENTION = 0.9; // Target retention rate
  private readonly MINIMUM_DIFFICULTY = 1;
  private readonly MAXIMUM_DIFFICULTY = 10;
  private readonly DECAY = -0.5;
  private readonly FACTOR = 19 / 81;

  /**
   * Calculate the next review date based on FSRS algorithm
   * @param card Current card state
   * @param grade User's self-evaluation (1-4)
   *  1 = again (hard),
   *  2 = hard,
   *  3 = good,
   *  4 = easy
   */
  public calculateNextReview(card: FSRSCard, grade: number): FSRSReviewResult {
    if (grade < 1 || grade > 4) {
      throw new Error("Grade must be between 1 and 4");
    }

    const interval = this.calculateInterval(card, grade);
    const newStability = this.calculateNewStability(card, grade, interval);
    const newDifficulty = this.calculateNewDifficulty(card, grade);
    const nextReviewDate = this.addDays(new Date(), interval);

    return {
      newStability,
      newDifficulty,
      nextReviewDate,
      interval,
    };
  }

  /**
   * Calculate the interval (in days) until the next review
   */
  private calculateInterval(card: FSRSCard, grade: number): number {
    if (grade === 1) {
      return 1; // Review again tomorrow
    }

    const factor = Math.pow(
      this.REQUEST_RETENTION,
      1 / (this.FACTOR * card.difficulty)
    );
    
    let interval: number;
    if (grade === 2) {
      interval = card.stability * factor * 1.2;
    } else if (grade === 3) {
      interval = card.stability * factor;
    } else {
      interval = card.stability * factor * 1.3;
    }

    return Math.ceil(interval);
  }

  /**
   * Calculate new stability value after review
   */
  private calculateNewStability(
    card: FSRSCard,
    grade: number,
    interval: number
  ): number {
    const hardPenalty = 0.96;
    const goodFactor = 1.0;
    const easyBonus = 1.3;

    let factor: number;
    if (grade === 1) {
      return Math.max(1, card.stability * hardPenalty - 0.14);
    } else if (grade === 2) {
      factor = hardPenalty;
    } else if (grade === 3) {
      factor = goodFactor;
    } else {
      factor = easyBonus;
    }

    return Math.max(1, card.stability * (factor + this.DECAY * Math.log(interval)));
  }

  /**
   * Calculate new difficulty value after review
   */
  private calculateNewDifficulty(card: FSRSCard, grade: number): number {
    const meanReversion = 0.9; // How much difficulty regresses to mean (5.0)
    const diffChanges = [-0.14, -0.14, 0, 0.1]; // Difficulty adjustments per grade

    const newDifficulty =
      card.difficulty +
      diffChanges[grade - 1] * (8 - 2 * card.difficulty) / 17;

    const meanDifficulty = 5.0;
    const adjustedDifficulty =
      meanReversion * newDifficulty + (1 - meanReversion) * meanDifficulty;

    return Math.max(
      this.MINIMUM_DIFFICULTY,
      Math.min(this.MAXIMUM_DIFFICULTY, adjustedDifficulty)
    );
  }

  /**
   * Get all due cards for review
   */
  public getDueCards(cards: (FSRSCard & { id: string })[]): (FSRSCard & { id: string })[] {
    const now = new Date();
    return cards.filter((card) => card.nextReview <= now);
  }

  /**
   * Get recommended review count for the day
   */
  public getRecommendedDailyReviewCount(
    cards: (FSRSCard & { id: string })[]
  ): number {
    const dueCards = this.getDueCards(cards);
    const newCards = cards.filter((c) => c.repetitionCount === 0).length;
    
    // Recommend a mix of due and new cards
    const recommendedNew = Math.min(newCards, 20);
    const recommendedReview = Math.min(dueCards.length, 100);
    
    return recommendedNew + recommendedReview;
  }

  /**
   * Initialize a new card
   */
  public initializeCard(): FSRSCard {
    const now = new Date();
    return {
      stability: 1.0,
      difficulty: 5.0,
      lastReview: now,
      nextReview: now, // Important: new cards should be due immediately!
      repetitionCount: 0,
    };
  }

  /**
   * Utility: Add days to a date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Get statistics for a set of cards
   */
  public getStatistics(cards: (FSRSCard & { id: string })[]): {
    total: number;
    dueToday: number;
    newCards: number;
    learned: number;
    averageStability: number;
    averageDifficulty: number;
  } {
    const dueCards = this.getDueCards(cards);
    const newCards = cards.filter((c) => c.repetitionCount === 0);
    const learned = cards.filter((c) => c.repetitionCount > 0);

    const avgStability =
      cards.length > 0
        ? cards.reduce((sum, c) => sum + c.stability, 0) / cards.length
        : 0;

    const avgDifficulty =
      cards.length > 0
        ? cards.reduce((sum, c) => sum + c.difficulty, 0) / cards.length
        : 0;

    return {
      total: cards.length,
      dueToday: dueCards.length,
      newCards: newCards.length,
      learned: learned.length,
      averageStability: Math.round(avgStability * 100) / 100,
      averageDifficulty: Math.round(avgDifficulty * 100) / 100,
    };
  }
}

export const fsrsService = new FSRSService();
