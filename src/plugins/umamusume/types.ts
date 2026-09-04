export type UmaMotivation = '絶好調' | '好調' | '普通' | '不調' | '絶不調';

export interface TrainerProfile {
  jid: string;
  name: string;
  level: number;
  fansCount: number;
  carrots: number;
  lastTrainedAt?: number;
  lastFedAt?: number;
}

export interface OguriCapStatus {
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wit: number;
  motivation: UmaMotivation;
  satiety: number; // 0 - 100% (hunger level)
  totalMealsConsumed: number;
  totalRacesWon: number;
  totalRacesRun: number;
  favoriteFood: string;
  skillName: string;
}

export interface FoodOption {
  id: string;
  name: string;
  staminaGain: number;
  satietyGain: number;
  description: string;
  quote: string;
}

export interface TrainingResult {
  statName: 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Wit';
  gain: number;
  energySpent: number;
  success: boolean;
  message: string;
}

export interface RaceEvent {
  name: string;
  distance: string;
  track: string;
  rival: string;
  commentary: string[];
  victoryQuote: string;
  lossQuote: string;
}
