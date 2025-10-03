import { useEffect, useState, useCallback } from 'react'
import { supabase, getUser } from './supabase'
import { calculateMatchScore, getMatchDesignation, sortUsersByMatch } from './matchingAlgorithm'
import { SkeletonProfileCard } from './SkeletonCard'
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
        
        let userFavorites = []
        if (me) {
          setCurrentPrefs({
            gender: me.gender || '',
            lookingFor: Array.isArray(me.looking_for) ? me.looking_for : [],
            latitude: me.latitude,
            longitude: me.longitude,
          })
          userFavorites = Array.isArray(me.favorites) ? me.favorites : []
          setCurrentFavorites(userFavorites)
        }

        // Pass favorites directly to avoid race condition
        await fetchNextProfile(user, userFavorites)
      } catch (e) {
        setError('Failed to initialize browse')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const fetchNextProfile = useCallback(async (user, favorites = null) => {
    // Use passed favorites or current state
    const favoritesToUse = favorites || currentFavorites
    
    if (!user || favoritesToUse.length === 0) {
      console.log('🔍 DEBUG: Early return - no user or favorites:', { user: !!user, favoritesLength: favoritesToUse.length })
      return
    }
    
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

      // DEBUG: Log what we got from database
      console.log('🔍 DEBUG: Raw candidates from DB:', candidates?.length || 0, candidates)
      console.log('🔍 DEBUG: Excluded IDs:', Array.from(excludedIds))
      console.log('🔍 DEBUG: Current user ID:', user.id)
      console.log('🔍 DEBUG: Current favorites:', favoritesToUse)

      // Filter compatible candidates - relaxed filtering for better discovery
      const compatibleCandidates = (candidates || []).filter(c => {
        if (!Array.isArray(c.favorites) || c.favorites.length === 0) {
          console.log('❌ Filtered out (no favorites):', c.user_id)
          return false
        }
        if (excludedIds.has(c.user_id)) {
          console.log('❌ Filtered out (excluded):', c.user_id)
          return false
        }
        
        console.log('✅ Keeping candidate:', c.user_id, c.favorites)
        // Show everyone regardless of gender preferences - let users decide
        return true
      })

      console.log('🔍 DEBUG: Compatible candidates after filtering:', compatibleCandidates?.length || 0)

      // Sort by match quality using the sophisticated algorithm
      const sortedCandidates = sortUsersByMatch(compatibleCandidates, favoritesToUse)
      
      // Load up to 3 profiles for the stack effect
      const stackProfiles = sortedCandidates.slice(0, 3)
      console.log('🔍 DEBUG: Final stack profiles:', stackProfiles?.length || 0, stackProfiles)
      
      setProfiles(stackProfiles)
      setCurrentIndex(0)
      if (stackProfiles.length === 0) setError('No more compatible profiles right now')
    } catch (e) {
      console.error('Error fetching next profile', e)
      setError('Could not fetch next profile')
    } finally {
      setFetchingNext(false)
    }
  }, [currentFavorites])

  const handleSwipe = async (liked) => {
    if (!currentUser || !profiles[currentIndex] || actionLoading) return
    setActionLoading(true)
    setError('')

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
        await fetchNextProfile(currentUser, currentFavorites)
      }
    } catch (e) {
      console.error('Error processing swipe', e)
      setError('Could not process your action')
    } finally {
      setActionLoading(false)
    }
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

  return (
    <div className="browse-wrapper">
      {profiles.length > 0 && (
        <div className="browse-card">
          <div className="profile-header">
            {currentProfile.profile_picture ? (
              <img src={currentProfile.profile_picture} alt="Profile" className="profile-image" />
            ) : (
              <div className="profile-placeholder">
                {currentProfile.user_id.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="profile-info">
              <h2>{(currentProfile.name || 'Friend') + "'s Top 5"}</h2>
              <p className="location">{(currentProfile.age ? currentProfile.age + ' · ' : '') + (currentProfile.location || '')}</p>
              {distance !== null && (
                <p className="distance">📍 {distance} miles away</p>
              )}
            </div>
          </div>

          <div className="favorites-section">
            {currentProfile.favorites.map((fav, idx) => {
              const isExactMatch = matchData.exactMatches.some(match => match.index2 === idx)
              return (
                <div key={idx} className={`browse-favorite-item ${isExactMatch ? 'exact-match' : ''}`}>
                  <div className="browse-favorite-content">
                    <span className="browse-favorite-number">#{idx + 1}</span>
                    <span className="browse-favorite-text">{fav}</span>
                    {isExactMatch && <span className="sparkle">✨</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="browse-actions">
            <Button 
              variant="secondary" 
              size="md"
              onClick={() => handleSwipe(false)} 
              disabled={actionLoading}
            >
              ✕ Pass
            </Button>
            <Button 
              variant="primary" 
              size="md"
              onClick={() => handleSwipe(true)} 
              disabled={actionLoading}
            >
              ♥ Like
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Browse