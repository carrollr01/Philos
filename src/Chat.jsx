import { useState, useEffect, useRef } from 'react'
import { supabase, getUser } from './supabase'
import { SkeletonMatchItem, SkeletonMessage } from './SkeletonCard'
import GlassCard from './components/GlassCard'
import Button from './components/Button'

function Chat() {
  const [user, setUser] = useState(null)
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (selectedMatch) {
      loadMessages(selectedMatch)
    }
  }, [selectedMatch])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const init = async () => {
    try {
      const { user } = await getUser()
      setUser(user)
      await loadMatches(user)
    } catch (e) {
      console.error('Failed to initialize chat', e)
    } finally {
      setLoading(false)
    }
  }

  const loadMatches = async (user) => {
    try {
      console.log('Loading matches for user:', user.id)
      
      // Simple query - just get matches without joins
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)

      if (error) {
        console.error('Matches query error:', error)
        throw error
      }

      console.log('Raw matches data:', data)

      if (!data || data.length === 0) {
        console.log('No matches found')
        setMatches([])
        return
      }

      // Format matches - show user IDs since we can't get emails from client
      const formattedMatches = data.map(match => {
        const otherUserId = match.user_a_id === user.id ? match.user_b_id : match.user_a_id
        return {
          id: match.id,
          other_user: { 
            id: otherUserId, 
            email: `User ${otherUserId.slice(0, 8)}...` 
          },
          created_at: match.created_at
        }
      })

      console.log('Formatted matches:', formattedMatches)
      setMatches(formattedMatches)
    } catch (e) {
      console.error('Failed to load matches', e)
      setMatches([])
    }
  }

  const loadMessages = async (match) => {
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', match.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (e) {
      console.error('Failed to load messages', e)
    } finally {
      setLoadingMessages(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedMatch || sendingMessage) return

    setSendingMessage(true)
    const messageContent = newMessage.trim()
    const messageData = {
      id: Date.now(), // temporary ID for local state
      match_id: selectedMatch.id,
      sender_id: user.id,
      content: messageContent,
      created_at: new Date().toISOString()
    }

    // Add message to local state immediately for better UX
    setMessages(prev => [...prev, messageData])
    setNewMessage('')

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          match_id: selectedMatch.id,
          sender_id: user.id,
          content: messageContent,
          created_at: new Date().toISOString()
        })

      if (error) throw error
      
      // Reload messages to get the real ID from database
      await loadMessages(selectedMatch)
    } catch (e) {
      console.error('Failed to send message', e)
      alert('Failed to send message. Please try again.')
      // Remove the message from local state if it failed
      setMessages(prev => prev.filter(msg => msg.id !== messageData.id))
      setNewMessage(messageContent) // Restore the message
    } finally {
      setSendingMessage(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="chat-container">
        <div className="chat-layout">
          <div className="matches-sidebar">
            <h3>Your Matches</h3>
            <div className="matches-list">
              {[1, 2, 3].map(i => <SkeletonMatchItem key={i} />)}
            </div>
          </div>
          <div className="chat-main">
            <div className="chat-header">
              <div className="skeleton-line skeleton-match-name"></div>
            </div>
            <div className="messages-container">
              {[1, 2, 3, 4].map(i => <SkeletonMessage key={i} />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="chat-container">
        <div className="no-matches">
          <h2>No matches yet</h2>
          <p>Keep browsing to find your perfect match!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-container">
      <div className="chat-layout">
        <div className="matches-sidebar">
          <h3>Your Matches</h3>
          <div className="matches-list">
            {matches.map((match, index) => (
              <GlassCard
                key={match.id}
                className={`match-card ${selectedMatch?.id === match.id ? 'active' : ''}`}
                onClick={() => setSelectedMatch(match)}
                delay={index * 0.1}
                hover={true}
              >
                <div className="match-avatar">
                  {match.other_user.email.charAt(0).toUpperCase()}
                </div>
                <div className="match-info">
                  <div className="match-name">{match.other_user.email}</div>
                  <div className="match-time">
                    {new Date(match.created_at).toLocaleDateString()}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        <div className="chat-main">
          {selectedMatch ? (
            <>
              <div className="chat-header">
                <h3>Chat with {selectedMatch.other_user.email}</h3>
              </div>
              
              <div className="messages-container">
                {loadingMessages ? (
                  [1, 2, 3].map(i => <SkeletonMessage key={i} />)
                ) : (
                  messages.map((message, index) => (
                    <GlassCard
                      key={message.id}
                      className={`message-card ${message.sender_id === user.id ? 'sent' : 'received'}`}
                      delay={index * 0.05}
                      hover={false}
                    >
                      <div className="message-content">{message.content}</div>
                      <div className="message-time">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </div>
                    </GlassCard>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="message-input">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  maxLength={500}
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={!newMessage.trim() || sendingMessage}
                  loading={sendingMessage}
                  size="sm"
                >
                  Send
                </Button>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <p>Select a match to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Chat