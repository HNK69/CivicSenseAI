import api from './api.js';

/**
 * Officer Authentication Service
 */
export async function officerLogin(email, password) {
  const data = await api.post('/officer/auth/login', { email, password });
  return data;
}

export async function officerRegister(officerData) {
  const data = await api.post('/officer/auth/register', officerData);
  return data;
}
