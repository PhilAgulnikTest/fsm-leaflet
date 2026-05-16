/* Thin fetch wrappers around the server API. Errors surface as thrown Error
 * objects with a server-provided code where available. */

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) code = body.error;
    } catch {
      // fall through
    }
    throw new Error(code);
  }
  return res.json() as Promise<T>;
}

export type School = {
  urn: string;
  name: string;
  postcode: string | null;
  town: string | null;
  la: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
};

export type LAClient = {
  slug: string;
  name: string;
  calculator_subdomain: string;
  default_brand_colour: string;
  default_accent_colour: string;
  logo_url: string | null;
  default_source_url: string | null;
  enabled_languages: string[];
  notes: string;
};

export type Template = {
  id: number;
  slug: string;
  name: string;
  description: string;
  audience: 'school' | 'la' | 'housing-association';
  version: number;
  status: 'draft' | 'published';
};

export const api = {
  searchSchools: (q: string) =>
    jsonFetch<{ results: School[] }>(`/api/schools/search?q=${encodeURIComponent(q)}`),
  getSchool: (urn: string) => jsonFetch<{ school: School }>(`/api/schools/${urn}`),
  listLAs: () => jsonFetch<{ clients: LAClient[] }>(`/api/la-clients`),
  listTemplates: (audience?: string) =>
    jsonFetch<{ templates: Template[] }>(
      `/api/templates${audience ? `?audience=${audience}` : ''}`
    ),
  createCustomization: (payload: {
    template_slug: string;
    school_urn?: string;
    la_slug?: string;
    overrides?: Record<string, string>;
    owner_email?: string;
  }) =>
    jsonFetch<{ id: number; public_slug: string; public_url: string; edit_url: string }>(
      `/api/customizations`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  updateCustomization: (slug: string, overrides: Record<string, string>) =>
    jsonFetch<{ ok: true; public_slug: string; public_url: string }>(
      `/api/customizations/${slug}`,
      { method: 'PATCH', body: JSON.stringify({ overrides }) }
    ),

  // Auth
  requestMagicLink: (payload: {
    scope: 'school' | 'la';
    email: string;
    customization_id?: number;
    school_urn?: string;
    la_slug?: string;
  }) =>
    jsonFetch<{ ok: true; sent_to: string; ttl_minutes: number; warning?: string; dev_link?: string }>(
      `/api/auth/request`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  requestTrustAllowlist: (payload: { domain: string; email: string; school_urn?: string; notes?: string }) =>
    jsonFetch<{ ok: true }>(`/api/auth/request-trust-allowlist`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () =>
    jsonFetch<{
      session: null | {
        email: string;
        scope: 'school' | 'la' | 'platform-admin';
        customization_id: number | null;
        school_urn: string | null;
        la_slug: string | null;
        expires_at: string;
      };
    }>(`/api/auth/me`),
  logout: () => jsonFetch<{ ok: true }>(`/api/auth/logout`, { method: 'POST' }),

  // AI re-write
  aiRewrite: (payload: {
    template_slug: string;
    section_key: string;
    current_text: string;
    mode: 'rewrite' | 'translate';
    target_language?: string;
    source_url?: string;
    source_text?: string;
    customization_id?: number;
    la_slug?: string;
  }) =>
    jsonFetch<{
      rewrite_id: number;
      output: string;
      warnings: Array<{ contradicted_phrase: string; fact_key: string; rationale: string }>;
      source_url_used: string | null;
      source_byte_count: number;
    }>(`/api/ai/rewrite`, { method: 'POST', body: JSON.stringify(payload) }),

  acceptRewrite: (id: number) =>
    jsonFetch<{ ok: true }>(`/api/ai/rewrite/${id}/accept`, { method: 'POST' }),
};
