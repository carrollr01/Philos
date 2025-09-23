import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, getUser } from './supabase'
import { calculateMatchScore, getMatchDesignation, sortUsersByMatch, formatMatchDetails } from './matchingAlgorithm'
import { SkeletonProfileCard } from './SkeletonCard'
import GlassCard from './components/GlassCard'
import Button from './components/Button'

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959 // miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return Math.round(R * c * 10) / 10
}

// Simple chime using Web Audio API
const playChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(880, ctx.currentTime)
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.45)
  } catch {}
}

// Minimal confetti without deps
const launchConfetti = () => {
  const canvas = document.createElement('canvas')
  canvas.className = 'confetti-canvas'
  canvas.style.position = 'fixed'
  canvas.style.left = '0'
  canvas.style.top = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.pointerEvents = 'none'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  const pieces = Array.from({ length: 120 }).map(() => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height,
    r: 2 + Math.random() * 4,
    c: ['#065f46','#0a0a0a','#ffffff'][Math.floor(Math.random()*3)],
    s: 1 + Math.random() * 3
  }))
  let anim
  const draw = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height)
    pieces.forEach(p => {
      ctx.fillStyle = p.c
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
      ctx.fill()
      p.y += p.s
      p.x += Math.sin(p.y / 20) * 0.8
      if (p.y - p.r > canvas.height) {
        p.y = -10
        p.x = Math.random() * canvas.width
      }
    })
    anim = requestAnimationFrame(draw)
  }
  draw()
  setTimeout(() => {
    cancelAnimationFrame(anim)
    canvas.remove()
  }, 1500)
}

// Track matching pattern for learning algorithm
const trackMatchingPattern = async (userAId, userBId, userAFavorites, userBFavorites) => {
  try {
    const matchData = calculateMatchScore(userAFavorites, userBFavorites)
    const exactMatches = matchData.exactMatches.map(match => match.item)
    const relatedMatches = matchData.relatedMatches.map(match => ({
      item1: match.item1,
      item2: match.item2,
      score: match.score
    }))
    
    await supabase
      .from('matching_patterns')
      .insert({
        user_a_id: userAId,
        user_b_id: userBId,
        user_a_favorites: userAFavorites,
        user_b_favorites: userBFavorites,
        match_score: matchData.totalScore,
        exact_matches: exactMatches,
        related_matches: relatedMatches,
        vibe_match: matchData.vibeMatch,
        user_a_vibe: matchData.user1Vibe,
        user_b_vibe: matchData.user2Vibe
      })
  } catch (error) {
    console.error('Failed to track matching pattern:', error)
  }
}

