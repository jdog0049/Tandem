export type User = { id: string; name: string; color: string };
export type Topic = { id: string; name: string; slot: string; chosenBy: string | null };
export type Lesson = {
  id: string; topicId: string; topicName: string; dayNumber: number;
  activityType: string; title: string; content: string; prompt: string | null;
  fact?: string; completed: boolean;
};
export type Challenge = {
  id: string; type: string; title: string; prompt: string; detail: string | null;
  unlocked: boolean; ownSubmitted: boolean;
  answers: { userId: string; name: string; answer: string }[] | null;
};
export type AppState = {
  authenticated: boolean;
  user?: User;
  partner?: User | null;
  inviteCode?: string;
  cycle?: { id: string; status: string; dayNumber: number; startDate: string | null } | null;
  topics?: Topic[];
  lessons?: Lesson[];
  progress?: Record<string, number>;
  challenge?: Challenge | null;
  streak?: number;
};
