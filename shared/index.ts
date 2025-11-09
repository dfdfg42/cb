/**
 * Shared Module
 * 
 * Exports all shared validators, constants, and types.
 */

// Types (export first to avoid conflicts)
export * from './types';

// Validators (CardValidator and ValidationResult)
export { CardValidator, Card } from './validators/CardValidator';
export { CombatValidator } from './validators/CombatValidator';

// Constants
export * from './constants/GameConstants';
