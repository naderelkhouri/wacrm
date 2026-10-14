/**
 * Django REST Framework API Client for WhatsApp CRM
 * Connects Next.js frontend to https://api-crm.admx.tech
 */

export interface DjangoUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'operator' | 'viewer';
  api_key_global: string;
  timezone: string;
  is_email_verified: boolean;
  last_active_company: number | null;
  created_at: string;
  updated_at: string;
}

export interface DjangoAuthResponse {
  refresh: string;
  access: string;
  user: DjangoUser;
}

export interface DjangoPaginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DjangoContact {
  id: number;
  company: number;
  name: string;
  phone_number: string;
  wa_id?: string;
  email?: string;
  tags?: string[] | { id: string; name: string }[];
  metadata?: Record<string, unknown>;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DjangoConversation {
  id: number;
  company: number;
  connection: number;
  contact: number | DjangoContact;
  status: 'open' | 'pending' | 'closed' | 'archived';
  assigned_to: number | null;
  external_thread_id?: string;
  metadata?: Record<string, unknown>;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DjangoMessage {
  id: number;
  company: number;
  conversation: number;
  connection: number;
  contact: number;
  direction: 'outbound' | 'inbound';
  message_type: string;
  status: 'draft' | 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  body: string;
  caption?: string;
  provider_message_id?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  created_at?: string;
}

export interface DjangoInstance {
  id: number;
  company: number;
  name: string;
  description?: string;
  provider: string;
  phone_id: string;
  phone_number_id: string;
  display_phone_number: string;
  status: 'pending' | 'connected' | 'disconnected' | 'blocked' | 'error';
  is_default: boolean;
  last_synced_at?: string | null;
}

export const DJANGO_API_BASE_URL =
  process.env.NEXT_PUBLIC_DJANGO_API_URL ||
  (typeof window !== 'undefined'
    ? 'https://api-crm.admx.tech'
    : process.env.DJANGO_INTERNAL_URL || 'https://api-crm.admx.tech');

export class DjangoApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'DjangoApiError';
    this.status = status;
    this.data = data;
  }
}

export async function djangoFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${DJANGO_API_BASE_URL.replace(/\/$/, '')}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: unknown = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }

    const message =
      typeof errorData === 'object' && errorData !== null && 'detail' in errorData
        ? String((errorData as { detail: unknown }).detail)
        : `Django API error: ${response.status} ${response.statusText}`;

    throw new DjangoApiError(message, response.status, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export const djangoApi = {
  health: () =>
    djangoFetch<{ status: string; service: string; version: string }>('/api/health/'),

  auth: {
    login: (identifier: string, password: string) =>
      djangoFetch<DjangoAuthResponse>('/api/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      }),

    refresh: (refreshToken: string) =>
      djangoFetch<{ access: string; refresh?: string }>('/api/auth/refresh/', {
        method: 'POST',
        body: JSON.stringify({ refresh: refreshToken }),
      }),

    me: (token: string) =>
      djangoFetch<DjangoUser>('/api/auth/me/', { method: 'GET' }, token),
  },

  contacts: {
    list: (
      params: { search?: string; limit?: number; offset?: number } = {},
      token: string
    ) => {
      const sp = new URLSearchParams();
      if (params.search) sp.set('search', params.search);
      if (params.limit !== undefined) sp.set('limit', String(params.limit));
      if (params.offset !== undefined) sp.set('offset', String(params.offset));
      const query = sp.toString() ? `?${sp.toString()}` : '';
      return djangoFetch<DjangoPaginated<DjangoContact>>(
        `/api/contacts/${query}`,
        { method: 'GET' },
        token
      );
    },

    get: (id: number | string, token: string) =>
      djangoFetch<DjangoContact>(`/api/contacts/${id}/`, { method: 'GET' }, token),

    create: (data: Partial<DjangoContact>, token: string) =>
      djangoFetch<DjangoContact>(
        '/api/contacts/',
        { method: 'POST', body: JSON.stringify(data) },
        token
      ),

    update: (id: number | string, data: Partial<DjangoContact>, token: string) =>
      djangoFetch<DjangoContact>(
        `/api/contacts/${id}/`,
        { method: 'PATCH', body: JSON.stringify(data) },
        token
      ),

    delete: (id: number | string, token: string) =>
      djangoFetch<void>(`/api/contacts/${id}/`, { method: 'DELETE' }, token),
  },

  conversations: {
    list: (
      params: { status?: string; contact?: number | string; limit?: number; offset?: number } = {},
      token: string
    ) => {
      const sp = new URLSearchParams();
      if (params.status) sp.set('status', params.status);
      if (params.contact) sp.set('contact', String(params.contact));
      if (params.limit !== undefined) sp.set('limit', String(params.limit));
      if (params.offset !== undefined) sp.set('offset', String(params.offset));
      const query = sp.toString() ? `?${sp.toString()}` : '';
      return djangoFetch<DjangoPaginated<DjangoConversation>>(
        `/api/conversations/${query}`,
        { method: 'GET' },
        token
      );
    },

    get: (id: number | string, token: string) =>
      djangoFetch<DjangoConversation>(`/api/conversations/${id}/`, { method: 'GET' }, token),
  },

  messages: {
    list: (
      params: { conversation?: number | string; limit?: number; offset?: number } = {},
      token: string
    ) => {
      const sp = new URLSearchParams();
      if (params.conversation) sp.set('conversation', String(params.conversation));
      if (params.limit !== undefined) sp.set('limit', String(params.limit));
      if (params.offset !== undefined) sp.set('offset', String(params.offset));
      const query = sp.toString() ? `?${sp.toString()}` : '';
      return djangoFetch<DjangoPaginated<DjangoMessage>>(
        `/api/messages/${query}`,
        { method: 'GET' },
        token
      );
    },

    send: (
      data: {
        conversation: number;
        body: string;
        message_type?: string;
      },
      token: string
    ) =>
      djangoFetch<DjangoMessage>(
        '/api/messages/',
        {
          method: 'POST',
          body: JSON.stringify({
            ...data,
            direction: 'outbound',
            message_type: data.message_type || 'text',
          }),
        },
        token
      ),
  },

  instances: {
    list: (token: string) =>
      djangoFetch<DjangoPaginated<DjangoInstance>>('/api/instances/', { method: 'GET' }, token),
  },
};
