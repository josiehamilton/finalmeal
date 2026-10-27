export type { Database } from './database.types';
export { createFinalMealClient } from './client';
export type { FinalMealClient, FinalMealClientOptions } from './client';
export { ApiError, throwIfError } from './errors';
export type { FriendlyCode } from './errors';
export { friendlyCode, friendlyMessage } from './friendly';
export { sendEmailCode, signOut, verifyEmailCode } from './auth';
export {
  createMyProfile,
  finishOnboarding,
  getMyProfile,
  isUsernameAvailable,
  setMyHomeCity,
  updateMyProfile,
} from './profile';
export type { MyProfile, ProfilePatch } from './profile';
export { formatCityLabel, nearestCity, searchCities } from './cities';
export type { City } from './cities';
export { uploadMyAvatar } from './avatar';
export { formatStats, getFoundationStats } from './stats';
export type { FoundationStats } from './stats';
