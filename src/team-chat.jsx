import { useEffect, useRef, useState } from 'react'
import {
  MessageSquare,
  Send,
  UsersRound,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Crown,
} from 'lucide-react'
import { Avatar } from './ui.jsx'

export function TeamChatPanel({
  team,
  members = [],
  memberMap = {},
  userId,
  userName,
  repo,
}) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    })
  }

  const loadMessages = async (silent = false) => {
    if (!team) return
    if (!silent) setLoading(true)
    try {
      const data = await repo.listTeamMessages?.(team.id)
      if (Array.isArray(data)) {
        setMessages(data)
      }
    } catch (err) {
      console.warn('Lỗi tải tin nhắn nhóm:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadMessages()
    // Polling every 3.5 seconds for fresh messages
    const timer = setInterval(() => {
      loadMessages(true)
    }, 3500)
    return () => clearInterval(timer)
  }, [team?.id])

  useEffect(() => {
    scrollToBottom(false)
  }, [messages.length])

  const handleSend = async (e) => {
    e?.preventDefault()
    const content = text.trim()
    if (!content || sending || !team) return

    setSending(true)
    setText('')
    try {
      const sent = await repo.sendTeamMessage?.(team.id, content)
      if (sent) {
        setMessages((prev) => [...prev, sent])
      } else {
        await loadMessages(true)
      }
      setTimeout(() => {
        scrollToBottom(true)
        inputRef.current?.focus()
      }, 50)
    } catch (err) {
      console.error('Không gửi được tin nhắn:', err)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatMsgTime = (isoString) => {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      const hours = String(d.getHours()).padStart(2, '0')
      const mins = String(d.getMinutes()).padStart(2, '0')
      return `${hours}:${mins}`
    } catch {
      return ''
    }
  }

  const formatMsgDate = (isoString) => {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      return `${day}/${month}`
    } catch {
      return ''
    }
  }

  if (!team) {
    return (
      <section className="panel empty-state">
        <div className="empty">
          <span className="empty-icon">
            <MessageSquare size={24} />
          </span>
          <strong>Bạn chưa chọn nhóm</strong>
          <p>Hãy chọn một nhóm từ danh sách bên trái để tham gia trò chuyện cùng đồng đội.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="panel team-chat-panel">
      {/* Chat Header */}
      <div className="team-chat-header">
        <div className="team-chat-header-info">
          <div className="team-chat-header-icon">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3>{team.name}</h3>
            <p className="team-chat-subtitle">
              <span className="team-chat-online-dot" />
              {members.length} thành viên đang tham gia
            </p>
          </div>
        </div>
        <button
          className="button secondary team-chat-refresh-btn"
          type="button"
          title="Tải lại tin nhắn"
          onClick={() => loadMessages(false)}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="btn-label-desktop">Làm mới</span>
        </button>
      </div>

      {/* Messages Stream */}
      <div className="team-chat-body">
        {loading && messages.length === 0 ? (
          <div className="team-chat-loading">
            <RefreshCw size={20} className="animate-spin" />
            <span>Đang tải tin nhắn...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="team-chat-empty">
            <div className="team-chat-empty-icon">
              <Sparkles size={28} />
            </div>
            <h4>Chưa có tin nhắn nào trong nhóm</h4>
            <p>
              Hãy là người đầu tiên gửi tin nhắn chào mừng các thành viên trong nhóm{' '}
              <strong>{team.name}</strong>!
            </p>
          </div>
        ) : (
          <div className="team-chat-messages">
            {messages.map((msg, index) => {
              const isMe = msg.sender_id === userId
              const senderMember = memberMap[msg.sender_id] || members.find((m) => m.user_id === msg.sender_id)
              const senderRole = senderMember?.role
              const prevMsg = messages[index - 1]
              const showDateDivider =
                !prevMsg ||
                formatMsgDate(prevMsg.created_at) !== formatMsgDate(msg.created_at)

              return (
                <div key={msg.id || index} className="team-msg-wrapper">
                  {showDateDivider && (
                    <div className="team-msg-date-divider">
                      <span>{formatMsgDate(msg.created_at)}</span>
                    </div>
                  )}

                  <div className={'team-msg-row' + (isMe ? ' is-me' : ' is-other')}>
                    {!isMe && (
                      <div className="team-msg-avatar">
                        <Avatar
                          name={msg.sender_name || senderMember?.display_name || 'TV'}
                          id={msg.sender_id}
                        />
                      </div>
                    )}
                    <div className="team-msg-content">
                      {!isMe && (
                        <div className="team-msg-meta">
                          <strong className="team-msg-sender">{msg.sender_name}</strong>
                          {senderRole === 'owner' && (
                            <span className="badge purple team-chat-role-badge">
                              <Crown size={10} /> Trưởng nhóm
                            </span>
                          )}
                          {senderRole === 'deputy' && (
                            <span className="badge blue team-chat-role-badge">
                              <ShieldCheck size={10} /> Phó nhóm
                            </span>
                          )}
                        </div>
                      )}
                      <div className="team-msg-bubble">
                        <p className="team-msg-text">{msg.body}</p>
                        <span className="team-msg-time">{formatMsgTime(msg.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat Input Bar */}
      <form className="team-chat-input-bar" onSubmit={handleSend}>
        <input
          ref={inputRef}
          type="text"
          className="team-chat-input"
          placeholder={`Nhập tin nhắn gửi đến ${team.name}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          type="submit"
          className="button primary team-chat-send-btn"
          disabled={!text.trim() || sending}
        >
          <Send size={15} />
          <span className="btn-label-desktop">Gửi</span>
        </button>
      </form>
    </section>
  )
}
