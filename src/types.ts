/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum ReportStatus {
  PENDING = 'Pending',
  PROSES = 'Proses',
  SELESAI = 'Selesai',
}

export interface User {
  id: string;
  email: string;
  password?: string;
  role: UserRole;
  createdAt: number;
}

export interface Report {
  id: string;
  userId: string;
  userEmail: string;
  ffId: string;
  reason: string;
  status: ReportStatus;
  screenshotUrl?: string; // Simulated URL
  isScreenshotConfirmed?: boolean;
  oldEmail?: string;
  newEmail?: string;
  verificationCode?: string;
  userEnteredCode?: string;
  createdAt: number;
  updatedAt: number;
  message?: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  reports: Report[];
}
