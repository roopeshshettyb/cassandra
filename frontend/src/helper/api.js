import axios from 'axios';
import constants from '../constants.json';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to automatically include token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // FormData must be sent without Content-Type so browser sets multipart/form-data with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

async function request({ endpoint, method = 'GET', data, token, headers = {}, setLoading, setData, defaultData = [], throw: shouldThrow = false, alertSuccess, alertError, delay = true }) {
  const config = {
    method,
    url: endpoint,
    headers: {
      ...headers,
    },
  };

  // If token is explicitly provided, use it (overrides interceptor)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (data) {
    config.data = data;
    if (data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
  }

  let loadingTimeout = null;
  if (setLoading) {
    if (delay === false) {
      setLoading(true);
    } else {
      loadingTimeout = setTimeout(() => {
        setLoading(true);
      }, 700);
    }
  }

  try {
    const response = await axiosInstance.request(config);
    const responseData = response.data;
    // If setData is provided, automatically set the data
    if (setData && responseData.data) {
      setData(responseData.data || defaultData);
    }

    // Show success toast if alertSuccess is provided and message exists
    if (alertSuccess && responseData?.message) {
      alertSuccess(responseData.message);
    }

    return responseData;
  } catch (error) {
    // If setData is provided and there's an error, set defaultData
    if (setData) {
      setData(defaultData);
    }

    // Show error toast if alertError is provided
    if (alertError) {
      const errorMessage = error.response?.data?.message || error.message || 'An error occurred';
      alertError(errorMessage);
    }

    if (shouldThrow) {
      throw error;
    }
    return null;
  } finally {
    // Set loading to false in finally block to ensure it's always reset
    if (setLoading) {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      setLoading(false);
    }
  }
}

export default request;
