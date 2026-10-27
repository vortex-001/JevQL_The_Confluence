/**
 * Centralized API client for JevQL frontend.
 * Communicates with the Django REST Framework backend.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Token storage key in sessionStorage (avoid localStorage for security)
const TOKEN_KEY = 'jevql_auth_token';

export const getStoredToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setStoredToken = (token) => {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
};

export const clearStoredToken = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
};

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

/**
 * Core fetch wrapper with auth header, CSRF header, credentials, and JSON parsing.
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getStoredToken();
  const csrfToken = getCookie('csrftoken');

  const headers = {
    ...(options.headers || {}),
  };

  // Add JSON header if body is not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Add Auth Token if available
  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  // Add CSRF Token if present
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Includes Django session cookies
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  // Parse JSON response
  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = (typeof data === 'object' && data !== null && (data.error || data.detail || data.message))
      || (typeof data === 'string' && data)
      || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Authentication
  async login({ username, password }) {
    const data = await apiRequest('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data?.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async register({ username, email, password, first_name = '', last_name = '' }) {
    const data = await apiRequest('/api/auth/register/', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, first_name, last_name }),
    });
    if (data?.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async logout() {
    try {
      await apiRequest('/api/auth/logout/', {
        method: 'POST',
      });
    } finally {
      clearStoredToken();
    }
  },

  async getMe() {
    return apiRequest('/api/auth/me/');
  },

  // Search Dashboard
  async search(params = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.page) query.set('page', params.page);
    if (params.rating) query.set('rating', params.rating);
    if (params.workload) query.set('workload', params.workload);

    if (Array.isArray(params.dept)) {
      params.dept.forEach((d) => query.append('dept', d));
    } else if (params.dept) {
      query.set('dept', params.dept);
    }

    if (Array.isArray(params.sentiment)) {
      params.sentiment.forEach((s) => query.append('sentiment', s));
    } else if (params.sentiment) {
      query.set('sentiment', params.sentiment);
    }

    const qs = query.toString();
    return apiRequest(`/api/search/${qs ? `?${qs}` : ''}`);
  },

  async saveQuery({ name, query_text, dept, sentiment, rating, filters }) {
    return apiRequest('/api/search/save-query/', {
      method: 'POST',
      body: JSON.stringify({ name, query_text, dept, sentiment, rating, filters }),
    });
  },

  getExportCsvUrl(params = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.rating) query.set('rating', params.rating);
    if (Array.isArray(params.dept)) {
      params.dept.forEach((d) => query.append('dept', d));
    }
    if (Array.isArray(params.sentiment)) {
      params.sentiment.forEach((s) => query.append('sentiment', s));
    }
    const qs = query.toString();
    return `${API_BASE}/api/search/export/${qs ? `?${qs}` : ''}`;
  },

  // Executive Dashboard Overview
  async getDashboardOverview() {
    return apiRequest('/api/dashboard/overview/');
  },

  // Saved Queries
  async getSavedQueries() {
    return apiRequest('/api/saved-queries/');
  },

  async deleteSavedQuery(queryId) {
    return apiRequest(`/api/saved-queries/${queryId}/`, {
      method: 'DELETE',
    });
  },

  // Datasets
  async getDatasetRecords(page = 1) {
    return apiRequest(`/api/datasets/records/?page=${page}`);
  },

  async getDatasetMetadata() {
    return apiRequest('/api/datasets/metadata/');
  },

  async uploadDatasetCsv(file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/api/datasets/upload/', {
      method: 'POST',
      body: formData,
    });
  },

  // Analytics
  async getAnalyticsOverview() {
    return apiRequest('/api/analytics/overview/');
  },

  // Query History
  async getHistory() {
    return apiRequest('/api/history/');
  },

  async clearHistory() {
    return apiRequest('/api/history/', {
      method: 'POST',
      body: JSON.stringify({ action: 'clear' }),
    });
  },

  // Integrations & Database Connections
  async getConnections() {
    return apiRequest('/api/integrations/');
  },

  async testConnection({ host, port, database, username, password }) {
    return apiRequest('/api/integrations/', {
      method: 'POST',
      body: JSON.stringify({
        action: 'test',
        host,
        port: parseInt(port, 10),
        database,
        username,
        password,
      }),
    });
  },

  async connectDatabase({ name, host, port, database, username, password }) {
    return apiRequest('/api/integrations/', {
      method: 'POST',
      body: JSON.stringify({
        action: 'connect',
        name,
        host,
        port: parseInt(port, 10),
        database,
        username,
        password,
      }),
    });
  },

  async selectTargetTable(schemaName, tableName) {
    return apiRequest('/api/integrations/', {
      method: 'POST',
      body: JSON.stringify({
        action: 'select_table',
        schema_name: schemaName,
        table_name: tableName,
      }),
    });
  },

  async disconnectDatabase() {
    return apiRequest('/api/integrations/', {
      method: 'POST',
      body: JSON.stringify({
        action: 'disconnect',
      }),
    });
  },

  // Settings
  async getSettings() {
    return apiRequest('/api/settings/');
  },
};
