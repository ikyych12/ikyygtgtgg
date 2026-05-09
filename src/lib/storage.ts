/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, User, Report, UserRole } from '../types';

const STORAGE_KEY = 'ff_recovery_app_state';

const defaultState: AppState = {
  currentUser: null,
  users: [
    {
      id: 'admin-id',
      email: 'admin@ff.com',
      password: 'admin', // Simple for demo
      role: UserRole.ADMIN,
      createdAt: Date.now(),
    }
  ],
  reports: [],
};

export const loadState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Ensure currentUser is sync'd with users list (in case email changed)
      if (parsed.currentUser) {
        const freshUser = parsed.users.find((u: User) => u.id === parsed.currentUser.id);
        if (freshUser) parsed.currentUser = freshUser;
      }
      return parsed;
    } catch (e) {
      return defaultState;
    }
  }
  return defaultState;
};

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearSession = () => {
  const state = loadState();
  state.currentUser = null;
  saveState(state);
};
