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
  create: async (data) => {
    const res = await api.post('/employees', data);
    return res.data;
  },
  update: async (code, data) => {
    const res = await api.put(`/employees/${code}`, data);
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
  importWorkbook: async (formData) => {
    const res = await api.post('/employees/import-workbook', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
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
  getMonths: async () => {
    const res = await api.get('/attendance/months');
    return res.data;
  },
  getEmployeeSheet: async (code, params = {}) => {
    const res = await api.get(`/attendance/employee/${code}/sheet`, { params });
    return res.data;
  },
  updateRecord: async (code, dateIso, data) => {
    const res = await api.put(`/attendance/employee/${code}/date/${dateIso}`, data);
    return res.data;
  },
  exportEmployeeSheet: async (code, params = {}) => {
    const res = await api.get(`/attendance/employee/${code}/export`, {
      params,
      responseType: 'blob'
    });
    return res;
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
  deleteBatch: async (payload) => {
    const body = Array.isArray(payload) ? { ids: payload } : (payload || {});
    const res = await api.post('/attendance/delete-batch', body);
    return res.data;
  },
  clear: async () => {
    const res = await api.delete('/attendance/clear');
    return res.data;
  }
};

export default api;
