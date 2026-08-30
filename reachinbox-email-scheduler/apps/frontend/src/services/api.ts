import axios from 'axios';
import { Email, ScheduleEmailPayload, ScheduleResponse, Sender, SlackStatus, User } from '../types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '', // Uses VITE_API_URL in production, or Vite proxy in dev
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
  login: async (email: string, password: string): Promise<User> => {
    const res = await api.post<{ success: boolean; data: User }>('/api/auth/login', { email, password });
    return res.data.data;
  },
  register: async (email: string, password: string, name: string): Promise<User> => {
    const res = await api.post<{ success: boolean; data: User }>('/api/auth/register', { email, password, name });
    return res.data.data;
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
