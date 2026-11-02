import { feedbackCatalog } from './encouragement'

/** Reading the welcome note does not create a favorite, session or reward. */
export const welcomeNote = {
  ...feedbackCatalog.welcomeNote,
  title: '欢迎笺',
} as const