function Browse() {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentPrefs, setCurrentPrefs] = useState({ gender: '', lookingFor: [], latitude: null, longitude: null })
  const [currentFavorites, setCurrentFavorites] = useState([])
  const [profiles, setProfiles] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [fetchingNext, setFetchingNext] = useState(false)
  const [error, setError] = useState('')
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [exitDirection, setExitDirection] = useState(null) // 'like' or 'pass'

  const cardRef = useRef(null)
  const startX = useRef(0)
  const currentX = useRef(0)
  const dragging = useRef(false)

  const threshold = 120 // px to trigger action

  useEffect(() => {
    const init = async () => {
      try {
        const { user } = await getUser()
        setCurrentUser(user)
        
        const { data: me } = await supabase
          .from('user_favorites')
          .select('gender, looking_for, latitude, longitude, favorites')
          .eq('user_id', user.id)
          .maybeSingle()
        if (me) {
          setCurrentPrefs({
            gender: me.gender || '',
            lookingFor: Array.isArray(me.looking_for) ? me.looking_for : [],
            latitude: me.latitude,
            longitude: me.longitude,
          })
          setCurrentFavorites(Array.isArray(me.favorites) ? me.favorites : [])
        }

        await fetchNextProfile(user)
      } catch (e) {
        setError('Failed to initialize browse')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const fetchNextProfile = useCallback(async (user) => {
    if (!user || currentFavorites.length === 0) return
    setError('')
    setFetchingNext(true)

    try {
      const { data: swipes, error: swipesError } = await supabase
        .from('likes')
        .select('target_user_id')
        .eq('user_id', user.id)
      if (swipesError) throw swipesError
      const excludedIds = new Set([user.id, ...(swipes?.map(s => s.target_user_id) || [])])

      const { data: candidates, error: candidatesError } = await supabase
        .from('user_favorites')
        .select('user_id, favorites, age, gender, location, profile_picture, latitude, longitude, looking_for')
        .limit(100)
      if (candidatesError) throw candidatesError

      // Filter compatible candidates
      const compatibleCandidates = (candidates || []).filter(c => {
        if (!Array.isArray(c.favorites) || c.favorites.length === 0) return false
        if (excludedIds.has(c.user_id)) return false

        const theirLooking = Array.isArray(c.looking_for) ? c.looking_for : []
        const myLooking = currentPrefs.lookingFor || []
        const theyAcceptMe = theirLooking.includes('No preference') || theirLooking.includes(currentPrefs.gender)
        const iAcceptThem = myLooking.includes('No preference') || myLooking.includes(c.gender)
        return theyAcceptMe && iAcceptThem
      })

      // Sort by match quality using the sophisticated algorithm
      const sortedCandidates = sortUsersByMatch(compatibleCandidates, currentFavorites)
      
      // Load up to 3 profiles for the stack effect
      const stackProfiles = sortedCandidates.slice(0, 3)
      setProfiles(stackProfiles)
      setCurrentIndex(0)
      if (stackProfiles.length === 0) setError('No more compatible profiles right now')
    } catch (e) {
      console.error('Error fetching next profile', e)
      setError('Could not fetch next profile')
    } finally {
      setFetchingNext(false)
    }
  }, [currentPrefs, currentFavorites])

  const handleSwipe = async (liked) => {
    if (!currentUser || !profiles[currentIndex] || actionLoading) return
    setActionLoading(true)
    setError('')
    setExitDirection(liked ? 'like' : 'pass')

    const currentProfile = profiles[currentIndex]

    try {
      const { error: likeError } = await supabase
        .from('likes')
        .upsert({
          user_id: currentUser.id,
          target_user_id: currentProfile.user_id,
          liked,
          created_at: new Date().toISOString(),
        })
      if (likeError) throw likeError

      if (liked) {
        const { data: reciprocal, error: recErr } = await supabase
          .from('likes')
          .select('id')
          .eq('user_id', currentProfile.user_id)
          .eq('target_user_id', currentUser.id)
          .eq('liked', true)
          .maybeSingle()
        if (recErr) throw recErr
        if (reciprocal) {
          const [a, b] = [currentUser.id, currentProfile.user_id].sort()
          const { error: matchErr } = await supabase
            .from('matches')
            .upsert({ user_a_id: a, user_b_id: b, created_at: new Date().toISOString() })
          if (matchErr) throw matchErr
          
          // Track matching pattern for learning
          await trackMatchingPattern(currentUser.id, currentProfile.user_id, currentFavorites, currentProfile.favorites)
          
          // Celebration
          playChime()
          launchConfetti()
          alert('It\'s a match!')
        }
      }

      // Move to next card in stack
      if (currentIndex + 1 < profiles.length) {
        setCurrentIndex(currentIndex + 1)
      } else {
        // Need to fetch more profiles
        await fetchNextProfile(currentUser)
      }
    } catch (e) {
      console.error('Error processing swipe', e)
      setError('Could not process your action')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const mouseX = e.clientX - centerX
    const mouseY = e.clientY - centerY
    
    setMousePosition({ x: mouseX, y: mouseY })
  }

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 })
  }

  const onPointerDown = (e) => {
    if (!cardRef.current) return
    dragging.current = true
    startX.current = e.touches ? e.touches[0].clientX : e.clientX
    currentX.current = startX.current
    cardRef.current.style.transition = 'none'
  }

  const onPointerMove = (e) => {
    if (!dragging.current || !cardRef.current) return
    currentX.current = e.touches ? e.touches[0].clientX : e.clientX
    const dx = currentX.current - startX.current
    const rotate = Math.max(-15, Math.min(15, dx / 10))
    cardRef.current.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`
    // Indicators
    cardRef.current.dataset.like = dx > 40 ? 'true' : 'false'
    cardRef.current.dataset.pass = dx < -40 ? 'true' : 'false'
  }

  const onPointerUp = async () => {
    if (!cardRef.current) return
    const dx = currentX.current - startX.current
    cardRef.current.style.transition = 'transform .25s ease'
    dragging.current = false

    if (dx > threshold) {
      // Like
      cardRef.current.style.transform = 'translateX(400px) rotate(20deg)'
      await handleSwipe(true)
      resetCardStyle()
    } else if (dx < -threshold) {
      // Pass
      cardRef.current.style.transform = 'translateX(-400px) rotate(-20deg)'
      await handleSwipe(false)
      resetCardStyle()
    } else {
      // Spring back
      cardRef.current.style.transform = 'translateX(0) rotate(0)'
      cardRef.current.dataset.like = 'false'
      cardRef.current.dataset.pass = 'false'
    }
  }

  const resetCardStyle = () => {
    if (!cardRef.current) return
    setTimeout(() => {
      if (cardRef.current) {
        cardRef.current.style.transition = 'none'
        cardRef.current.style.transform = 'translateX(0) rotate(0)'
        cardRef.current.dataset.like = 'false'
        cardRef.current.dataset.pass = 'false'
      }
    }, 250)
  }

  if (loading) {
    return <SkeletonProfileCard />
  }

  if (error) {
    return (
      <div className="browse-card">
        <div className="error-message">{error}</div>
        <Button variant="primary" onClick={() => fetchNextProfile(currentUser)}>Try Again</Button>
      </div>
    )
  }

  if (fetchingNext) {
    return <SkeletonProfileCard />
  }

  if (profiles.length === 0) {
    return (
      <div className="browse-card">
        <h2>No profiles</h2>
        <p className="subtitle">We couldn't find more compatible profiles right now. Try again soon or adjust your preferences.</p>
      </div>
    )
  }

  const currentProfile = profiles[currentIndex]
  const distance = currentPrefs.latitude && currentPrefs.longitude && currentProfile.latitude && currentProfile.longitude
    ? calculateDistance(currentPrefs.latitude, currentPrefs.longitude, currentProfile.latitude, currentProfile.longitude)
    : null

  // Calculate match data for this profile
  const matchData = currentProfile.matchData || calculateMatchScore(currentFavorites, currentProfile.favorites || [])
  const designation = currentProfile.designation || getMatchDesignation(matchData.totalScore, matchData.exactMatches)
  const matchDetails = formatMatchDetails(matchData)

  // Calculate tilt based on mouse position
  const tiltX = (mousePosition.y / 10) * -1
  const tiltY = (mousePosition.x / 10)

  return (
    <div className="browse-wrapper">
      <div className="card-stack">
        <AnimatePresence mode="wait">
          {profiles.slice(currentIndex, currentIndex + 3).map((profile, stackIndex) => {
            const isCurrent = stackIndex === 0
            const profileDistance = currentPrefs.latitude && currentPrefs.longitude && profile.latitude && profile.longitude
              ? calculateDistance(currentPrefs.latitude, currentPrefs.longitude, profile.latitude, profile.longitude)
              : null
            const profileMatchData = profile.matchData || calculateMatchScore(currentFavorites, profile.favorites || [])
            const profileDesignation = profile.designation || getMatchDesignation(profileMatchData.totalScore, profileMatchData.exactMatches)
            const profileMatchDetails = formatMatchDetails(profileMatchData)

            return (
              <motion.div
                key={profile.user_id}
                className={`card-container ${isCurrent ? 'current' : 'stacked'}`}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ 
                  opacity: isCurrent ? 1 : 0.5,
                  scale: isCurrent ? 1 : 0.95,
                  y: isCurrent ? 0 : stackIndex * 4,
                  rotateX: isCurrent ? tiltX : 0,
                  rotateY: isCurrent ? tiltY : 0,
                  zIndex: isCurrent ? 10 : 10 - stackIndex
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.9, 
                  x: exitDirection === 'like' ? 300 : exitDirection === 'pass' ? -300 : 0,
                  rotate: exitDirection === 'like' ? 20 : exitDirection === 'pass' ? -20 : 0,
                  transition: { duration: 0.3 }
                }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 30,
                  opacity: { duration: 0.2 },
                  scale: { duration: 0.2 }
                }}
                onAnimationComplete={() => {
                  if (exitDirection) {
                    setExitDirection(null)
                  }
                }}
                style={{
                  position: isCurrent ? 'relative' : 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0
                }}
              >
                <GlassCard
                  className="browse-card swipeable"
                  ref={isCurrent ? cardRef : null}
                  onMouseDown={isCurrent ? onPointerDown : undefined}
                  onMouseMove={isCurrent ? onPointerMove : undefined}
                  onMouseUp={isCurrent ? onPointerUp : undefined}
                  onTouchStart={isCurrent ? onPointerDown : undefined}
                  onTouchMove={isCurrent ? onPointerMove : undefined}
                  onTouchEnd={isCurrent ? onPointerUp : undefined}
                  onMouseEnter={isCurrent ? handleMouseMove : undefined}
                  onMouseLeave={isCurrent ? handleMouseLeave : undefined}
                  hover={false}
                >
                  <div className="swipe-indicator like" style={{opacity: 0}}>LIKE</div>
                  <div className="swipe-indicator pass" style={{opacity: 0}}>PASS</div>
                  
                  {/* Match Designation Badge */}
                  {profileDesignation && (
                    <div className="match-designation" style={{ backgroundColor: profileDesignation.color }}>
                      <span className="match-emoji">{profileDesignation.emoji}</span>
                      <span className="match-label">{profileDesignation.label}</span>
                    </div>
                  )}
                  
                  <div className="profile-header">
                    {profile.profile_picture ? (
                      <img src={profile.profile_picture} alt="Profile" className="profile-image" />
                    ) : (
                      <div className="profile-placeholder">
                        {profile.user_id.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="profile-info">
                      <h2>{(profile.name || 'Friend') + "'s Top 5"}</h2>
                      <p className="location">{(profile.age ? profile.age + ' · ' : '') + (profile.location || '')}</p>
                      {profileDistance !== null && (
                        <p className="distance">📍 {profileDistance} miles away</p>
                      )}
                    </div>
                  </div>

                  {/* Match Details */}
                  {profileMatchDetails.length > 0 && (
                    <div className="match-details">
                      {profileMatchDetails.map((detail, idx) => (
                        <div key={idx} className={`match-detail ${detail.type}`}>
                          {detail.text}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="favorites-section">
                    {profile.favorites.map((fav, idx) => {
                      const isExactMatch = profileMatchData.exactMatches.some(match => match.index2 === idx)
                      return (
                        <div key={idx} className={`favorite-item ${isExactMatch ? 'exact-match' : ''}`}>
                          <span className="favorite-number">#{idx + 1}</span>
                          <span className="favorite-text">{fav}</span>
                          {isExactMatch && <span className="sparkle">✨</span>}
                        </div>
                      )
                    })}
                  </div>

                  {isCurrent && (
                    <div className="swipe-actions">
                      <Button 
                        variant="secondary" 
                        size="md"
                        onClick={() => handleSwipe(false)} 
                        disabled={actionLoading}
                        className="pass-button"
                      >
                        ✕ Pass
                      </Button>
                      <Button 
                        variant="primary" 
                        size="md"
                        onClick={() => handleSwipe(true)} 
                        disabled={actionLoading}
                        className="like-button"
                      >
                        ♥ Like
                      </Button>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default Browse