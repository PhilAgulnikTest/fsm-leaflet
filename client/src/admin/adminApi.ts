/* Admin API client. All requests sit behind requireSession('platform-admin').
 * A 401 from any endpoint means the session expired — components handle this
 * by redirecting to the login page. */

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let code = `http_${res.status}`;
    let extra: unknown = null;
    try {
      const body = await res.json();
      if (body?.error) code = body.error;
      extra = body;
    } catch { /* fall through */ }
    const err = new Error(code) as Error & { extra?: unknown; status?: number };
    err.extra = extra;
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export type AdminTemplate = {
  id: number;
  slug: string;
  name: string;
  description: string;
  audience: 'school' | 'la' | 'housing-association';
  version: number;
  changelog: string;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
};

export type AdminTemplateDetail = AdminTemplate & {
  body_path: string;
  default_palette: Record<string, unknown>;
  facts: Record<string, unknown>;
};

export type AdminLAClient = {
  slug: string;
  name: string;
  calculator_subdomain: string;
  default_brand_colour: string;
  default_accent_colour: string;
  logo_url: string | null;
  default_source_url: string | null;
  enabled_languages: string[];
  notes: string;
  created_at: string;
  updated_at: string;
};

export type TrustDomainRequest = {
  id: number;
  domain: string;
  requested_email: string;
  requested_for_urn: string | null;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type TrustDomainEntry = {
  domain: string;
  approved_by: string;
  approved_at: string;
  notes: string;
};

export const adminApi = {
  login: (email: string, password: string) =>
    jsonFetch<{ ok: true; email: string }>(`/api/auth/platform/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => jsonFetch<{ ok: true }>(`/api/auth/logout`, { method: 'POST' }),
  me: () => jsonFetch<{ session: { email: string; scope: string } | null }>(`/api/auth/me`),

  // Templates
  listTemplates: () => jsonFetch<{ templates: AdminTemplate[] }>(`/api/admin/templates`),
  getTemplate: (id: number) =>
    jsonFetch<{ template: AdminTemplateDetail }>(`/api/admin/templates/${id}`),
  patchTemplate: (id: number, patch: Record<string, unknown>) =>
    jsonFetch<{ ok: true; noop?: boolean }>(`/api/admin/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  bumpTemplateVersion: (id: number, changelog: string) =>
    jsonFetch<{ ok: true }>(`/api/admin/templates/${id}/version-bump`, {
      method: 'POST',
      body: JSON.stringify({ changelog }),
    }),

  // LA clients
  listLAClients: () => jsonFetch<{ clients: AdminLAClient[] }>(`/api/admin/la-clients`),
  upsertLAClient: (slug: string, payload: Omit<AdminLAClient, 'slug' | 'created_at' | 'updated_at'>) =>
    jsonFetch<{ ok: true; slug: string }>(`/api/admin/la-clients/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteLAClient: (slug: string) =>
    jsonFetch<{ ok: true }>(`/api/admin/la-clients/${slug}`, { method: 'DELETE' }),
  uploadLAClientsCSV: (csv: string) =>
    jsonFetch<{ imported: number; errors: Array<{ row: number; slug: string; reason: string; details?: unknown }> }>(
      `/api/admin/la-clients/upload-csv`,
      { method: 'POST', body: JSON.stringify({ csv }) }
    ),

  // Trust domains
  listTrustRequests: (status: 'pending' | 'approved' | 'rejected' = 'pending') =>
    jsonFetch<{ requests: TrustDomainRequest[] }>(`/api/admin/trust-domain-requests?status=${status}`),
  approveTrustRequest: (id: number) =>
    jsonFetch<{ ok: true; allowlisted: string }>(`/api/admin/trust-domain-requests/${id}/approve`, {
      method: 'POST',
    }),
  rejectTrustRequest: (id: number) =>
    jsonFetch<{ ok: true }>(`/api/admin/trust-domain-requests/${id}/reject`, { method: 'POST' }),
  listTrustAllowlist: () =>
    jsonFetch<{ entries: TrustDomainEntry[] }>(`/api/admin/trust-domain-allowlist`),
  revokeTrustEntry: (domain: string) =>
    jsonFetch<{ ok: true }>(`/api/admin/trust-domain-allowlist/${encodeURIComponent(domain)}`, {
      method: 'DELETE',
    }),
};
