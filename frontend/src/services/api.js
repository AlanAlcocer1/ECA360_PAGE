import axios from 'axios'

// Empty VITE_API_URL = same-origin (producción detrás de Nginx en :8080)
// En local (Vite :5173) usamos el backend por defecto.
const envUrl = import.meta.env.VITE_API_URL
const API_URL =
  envUrl !== undefined && envUrl !== null && String(envUrl).length > 0
    ? String(envUrl).replace(/\/$/, '')
    : import.meta.env.DEV
      ? 'http://localhost:8000'
      : ''

export const mediaUrl = (path) => {
  if (!path) return ''
  if (path.startsWith('http')) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return API_URL ? `${API_URL}${normalized}` : normalized
}

const api = axios.create({
  baseURL: API_URL || undefined,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eca360_admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authApi = {
  login: (password) => api.post('/admin/login', { password }),
  me: () => api.get('/admin/me'),
}

export const eventsApi = {
  list: (params) => api.get('/events', { params }),
  adminList: (params) => api.get('/events/admin/list', { params }),
  getBySlug: (slug) => api.get(`/events/slug/${slug}`),
  related: (slug) => api.get(`/events/slug/${slug}/related`),
  getById: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  remove: (id) => api.delete(`/events/${id}`),
  duplicate: (id) => api.post(`/events/${id}/duplicate`),
  publish: (id) => api.post(`/events/${id}/publish`),
  hide: (id) => api.post(`/events/${id}/hide`),
  templates: () => api.get('/events/templates'),
  years: () => api.get('/events/years'),
  stats: () => api.get('/events/admin/stats'),
}

export const commentsApi = {
  byEvent: (eventId) => api.get(`/comments/event/${eventId}`),
  recent: (params) => api.get('/comments/recent', { params }),
  create: (data) => api.post('/comments', data),
  adminList: (params) => api.get('/comments/admin/list', { params }),
  approve: (id) => api.patch(`/comments/${id}/approve`),
  disable: (id) => api.patch(`/comments/${id}/disable`),
  remove: (id) => api.delete(`/comments/${id}`),
}

export const uploadApi = {
  upload: (file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    })
  },
  list: () => api.get('/media'),
}

export const settingsApi = {
  get: () => api.get('/settings'),
  adminGet: () => api.get('/admin/settings'),
  update: (data) => api.put('/admin/settings', data),
}

export default api
