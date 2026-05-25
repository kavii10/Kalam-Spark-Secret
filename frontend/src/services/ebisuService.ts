/**
 * Ebisu Service
 * Handles Bayesian probabilistic model for spaced repetition
 * Reference: https://github.com/fasiha/ebisu
 * 
 * Ebisu uses a Beta distribution to model the probability of recall
 * Model is stored as [α, β, t] where:
 * - α: shape parameter of Beta distribution
 * - β: shape parameter of Beta distribution
 * - t: time since last review (in hours)
 */

export interface EbisuModel {
  alpha: number;
  beta: number;
  t: number; // Hours since last review
}

export interface EbisuReviewResult {
  newModel: EbisuModel;
  predictedRecall: number; // Probability of recall (0-100)
}

export class EbisuService {
  /**
   * Initialize a new Ebisu model for a fresh card
   */
  public initializeModel(): EbisuModel {
    return {
      alpha: 3.0,
      beta: 3.0,
      t: 0,
    };
  }

  /**
   * Parse Ebisu model from JSON storage
   */
  public parseModel(modelJson: any): EbisuModel {
    if (Array.isArray(modelJson) && modelJson.length === 3) {
      return {
        alpha: modelJson[0],
        beta: modelJson[1],
        t: modelJson[2],
      };
    }
    return this.initializeModel();
  }

  /**
   * Serialize Ebisu model to JSON
   */
  public serializeModel(model: EbisuModel): number[] {
    return [model.alpha, model.beta, model.t];
  }

  /**
   * Calculate probability of recall at time t
   * Uses the Beta distribution: P(p) = B(α, β)
   * where p is the probability of recall
   */
  public predictRecall(model: EbisuModel, hoursElapsed: number = 0): number {
    const t = model.t + hoursElapsed;
    const decayFactor = Math.pow(0.5, t / (24 * 3)); // Half-life of ~3 days
    
    // Expected value of Beta distribution: α / (α + β)
    const expectedRecall = model.alpha / (model.alpha + model.beta);
    
    // Apply decay over time
    const predictedRecall = Math.max(0, Math.min(1, expectedRecall * decayFactor));
    
    return Math.round(predictedRecall * 100);
  }

  /**
   * Update Ebisu model after a review
   * @param model Current Ebisu model
   * @param difficulty Difficulty recall (0 = forgot, 1 = recalled)
   * @param hoursElapsed Hours since last review
   */
  public updateModel(
    model: EbisuModel,
    difficulty: 0 | 1,
    hoursElapsed: number
  ): EbisuModel {
    const t = model.t + hoursElapsed;
    const decayFactor = Math.pow(0.5, t / (24 * 3)); // Half-life of ~3 days

    // Bayesian update
    let alpha = model.alpha;
    let beta = model.beta;

    if (difficulty === 1) {
      // Correct recall: increase alpha
      alpha = model.alpha + decayFactor;
    } else {
      // Forgotten: increase beta
      beta = model.beta + (1 - decayFactor);
    }

    // Normalize to avoid numerical issues
    const total = alpha + beta;
    if (total > 100) {
      const scale = 50 / total;
      alpha *= scale;
      beta *= scale;
    }

    return {
      alpha: Math.max(0.5, alpha),
      beta: Math.max(0.5, beta),
      t: 0, // Reset time counter for next review
    };
  }

  /**
   * Suggest next review time based on current recall probability
   * Aims for ~90% recall probability at next review
   */
  public suggestNextReviewTime(model: EbisuModel): number {
    const targetRecall = 0.9;
    const expectedRecall = model.alpha / (model.alpha + model.beta);

    if (expectedRecall < 0.5) {
      return 0.5; // Review in 12 hours
    }

    // Rough estimate: time when recall drops to target
    // More sophisticated implementations would solve this precisely
    const hoursUntilTarget = Math.log(targetRecall / expectedRecall) / Math.log(0.5) * (24 * 3);

    return Math.max(0.5, hoursUntilTarget);
  }

  /**
   * Get memory strength as a percentage (0-100)
   */
  public getMemoryStrength(model: EbisuModel, hoursElapsed: number = 0): number {
    return this.predictRecall(model, hoursElapsed);
  }

  /**
   * Get recommendation for learning new cards vs reviewing
   */
  public getLearningRecommendation(
    cards: Array<{ model: EbisuModel; id: string; hoursElapsed: number }>
  ): {
    percentForReview: number;
    percentForNew: number;
    avgMemoryStrength: number;
  } {
    const avgMemoryStrength =
      cards.length > 0
        ? cards.reduce((sum, c) => sum + this.predictRecall(c.model, c.hoursElapsed), 0) /
          cards.length
        : 50;

    // If average memory is low, focus on review
    // If average memory is high, can focus on new cards
    const percentForReview = Math.min(100, Math.max(30, 100 - avgMemoryStrength + 50));
    const percentForNew = 100 - percentForReview;

    return {
      percentForReview,
      percentForNew,
      avgMemoryStrength: Math.round(avgMemoryStrength),
    };
  }

  /**
   * Simulate memory decay over time without review
   */
  public simulateDecay(model: EbisuModel, hoursElapsed: number): number {
    return this.predictRecall(model, hoursElapsed);
  }

  /**
   * Get statistics for a set of cards
   */
  public getStatistics(
    cards: Array<{ model: EbisuModel; hoursElapsed: number }>
  ): {
    averageRecall: number;
    maxRecall: number;
    minRecall: number;
    cardsAtRisk: number;
  } {
    if (cards.length === 0) {
      return {
        averageRecall: 100,
        maxRecall: 100,
        minRecall: 100,
        cardsAtRisk: 0,
      };
    }

    const recalls = cards.map((c) => this.predictRecall(c.model, c.hoursElapsed));
    const average = recalls.reduce((sum, r) => sum + r, 0) / recalls.length;
    const max = Math.max(...recalls);
    const min = Math.min(...recalls);
    const atRisk = recalls.filter((r) => r < 60).length;

    return {
      averageRecall: Math.round(average),
      maxRecall: max,
      minRecall: min,
      cardsAtRisk: atRisk,
    };
  }
}

export const ebisuService = new EbisuService();
