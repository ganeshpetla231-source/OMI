import { apiClient } from './client';

export const realAuthApi = {
  async register(payload) {
    const response = await apiClient.post('/auth/register', payload);
    return response.data;
  },
  async login(payload) {
    const response = await apiClient.post('/auth/login', payload);
    return response.data;
  },
  async logout() {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },
  async getMe() {
    const response = await apiClient.get('/auth/me');
    return response.data?.user ?? response.data;
  },
  async changePassword(payload) {
    const response = await apiClient.put('/auth/change-password', payload);
    return response.data;
  },
};
