import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ams_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401s (expired session)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized, clear token only if it's not a login attempt
      if (!error.config.url.includes('/auth/login')) {
        localStorage.removeItem('ams_token');
        localStorage.removeItem('ams_user');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  register: async (userData) => {
    const res = await api.post('/auth/register', userData);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  }
};

export const employeeApi = {
  getAll: async (params = {}) => {
    const res = await api.get('/employees', { params });
    return res.data;
  },
  getByCode: async (code) => {
    const res = await api.get(`/employees/${code}`);
    return res.data;
  },
  getStats: async () => {
    const res = await api.get('/employees/stats');
    return res.data;
  },
  getDepartments: async () => {
    const res = await api.get('/employees/departments');
    return res.data;
  },
  importFile: async (formData) => {
    const res = await api.post('/employees/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  },
  importSample: async (mode = 'upsert') => {
    const res = await api.post('/employees/import-sample', { mode });
    return res.data;
  },
  clear: async () => {
    const res = await api.delete('/employees/clear');
    return res.data;
  }
};

export const attendanceApi = {
  getAll: async (params = {}) => {
    const res = await api.get('/attendance', { params });
    return res.data;
  },
  importFile: async (formData) => {
    const res = await api.post('/attendance/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  },
  importSample: async (fileName = 'MD MAY.csv') => {
    const res = await api.post('/attendance/import-sample', { fileName });
    return res.data;
  },
  getMonths: async () => {
    const res = await api.get('/attendance/months');
    return res.data;
  },
  getDailyReport: async (params = {}) => {
    const res = await api.get('/attendance/reports/daily', { params });
    return res.data;
  },
  getMonthlyReport: async (params = {}) => {
    const res = await api.get('/attendance/reports/monthly', { params });
    return res.data;
  },
  getEmployeeReport: async (code, params = {}) => {
    const res = await api.get(`/attendance/reports/employee/${code}`, { params });
    return res.data;
  },
  getRangeReport: async (params = {}) => {
    const res = await api.get('/attendance/reports/range', { params });
    return res.data;
  },
  clear: async () => {
    const res = await api.delete('/attendance/clear');
    return res.data;
  }
};

export default api;
