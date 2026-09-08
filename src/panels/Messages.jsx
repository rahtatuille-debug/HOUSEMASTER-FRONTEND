import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Messages({ me, identityKind }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [thread, setThread] = useState(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  // "new conversation" flow state
  const [composing, setComposing] = useState(false)
  const [contacts, setContacts] = useState([])
  const [students, setStudents] = useState([])
  const [newParticipantId, setNewParticipantId] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [newBody, setNewBody] = useState('')
  const [creating, setCreating] = useState(false)

  async function loadConversations() {
    setLoading(true)
    setError('')
    try {
      const data = await api.conversations.list()
      setConversations(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConversations()
  }, [])

  async function openConversation(conv) {
    setActiveId(conv.id)
    setThread(conv)
    setComposing(false)
    try {
      const data = await api.conversations.messages(conv.id)
      setMessages(data)
      await api.conversations.markRead(conv.id)
      loadConversations()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    try {
      await api.conversations.sendMessage(activeId, { body })
      setBody('')
      const data = await api.conversations.messages(activeId)
      setMessages(data)
      loadConversations()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function startComposing() {
    setComposing(true)
    setThread(null)
    setActiveId(null)
    setError('')
    try {
      const contactList = await api.conversations.contacts()
      setContacts(contactList)
      if (identityKind === 'staff') {
        const studentList = await api.students.list({ is_active: true })
        setStudents(studentList)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newParticipantId || !newBody.trim()) return
    setCreating(true)
    setError('')
    try {
      const conv = await api.conversations.create({
        participant_ids: [Number(newParticipantId)],
        student: newStudentId ? Number(newStudentId) : null,
        body: newBody,
      })
      setNewParticipantId('')
      setNewStudentId('')
      setNewBody('')
      setComposing(false)
      await loadConversations()
      openConversation(conv)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function otherParticipants(conv) {
    return conv.participants.filter((p) => p.id !== me?.id).map((p) => p.name)
  }

  return (
    <div>
      <div className="panel-header">
        <h2>Messages</h2>
        <button onClick={startComposing}>New message</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <p className="text-muted" style={{ padding: 16 }}>Loading…</p>
          ) : conversations.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              <h3>No conversations yet</h3>
              <p>Start one with "New message" above.</p>
            </div>
          ) : (
            <div>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--rule)',
                    cursor: 'pointer',
                    background: activeId === conv.id ? 'var(--paper-2)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <strong style={{ fontSize: 14 }}>{otherParticipants(conv).join(', ') || 'Conversation'}</strong>
                    {conv.unread_count > 0 && (
                      <span className="badge finalized" style={{ fontSize: 11 }}>{conv.unread_count}</span>
                    )}
                  </div>
                  {conv.student_name && (
                    <div className="text-muted" style={{ fontSize: 12 }}>About: {conv.student_name}</div>
                  )}
                  {conv.last_message && (
                    <p style={{
                      margin: '4px 0 0', fontSize: 13, color: 'var(--navy-2)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {conv.last_message.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          {composing && (
            <>
              <h3 style={{ marginBottom: 14, fontSize: 15 }}>New message</h3>
              <form onSubmit={handleCreate}>
                <div className="field">
                  <label htmlFor="new-msg-contact">
                    {identityKind === 'staff' ? 'Send to (parent/guardian)' : 'Send to (staff)'}
                  </label>
                  <select
                    id="new-msg-contact"
                    value={newParticipantId}
                    onChange={(e) => setNewParticipantId(e.target.value)}
                    required
                  >
                    <option value="">Choose someone…</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {identityKind === 'staff' && (
                  <div className="field">
                    <label htmlFor="new-msg-student">About which student? (optional)</label>
                    <select
                      id="new-msg-student"
                      value={newStudentId}
                      onChange={(e) => setNewStudentId(e.target.value)}
                    >
                      <option value="">Not specific to a student</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="new-msg-body">Message</label>
                  <textarea
                    id="new-msg-body"
                    rows={4}
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    required
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" disabled={creating}>
                    {creating ? 'Sending…' : 'Send'}
                  </button>
                  <button type="button" className="secondary" onClick={() => setComposing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </>
          )}

          {!composing && !thread && (
            <div className="empty-state">
              <h3>Select a conversation</h3>
              <p>Or start a new one above.</p>
            </div>
          )}

          {!composing && thread && (
            <>
              <div className="announcement-detail-heading" style={{ marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 17 }}>{otherParticipants(thread).join(', ') || 'Conversation'}</h3>
                  {thread.student_name && (
                    <p className="text-muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
                      About: {thread.student_name}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', marginBottom: 14 }}>
                {messages.map((m) => {
                  const isMine = m.sender === me?.id
                  return (
                    <div key={m.id} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          background: isMine ? 'var(--navy)' : 'var(--paper-2)',
                          color: isMine ? '#fff' : 'var(--ink)',
                        }}
                      >
                        {m.body}
                      </div>
                      <div className="text-muted" style={{ fontSize: 11, marginTop: 2, textAlign: isMine ? 'right' : 'left' }}>
                        {m.sender_name} · {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>

              <form onSubmit={handleSend} className="form-row">
                <input
                  type="text"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a message…"
                  style={{ flex: 1 }}
                  required
                />
                <button type="submit" disabled={sending}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
