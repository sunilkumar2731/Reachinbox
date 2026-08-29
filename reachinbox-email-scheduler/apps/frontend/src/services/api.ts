import axios from 'axios';
import { Email, ScheduleEmailPayload, ScheduleResponse, Sender, SlackStatus, User } from '../types';

export const api = axios.create({
  baseURL: '', // Vite proxy forwards /api to backend
  withCredentials: true, // Send session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authApi = {
  getMe: async (): Promise<User | null> => {
    try {
      const res = await api.get<{ success: boolean; data: User }>('/api/auth/me');
      return res.data.data;
    } catch {
      return null;
    }
  },
  devLogin: async (email?: string, name?: string): Promise<User> => {
    const res = await api.post<{ success: boolean; data: User }>('/api/auth/dev-login', { email, name });
    return res.data.data;
  },
  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout');
  },
};

export const emailApi = {
  schedule: async (payload: ScheduleEmailPayload): Promise<ScheduleResponse> => {
    const res = await api.post<{ success: boolean; data: ScheduleResponse }>('/api/emails/schedule', payload);
    return res.data.data;
  },
  getScheduled: async (): Promise<Email[]> => {
    const res = await api.get<{ success: boolean; data: Email[] }>('/api/emails/scheduled');
    return res.data.data;
  },
  getSent: async (): Promise<Email[]> => {
    const res = await api.get<{ success: boolean; data: Email[] }>('/api/emails/sent');
    return res.data.data;
  },
  search: async (query: string): Promise<Email[]> => {
    const res = await api.get<{ success: boolean; data: Email[] }>(`/api/emails/search?q=${encodeURIComponent(query)}`);
    return res.data.data;
  },
  getById: async (id: string): Promise<Email> => {
    const res = await api.get<{ success: boolean; data: Email }>(`/api/emails/${id}`);
    return res.data.data;
  },
};

export const senderApi = {
  list: async (): Promise<Sender[]> => {
    const res = await api.get<{ success: boolean; data: Sender[] }>('/api/senders');
    return res.data.data;
  },
  create: async (email?: string): Promise<Sender> => {
    const res = await api.post<{ success: boolean; data: Sender }>('/api/senders', { email });
    return res.data.data;
  },
};

export const slackApi = {
  getStatus: async (): Promise<SlackStatus> => {
    const res = await api.get<{ success: boolean; data: SlackStatus }>('/api/slack/status');
    return res.data.data;
  },
  disconnect: async (): Promise<void> => {
    await api.post('/api/slack/disconnect');
  },
};
