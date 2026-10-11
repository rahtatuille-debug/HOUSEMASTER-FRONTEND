import { useEffect, useRef, useState } from 'react'
import { useRemembered } from '../remember.js'
import { classesFor, perms } from '../permissions.js'
import { useVocab } from '../levels.js'
import { formatDateTime } from '../format.js'
import { api } from '../api.js'

const CLASS_KINDS = {
  class_notice: 'Notice',
  class_group: 'Discussion',
}

export default function Messages({ me, identityKind }) {
  const words = useVocab()
  const isStaff = identityKind === 'staff'
  // 'direct' | 'class'
  const [composeMode, setComposeMode] = useState('direct')
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [classKind, setClassKind] = useState('class_notice')
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // The open conversation survives a refresh: it's reopened once the list has loaded.
  const [activeId, setActiveId] = useRemembered('panel.messages.open', null)
  const reopen = useRef(activeId)
  const [messages, setMessages] = useState([])
  // The newest message stays in view, just above the box for writing one.
  const threadEnd = useRef(null)
  useEffect(() => { threadEnd.current?.scrollIntoView?.({ block: 'end' }) }, [messages])
  const [thread, setThread] = useState(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  // "new conversation" flow state
  const [composing, setComposing] = useState(false)
  const [contacts, setContacts] = useState([])
  const [newParticipantId, setNewParticipantId] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [newBody, setNewBody] = useState('')
  const [creating, setCreating] = useState(false)

  // Phones: an open chat fills the screen (styles.css), so the page behind it stays still.
  const chatOpen = Boolean(thread) && !composing
  useEffect(() => {
    document.body.classList.toggle('chat-open', chatOpen)
    return () => document.body.classList.remove('chat-open')
  }, [chatOpen])

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

  useEffect(() => {
    if (loading || !reopen.current) return
    const conv = conversations.find((c) => c.id === reopen.current)
    reopen.current = null
    if (conv) openConversation(conv)
    else setActiveId(null)
  }, [loading])  // eslint-disable-line react-hooks/exhaustive-deps

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

  async function startClassMessage() {
    setComposeMode('class')
    setComposing(true)
    setThread(null)
    setActiveId(null)
    setError('')
    try {
      const all = await api.schoolClasses.list()
      // Teachers can only message classes they teach.
      const mine = classesFor(me, all, 'pastoral')
      setClasses(mine)
      if (mine.length === 1) setClassId(String(mine[0].id))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleClassSend(e) {
    e.preventDefault()
    if (!classId || !newBody.trim()) return
    setCreating(true)
    setError('')
    try {
      const conv = await api.conversations.messageClass({
        school_class: Number(classId),
        kind: classKind,
        body: newBody,
      })
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

  async function startComposing() {
    setComposeMode('direct')
    setComposing(true)
    setThread(null)
    setActiveId(null)
    setError('')
    try {
      const contactList = await api.conversations.contacts()
      setContacts(contactList)
    } catch (err) {
      setError(err.message)
    }
  }

  // Staff can only write to a parent about that parent's own children.
  const children = contacts.find((c) => String(c.id) === String(newParticipantId))?.children || []
  function chooseContact(id) {
    setNewParticipantId(id)
    const kids = contacts.find((c) => String(c.id) === String(id))?.children || []
    setNewStudentId(kids.length === 1 ? String(kids[0].id) : '')
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

  function goBackToList() {
    setActiveId(null)
    setThread(null)
    setComposing(false)
  }

  function otherParticipants(conv) {
    return conv.participants.filter((p) => p.id !== me?.id).map((p) => p.name)
  }

  function title(conv) {
    if (CLASS_KINDS[conv.kind]) {
      return `${conv.class_name || 'Class'} parents · ${CLASS_KINDS[conv.kind]}`
    }
    return otherParticipants(conv).join(', ') || 'Conversation'
  }

  return (
    <div>
      <div className="panel-header">
        <h2>Messages</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {isStaff && (
            <button className="secondary" onClick={startClassMessage}>
              Message a class
            </button>
          )}
          <button onClick={startComposing}>New message</button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className={`messages-layout${composing || thread ? ' showing-detail' : ''}`}>
        <div className="card messages-list-pane" style={{ padding: 0, overflow: 'hidden' }}>
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
                    <strong style={{ fontSize: 14 }}>{title(conv)}</strong>
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

        <div className={`card messages-detail-pane${!composing && thread ? ' has-thread' : ''}`} data-no-pull={!composing && thread ? '' : undefined}>
          {composing && (
            <button type="button" className="secondary back-to-list" onClick={goBackToList}>
              ← Back to conversations
            </button>
          )}
          {composing && composeMode === 'class' && (
            <>
              <h3 style={{ marginBottom: 6, fontSize: 15 }}>Message a class</h3>
              <p className="hint" style={{ marginTop: 0 }}>
                Goes to every parent with a child in the class who has a HouseMaster account.
              </p>
              <form onSubmit={handleClassSend}>
                <div className="field">
                  <label htmlFor="class-msg-class">{words.class}</label>
                  <select id="class-msg-class" value={classId} onChange={(e) => setClassId(e.target.value)} required>
                    <option value="">Choose a class…</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {me?.role !== 'admin' && classes.length === 0 && (
                    <p className="hint">You aren't assigned to any classes yet.</p>
                  )}
                </div>
                <div className="field">
                  <label>Type</label>
                  <div className="checkbox-list" style={{ maxHeight: 'none' }}>
                    <label>
                      <input type="radio" name="class-kind" checked={classKind === 'class_notice'} onChange={() => setClassKind('class_notice')} />
                      Notice — parents can read it but not reply
                    </label>
                    <label>
                      <input type="radio" name="class-kind" checked={classKind === 'class_group'} onChange={() => setClassKind('class_group')} />
                      Discussion — everyone can reply and see each other
                    </label>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="class-msg-body">Message</label>
                  <textarea id="class-msg-body" rows={4} value={newBody} onChange={(e) => setNewBody(e.target.value)} required />
                </div>
                <div className="form-actions">
                  <button type="submit" disabled={creating}>
                    {creating ? 'Sending…' : 'Send to class'}
                  </button>
                  <button type="button" className="secondary" onClick={() => setComposing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </>
          )}

          {composing && composeMode === 'direct' && (
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
                    onChange={(e) => chooseContact(e.target.value)}
                    required
                  >
                    <option value="">Choose someone…</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {identityKind === 'staff' && children.length > 0 && (
                  <div className="field">
                    <label htmlFor="new-msg-student">About which child? (optional)</label>
                    <select id="new-msg-student" value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)}>
                      <option value="">Not about one child</option>
                      {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <div className="messages-chat-head">
                <button type="button" className="chat-back" aria-label="Back to conversations" onClick={goBackToList}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                    strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <span className="chat-avatar" aria-hidden="true">{initials(title(thread))}</span>
                <div className="chat-title">
                  <h3>{title(thread)}</h3>
                  {CLASS_KINDS[thread.kind] && isStaff && (
                    <p className="text-muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
                      {thread.member_count - 1} parent{thread.member_count - 1 === 1 ? '' : 's'}
                      {thread.kind === 'class_notice' ? ' · parents can’t reply' : ''}
                    </p>
                  )}
                  {thread.student_name && (
                    <p className="text-muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
                      About: {thread.student_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="messages-thread">
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
                        {m.sender_name} · {formatDateTime(m.created_at)}
                      </div>
                    </div>
                  )
                })}
                <div ref={threadEnd} />
              </div>

              {thread.can_reply === false ? (
                <p className="hint messages-composer" style={{ margin: 0 }}>
                  This is a one-way class notice, so replies are turned off. To ask the teacher something, start a
                  new message to them.
                </p>
              ) : (
              <form onSubmit={handleSend} className="messages-composer">
                <input
                  type="text"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a message…"
                  aria-label="Write a message"
                  required
                />
                <button type="submit" disabled={sending}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// "7 East parents · Notice" → "7E"; "Grace Otieno" → "GO".
function initials(name) {
  return (name || '').split(/[\s·]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}
