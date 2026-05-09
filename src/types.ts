/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  PROSES = 'PROSES',
  SELESAI = 'SELESAI',
  GAGAL = 'GAGAL',
  BATAL = 'BATAL',
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
  googleLama: string; // Changed from ffId
  status: ReportStatus;
  recoveredPassword?: string;
  userFeedback?: 'BERHASIL' | 'GAK_BISA';
  createdAt: number;
  updatedAt: number;
  message?: string;
  // Kept for backward compatibility if needed, but not primarily used in the new flow
  ffId?: string;
  reason?: string;
  screenshotUrl?: string;
  isScreenshotConfirmed?: boolean;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  reports: Report[];
}
