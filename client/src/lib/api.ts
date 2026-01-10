import axios, { AxiosInstance, AxiosError } from 'axios';



// Use relative URL for API calls - this ensures requests go to the same origin/port
// When accessed via port 443 → API calls go to port 443
// When accessed via port 857 (admin) → API calls go to port 857
const API_URL = '/api';

// For image/upload URLs, use the base URL if set, otherwise use relative path
// Images are served on all ports, so this is fine to be absolute
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Required for cookies and proper error responses
    });

    // Request interceptor to add auth token and handle FormData
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Remove Content-Type for FormData to let browser set it with boundary
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type'];
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        // Don't attempt token refresh for auth endpoints (login, signup, etc.)
        const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/');
        
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
          originalRequest._retry = true;

          try {
            // Refresh token is now in HttpOnly cookie, so we just call the endpoint
            const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, {
              withCredentials: true,
            });

            this.setToken(data.access_token);
            originalRequest.headers.Authorization = `Bearer ${data.access_token}`;

            return this.client(originalRequest);
          } catch (refreshError) {
            this.clearTokens();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  // Refresh token is no longer stored in accessible storage
  // private getRefreshToken(): string | null {
  //   if (typeof window !== 'undefined') {
  //     return localStorage.getItem('refresh_token');
  //   }
  //   return null;
  // }

  private setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  private clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      // localStorage.removeItem('refresh_token'); // Handled by cookie clearing on server or expiry
    }
  }

  // Auth endpoints
  async signup(data: { email: string; password: string; username: string; fullName: string; dateOfBirth: string; language: string; captchaToken: string }) {
    const response = await this.client.post('/auth/signup', data);
    return response.data;
  }

  async login(data: { emailOrUsername: string; password: string; captchaToken: string }) {
    const response = await this.client.post('/auth/login', data);

    if (response.data.access_token) {
      this.setToken(response.data.access_token);
      // Refresh token is set via HttpOnly cookie
    }

    return response.data;
  }

  async verify2FA(userId: string, code: string) {
    const response = await this.client.post('/auth/verify-2fa', { userId, code });

    if (response.data.access_token) {
      this.setToken(response.data.access_token);
      // Refresh token is set via HttpOnly cookie
    }

    return response.data;
  }

  async resend2FA(userId: string) {
    const response = await this.client.post('/auth/resend-2fa', { userId });
    return response.data;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } catch (e) {
      // Ignore errors on logout
    }
    this.clearTokens();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }

  async verifyEmail(token: string) {
    const response = await this.client.post('/auth/verify-email', { token });
    return response.data;
  }

  async forgotPassword(emailOrUsername: string, captchaToken: string) {
    const response = await this.client.post('/auth/forgot-password', { emailOrUsername, captchaToken });
    return response.data;
  }

  async resetPassword(token: string, password: string) {
    const response = await this.client.post('/auth/reset-password', { token, password });
    return response.data;
  }

  async resendVerificationEmail(email: string) {
    const response = await this.client.post('/auth/resend-verification-email', { email });
    return response.data;
  }

  // User endpoints
  async getProfile() {
    const response = await this.client.get('/users/profile');
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.post('/users/change-password', {
      currentPassword,
      newPassword
    });
    return response.data;
  }

  async toggle2FA(enabled: boolean) {
    const response = await this.client.put('/users/2fa', { enabled });
    return response.data;
  }

  async updateLanguage(language: string) {
    const response = await this.client.put('/users/language', { language });
    return response.data;
  }

  async exportUserData() {
    const response = await this.client.get('/users/export-data');
    return response.data;
  }

  async requestAccountDeletion(password: string, reason?: string) {
    const response = await this.client.post('/users/request-deletion', { password, reason });
    return response.data;
  }

  async deleteAccount(password: string, confirmDeletion: boolean) {
    const response = await this.client.delete('/users/delete-account', {
      data: { password, confirmDeletion }
    });
    return response.data;
  }

  async getAllUsers(search?: string, timeFilter?: string, page: number = 1, limit: number = 50) {
    const response = await this.client.get('/users/all', {
      params: { search, timeFilter, page, limit },
    });
    return response.data;
  }

  async getUserTransactions(userId: string, timeFilter?: string) {
    const response = await this.client.get(`/users/${userId}/transactions`, {
      params: { userId, timeFilter },
    });
    return response.data;
  }

  // Bets endpoints
  async getBets(categoryId?: string, result?: string, page: number = 1, limit: number = 50) {
    const response = await this.client.get('/bets', {
      params: { categoryId, result, page, limit },
    });
    return response.data;
  }

  async getBet(id: string) {
    const response = await this.client.get(`/bets/${id}`);
    return response.data;
  }

  async getAllCategoriesWithAccess() {
    const response = await this.client.get('/bets/all-categories');
    return response.data;
  }

  async downloadBet(id: string) {
    const response = await this.client.get(`/bets/${id}/export`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Plans endpoints (legacy)
  async getPlans() {
    const response = await this.client.get('/plans');
    return response.data;
  }

  // Packs endpoints
  async getPacks() {
    const response = await this.client.get('/packs');
    return response.data;
  }

  async getPacksPaginated(includeInactive = false, page = 1, limit = 50) {
    const response = await this.client.get('/packs/paginated', {
      params: { includeInactive: includeInactive.toString(), page, limit },
    });
    return response.data;
  }

  async getPack(id: string) {
    const response = await this.client.get(`/packs/${id}`);
    return response.data;
  }

  async getMyPacks() {
    const response = await this.client.get('/packs/my');
    return response.data;
  }

  async createPack(data: any) {
    const response = await this.client.post('/packs', data);
    return response.data;
  }

  async updatePack(id: string, data: any) {
    const response = await this.client.put(`/packs/${id}`, data);
    return response.data;
  }

  async deletePack(id: string) {
    const response = await this.client.delete(`/packs/${id}`);
    return response.data;
  }

  async linkCategoriesToPack(packId: string, categoryIds: string[]) {
    const response = await this.client.post(`/packs/${packId}/categories`, { categoryIds });
    return response.data;
  }

  async setPackHierarchy(packId: string, includedPackIds: string[]) {
    const response = await this.client.post(`/packs/${packId}/hierarchy`, { includedPackIds });
    return response.data;
  }

  // Categories endpoints
  async getCategories(includeInactive = false) {
    const response = await this.client.get('/categories', {
      params: { includeInactive },
    });
    return response.data;
  }

  async getCategoriesPaginated(includeInactive = false, page = 1, limit = 50) {
    const response = await this.client.get('/categories/paginated', {
      params: { includeInactive: includeInactive.toString(), page, limit },
    });
    return response.data;
  }

  async getMyCategories() {
    const response = await this.client.get('/categories/my');
    return response.data;
  }

  async getCategory(id: string) {
    const response = await this.client.get(`/categories/${id}`);
    return response.data;
  }

  async createCategory(data: any) {
    const response = await this.client.post('/categories', data);
    return response.data;
  }

  async updateCategory(id: string, data: any) {
    const response = await this.client.put(`/categories/${id}`, data);
    return response.data;
  }

  async deleteCategory(id: string) {
    const response = await this.client.delete(`/categories/${id}`);
    return response.data;
  }

  // Subscriptions endpoints
  async createSubscription(packId: string) {
    const response = await this.client.post('/subscriptions', { packId });
    return response.data;
  }

  async getSubscriptions() {
    const response = await this.client.get('/subscriptions');
    return response.data;
  }

  async getActiveSubscriptions() {
    const response = await this.client.get('/subscriptions/active');
    return response.data;
  }

  // Dashboard endpoints
  async getDashboardStats() {
    const response = await this.client.get('/dashboard/stats');
    return response.data;
  }

  // Admin endpoints
  async getAdminStats() {
    const response = await this.client.get('/admin/stats');
    return response.data;
  }

  async getRevenueOverview() {
    const response = await this.client.get('/admin/revenue');
    return response.data;
  }

  async getAdminBets(page: number = 1, limit: number = 50) {
    const response = await this.client.get('/admin/bets', {
      params: { page, limit },
    });
    return response.data;
  }

  async createBet(formData: FormData) {
    const response = await this.client.post('/admin/bets', formData);
    return response.data;
  }

  async updateBet(id: string, formData: FormData) {
    const response = await this.client.put(`/admin/bets/${id}`, formData);
    return response.data;
  }

  async deleteBet(id: string) {
    const response = await this.client.delete(`/admin/bets/${id}`);
    return response.data;
  }

  async publishBet(id: string) {
    const response = await this.client.post(`/admin/bets/${id}/publish`);
    return response.data;
  }

  async updateBetResult(id: string, result: string) {
    const response = await this.client.put(`/admin/bets/${id}/result`, { result });
    return response.data;
  }

  async getAdminSubscriptions() {
    const response = await this.client.get('/admin/subscriptions');
    return response.data;
  }

  async refundSubscription(id: string) {
    const response = await this.client.post(`/admin/subscriptions/${id}/refund`);
    return response.data;
  }

  // Stripe Customer Portal - for managing payment methods
  async createCustomerPortal(): Promise<{ url: string }> {
    const response = await this.client.post('/subscriptions/customer-portal');
    return response.data;
  }

  // Statistics endpoints (public - no auth required)
  async getStatistics(month?: number, year?: number) {
    const response = await this.client.get('/statistics', {
      params: { month, year },
    });
    return response.data;
  }

  async getAvailableMonths() {
    const response = await this.client.get('/statistics/available-months');
    return response.data;
  }

  async getAvailableYears() {
    const response = await this.client.get('/statistics/available-years');
    return response.data;
  }

  async getHistoricalStatistics(year?: number) {
    const response = await this.client.get('/statistics/historical', {
      params: year ? { year } : {},
    });
    return response.data;
  }
}

export const api = new ApiClient();
