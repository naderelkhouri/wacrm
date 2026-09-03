import { describe, expect, it, vi, beforeEach } from 'vitest'
import { POST, DELETE } from './route'

const mockGetUser = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    }),
}))

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()

vi.mock('@/lib/flows/admin-client', () => ({
  supabaseAdmin: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
    from: mockFrom,
  }),
}))

describe('/api/account/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      update: mockUpdate,
    })
    mockUpdate.mockReturnValue({
      eq: mockEq,
    })
    mockEq.mockResolvedValue({ error: null })
  })

  it('POST returns 401 when unauthorized', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('unauth') })
    const formData = new FormData()
    const req = new Request('http://localhost:3000/api/account/avatar', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('POST uploads avatar successfully and returns publicUrl', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user123' } },
      error: null,
    })
    mockUpload.mockResolvedValueOnce({ data: { path: 'user123/avatar.png' }, error: null })
    mockGetPublicUrl.mockReturnValueOnce({
      data: { publicUrl: 'https://api-db.admx.tech/storage/v1/object/public/avatars/user123/avatar.png' },
    })

    const formData = new FormData()
    const file = new File(['fake image content'], 'avatar.png', { type: 'image/png' })
    formData.append('file', file)

    const req = new Request('http://localhost:3000/api/account/avatar', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.avatarUrl).toContain('avatars/user123/avatar.png')
  })

  it('DELETE resets avatar_url on profile', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user123' } },
      error: null,
    })

    const res = await DELETE()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
