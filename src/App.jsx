console.log('ENV TEST:', import.meta.env)
import { useState, useEffect } from 'react'
import { signUp, signIn, signOut, getUser, supabase } from './supabase'
import Browse from './Browse'
import Chat from './Chat'
import { SkeletonForm } from './SkeletonCard'
import GlassCard from './components/GlassCard'
import Button from './components/Button'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState(['', '', '', '', ''])
  const [profile, setProfile] = useState({
    age: '',
    gender: '',
    location: '',
    latitude: '',
    longitude: '',
    profilePicture: null,
    lookingFor: []
  })
  // Snapshots of what's stored in DB to compare for billing rules
  const [originalFavorites, setOriginalFavorites] = useState(['', '', '', '', ''])
  const [originalProfile, setOriginalProfile] = useState({
    age: '', gender: '', location: '', latitude: '', longitude: '', profilePicture: null, lookingFor: []
  })

  const [updateInfo, setUpdateInfo] = useState({ updateCount: 0, premium: false })
  const [authMode, setAuthMode] = useState('signin') // 'signin' or 'signup'
  const [authData, setAuthData] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [mode, setMode] = useState('profile') // 'profile' | 'browse' | 'chat'
  const [browseRefreshKey, setBrowseRefreshKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [profileImageFile, setProfileImageFile] = useState(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { user, error } = await getUser()
      if (error) throw error
      setUser(user)
      if (user) {
        await loadExistingFavorites(user.id)
      }
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadExistingFavorites = async (userId) => {
    setLoadingProfile(true)
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      if (data) {
        // Load favorites
        if (Array.isArray(data.favorites)) {
          const five = [...data.favorites]
          while (five.length < 5) five.push('')
          setFavorites(five.slice(0, 5))
          setOriginalFavorites(five.slice(0, 5))
        }
        
        // Load profile info
        const loadedProfile = {
          age: data.age || '',
          gender: data.gender || '',
          location: data.location || '',
          latitude: data.latitude || '',
          longitude: data.longitude || '',
          profilePicture: data.profile_picture || null,
          lookingFor: Array.isArray(data.looking_for) ? data.looking_for : []
        }
        setProfile(loadedProfile)
        setOriginalProfile(loadedProfile)
        
        // Load update/premium info
        setUpdateInfo({
          updateCount: typeof data.update_count === 'number' ? data.update_count : 0,
          premium: !!data.premium,
        })
      }
    } catch (e) {
      console.warn('No existing profile found or failed to load')
      setUpdateInfo({ updateCount: 0, premium: false })
      setOriginalFavorites(['', '', '', '', ''])
      setOriginalProfile({ age: '', gender: '', location: '', latitude: '', longitude: '', profilePicture: null, lookingFor: [] })
    } finally {
      setLoadingProfile(false)
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError('')
    
    try {
      let result
      if (authMode === 'signup') {
        result = await signUp(authData.email, authData.password)
      } else {
        result = await signIn(authData.email, authData.password)
      }
      
      if (result.error) {
        setAuthError(result.error.message)
      } else {
        setUser(result.data.user)
        setAuthData({ email: '', password: '' })
        setAuthError('')
        if (result.data.user) {
          await loadExistingFavorites(result.data.user.id)
        }
      }
    } catch (error) {
      setAuthError('An unexpected error occurred')
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      setUser(null)
      setFavorites(['', '', '', '', ''])
      setProfile({ age: '', gender: '', location: '', latitude: '', longitude: '', profilePicture: null, lookingFor: [] })
      setOriginalFavorites(['', '', '', '', ''])
      setOriginalProfile({ age: '', gender: '', location: '', latitude: '', longitude: '', profilePicture: null, lookingFor: [] })
      setUpdateInfo({ updateCount: 0, premium: false })
      setMode('profile')
      setProfileImageFile(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be smaller than 5MB')
        return
      }
      
      setProfileImageFile(file)
      
      // Create preview URL
      const reader = new FileReader()
      reader.onload = (e) => {
        setProfile({...profile, profilePicture: e.target.result})
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setProfileImageFile(null)
    setProfile({...profile, profilePicture: null})
  }

  const handleResetSwipes = async () => {
    if (!user) return
    const proceed = confirm('Reset all your likes/passes? This cannot be undone.')
    if (!proceed) return
    try {
      const { data, error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .select('id')

      if (error) throw error
      const deletedCount = Array.isArray(data) ? data.length : 0
      alert(`Your likes/passes have been reset. Deleted ${deletedCount} row(s).`)

      // Force Browse to refresh by remounting
      setBrowseRefreshKey((k) => k + 1)
    } catch (e) {
      console.error('Failed to reset likes/passes', e)
      alert(e.message || 'Could not reset likes/passes. Please try again.')
    }
  }

  const handleInputChange = (index, value) => {
    if (value.length <= 100) {
      const newFavorites = [...favorites]
      newFavorites[index] = value
      setFavorites(newFavorites)
    }
  }

  const handlePayment = async () => {
    try {
      // Simulate payment processing
      const proceed = confirm('Payment simulation: $0.99 for unlimited updates.\n\nThis is a demo - no real payment will be charged.\n\nProceed with fake payment?')
      if (!proceed) return false

      // Simulate payment delay
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Update user to premium
      const { error } = await supabase
        .from('user_favorites')
        .update({ premium: true })
        .eq('user_id', user.id)

      if (error) throw error

      setUpdateInfo(prev => ({ ...prev, premium: true }))
      alert('Payment successful! You now have unlimited updates.')
      return true
    } catch (error) {
      console.error('Payment error:', error)
      alert('Payment failed. Please try again.')
      return false
    }
  }

  const arraysEqual = (a = [], b = []) => {
    if (a.length !== b.length) return false
    const as = [...a]
    const bs = [...b]
    as.sort(); bs.sort()
    return as.every((v, i) => v === bs[i])
  }

  const favoritesChanged = () => {
    // Compare non-empty favorites lists disregarding order/positions? Keep positions meaningful: compare arrays trimmed of trailing empties
    const trim = (arr) => {
      const copy = [...arr]
      // remove trailing empty strings for fair compare
      while (copy.length && copy[copy.length - 1] === '') copy.pop()
      return copy
    }
    const a = trim(favorites)
    const b = trim(originalFavorites)
    if (a.length !== b.length) return true
    for (let i = 0; i < a.length; i += 1) {
      if ((a[i] || '').trim() !== (b[i] || '').trim()) return true
    }
    return false
  }

  const toggleLookingFor = (option) => {
    setProfile(prev => {
      const current = new Set(prev.lookingFor)
      if (option === 'No preference') {
        return { ...prev, lookingFor: ['No preference'] }
      }
      current.delete('No preference')
      if (current.has(option)) current.delete(option); else current.add(option)
      return { ...prev, lookingFor: Array.from(current) }
    })
  }

  const searchLocation = async (query) => {
    if (!query.trim()) return
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`)
      const data = await response.json()
      
      if (data && data.length > 0) {
        const result = data[0]
        setProfile(prev => ({
          ...prev,
          location: result.display_name.split(',')[0],
          latitude: result.lat,
          longitude: result.lon
        }))
      } else {
        alert('Location not found. Please try a different search term.')
      }
    } catch (error) {
      console.error('Location search error:', error)
      alert('Error searching for location. Please try again.')
    }
  }

  const isProfileComplete = () => {
    const hasFavorites = favorites.some(f => f.trim() !== '')
    const hasBasics = profile.age && profile.gender && profile.location && profile.latitude && profile.longitude
    const hasLooking = profile.lookingFor && profile.lookingFor.length > 0
    return Boolean(hasFavorites && hasBasics && hasLooking)
  }

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    
    if (saving) return // Prevent multiple saves
    setSaving(true)

    // Ensure latest input values are captured even if focused
    const ageEl = typeof document !== 'undefined' ? document.getElementById('age') : null
    const latestAge = ageEl && ageEl.value !== undefined ? ageEl.value : profile.age
    if (String(latestAge) !== String(profile.age)) {
      setProfile(prev => ({ ...prev, age: latestAge }))
    }

    const filledFavorites = favorites.filter(fav => fav.trim() !== '')
    if (filledFavorites.length === 0) {
      alert('Please add at least one favorite thing!')
      return
    }

    if (!latestAge || !profile.gender || !profile.location) {
      alert('Please fill in your age, gender, and location!')
      return
    }

    if (!profile.latitude || !profile.longitude) {
      alert('Please search for your location to get coordinates!')
      return
    }

    if (!profile.lookingFor || profile.lookingFor.length === 0) {
      alert('Please select at least one option in Looking for')
      return
    }

    const needsBilling = favoritesChanged()

    if (!updateInfo.premium && updateInfo.updateCount >= 1 && needsBilling) {
      const proceed = confirm('You need premium to make more updates. Would you like to upgrade to unlimited updates for $0.99?')
      if (!proceed) {
        setSaving(false)
        return
      }
      await handlePayment()
      // Continue with save after payment
    }

    try {
      const nextUpdateCount = (!updateInfo.premium && needsBilling) ? updateInfo.updateCount + 1 : updateInfo.updateCount

      const { error } = await supabase
        .from('user_favorites')
        .upsert({
          user_id: user.id,
          favorites: favorites,
          age: parseInt(latestAge),
          gender: profile.gender,
          location: profile.location,
          latitude: parseFloat(profile.latitude),
          longitude: parseFloat(profile.longitude),
          profile_picture: profile.profilePicture,
          looking_for: profile.lookingFor,
          update_count: nextUpdateCount,
          premium: updateInfo.premium,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (error) throw error
      
      setUpdateInfo(prev => ({ ...prev, updateCount: nextUpdateCount }))
      setOriginalFavorites(favorites)
      setOriginalProfile(prev => ({ ...prev, age: latestAge }))

      alert('Profile saved successfully!')
    } catch (error) {
      console.error('Error saving profile:', error)
      alert(error.message || 'Error saving profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const renderNav = () => (
    <>
      {/* Desktop Navigation */}
      <nav className="desktop-nav">
        <div className="nav-links">
          <button 
            className={`nav-link ${mode === 'profile' ? 'active' : ''}`}
            onClick={() => setMode('profile')}
            disabled={!user}
          >
            👤 My Profile
          </button>
          <button 
            className={`nav-link ${mode === 'browse' ? 'active' : ''}`}
            onClick={() => setMode('browse')}
            disabled={!user || !isProfileComplete()}
          >
            🔍 Browse
          </button>
          <button 
            className={`nav-link ${mode === 'chat' ? 'active' : ''}`}
            onClick={() => setMode('chat')}
            disabled={!user || !isProfileComplete()}
          >
            💬 Chat
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="mobile-nav">
        <button 
          className={`mobile-nav-link ${mode === 'profile' ? 'active' : ''}`}
          onClick={() => setMode('profile')}
          disabled={!user}
        >
          <span className="nav-icon">👤</span>
          <span className="nav-text">Profile</span>
        </button>
        <button 
          className={`mobile-nav-link ${mode === 'browse' ? 'active' : ''}`}
          onClick={() => setMode('browse')}
          disabled={!user || !isProfileComplete()}
        >
          <span className="nav-icon">🔍</span>
          <span className="nav-text">Browse</span>
        </button>
        <button 
          className={`mobile-nav-link ${mode === 'chat' ? 'active' : ''}`}
          onClick={() => setMode('chat')}
          disabled={!user || !isProfileComplete()}
        >
          <span className="nav-icon">💬</span>
          <span className="nav-text">Chat</span>
        </button>
      </nav>
    </>
  )

  const MobileTabBar = () => (
    <div className="tabbar">
      <Button 
        variant="ghost" 
        className={`tab ${mode === 'browse' ? 'active' : ''}`} 
        onClick={() => setMode('browse')} 
        disabled={!user || !isProfileComplete()}
      >
        <span className="icon">🔍</span>
        <span>Browse</span>
      </Button>
      <Button 
        variant="ghost" 
        className={`tab ${mode === 'chat' ? 'active' : ''}`} 
        onClick={() => setMode('chat')} 
        disabled={!user || !isProfileComplete()}
      >
        <span className="icon">💬</span>
        <span>Matches</span>
      </Button>
      <Button 
        variant="ghost" 
        className={`tab ${mode === 'profile' ? 'active' : ''}`} 
        onClick={() => setMode('profile')} 
        disabled={!user}
      >
        <span className="icon">👤</span>
        <span>Profile</span>
      </Button>
    </div>
  )

  if (loading) {
    return (
      <div className="app">
        <div className="gradient-background"></div>
        <div className="container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app">
        <div className="gradient-background"></div>
        <div className="landing">
          {/* Hero */}
          <section className="hero">
            <h1>Meet interesting people, interested in meeting you</h1>
            <p>Say goodbye to quietly hoping to bump into your next friend</p>
          </section>


          {/* Auth */}
          <section className="auth-card">
            <div className="auth-tabs">
              <Button 
                variant="ghost"
                size="sm"
                className={`auth-tab ${authMode === 'signin' ? 'active' : ''}`}
                onClick={() => setAuthMode('signin')}
              >
                Sign In
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => setAuthMode('signup')}
              >
                Sign Up
              </Button>
            </div>

            <form onSubmit={handleAuth}>
              <div className="auth-input-group">
                <input
                  id="email"
                  type="email"
                  value={authData.email}
                  onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                  placeholder="Enter your email"
                  required
                />
                <label htmlFor="email">Email</label>
              </div>
              
              <div className="auth-input-group">
                <input
                  id="password"
                  type="password"
                  value={authData.password}
                  onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                  placeholder="Enter your password"
                  required
                />
                <label htmlFor="password">Password</label>
              </div>
              
              {authError && (
                <div className="error-message">{authError}</div>
              )}
              
              <div className="form-actions">
                <Button type="submit" variant="primary" size="lg" className="auth-button">
                  {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                </Button>
              </div>
            </form>

            <div className="auth-sep">or</div>
            <Button variant="secondary" size="lg" className="google-btn" type="button">Continue with Google</Button>
          </section>

          {/* Footer */}
          <footer className="footer">
            <a href="#">How it works</a> | <a href="#">Privacy</a> | <a href="#">About</a>
          </footer>
        </div>
      </div>
    )
  }

  const profileIncomplete = !isProfileComplete()

  return (
    <div className="app">
      <div className="gradient-background"></div>
      <div className="container">
        <div className="header">
          <div className="brand">
            <img src="/philos-hand.svg" alt="Philos hand logo" className="brand-logo" />
            <b>Philos</b>
          </div>
          <div className="header-actions">
            <Button variant="secondary" size="sm" onClick={handleResetSwipes}>Reset Likes/Passes</Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </div>

        {profileIncomplete && (
          <div className="onboarding-banner">
            <strong>Complete your profile to get better matches.</strong> Finish your basics and favorites to unlock Browse & Chat.
          </div>
        )}

        {renderNav()}
        
        {mode === 'profile' ? (
          <>
            {loadingProfile ? (
              <SkeletonForm />
            ) : (
              <>
                <p className="subtitle">Complete your profile to find friends with similar interests!</p>

                <div className="billing-row">
                  {updateInfo.premium && (
                    <span className="premium-star">⭐</span>
                  )}
                  <div className="update-info">
                    <span className="update-count">Updates used: {updateInfo.updateCount}</span>
                    {!updateInfo.premium && updateInfo.updateCount >= 1 && (
                      <button 
                        className="upgrade-link"
                        onClick={handlePayment}
                        type="button"
                      >
                        Unlock unlimited updates for $0.99
                      </button>
                    )}
                  </div>
                </div>

                <GlassCard className="form-card" delay={0.2}>
                  <form onSubmit={handleSave}>
                    <div className="favorites-form">
                {/* Profile Picture - File Upload */}
                <div className="input-group">
                  <label htmlFor="profile-picture">Profile Picture</label>
                  <div className="profile-picture-upload">
                    <input
                      id="profile-picture"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="profile-picture" className="upload-button">
                      {profile.profilePicture ? 'Change Photo' : 'Choose Photo'}
                    </label>
                    {profile.profilePicture && (
                      <div className="profile-preview">
                        <img src={profile.profilePicture} alt="Profile preview" />
                        <button type="button" className="remove-image" onClick={removeImage}>
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Basic Info */}
                <div className="profile-basics">
                  <div className="floating-input">
                    <input
                      id="age"
                      type="number"
                      value={profile.age}
                      onChange={(e) => setProfile({...profile, age: e.target.value})}
                      placeholder=" "
                      min="18"
                      max="100"
                    />
                    <label htmlFor="age">Age</label>
                  </div>

                  <div className="floating-input">
                    <select
                      id="gender"
                      value={profile.gender}
                      onChange={(e) => setProfile({...profile, gender: e.target.value})}
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                    <label htmlFor="gender">Gender</label>
                  </div>

                  <div className="floating-input">
                    <div className="location-search">
                      <input
                        id="location"
                        type="text"
                        value={profile.location}
                        onChange={(e) => setProfile({...profile, location: e.target.value})}
                        placeholder=" "
                        maxLength={50}
                      />
                      <label htmlFor="location">Location (Neighborhood/City)</label>
                      <Button 
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="search-location-btn"
                        onClick={() => searchLocation(profile.location)}
                      >
                        Search
                      </Button>
                    </div>
                    {profile.latitude && profile.longitude && (
                      <div className="location-coords">
                        ✓ Coordinates found: {parseFloat(profile.latitude).toFixed(4)}, {parseFloat(profile.longitude).toFixed(4)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Looking for */}
                <div className="input-group">
                  <label>Looking for</label>
                  <div className="checkbox-row">
                    {['Male','Female','Non-binary','No preference'].map(opt => (
                      <label key={opt} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={profile.lookingFor.includes(opt)}
                          onChange={() => toggleLookingFor(opt)}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  {(!profile.lookingFor || profile.lookingFor.length === 0) && (
                    <div className="error-message">Select at least one option</div>
                  )}
                </div>

                {/* Favorites */}
                <h3>Your 5 Favorite Things</h3>
                {favorites.map((favorite, index) => (
                  <div key={index} className="form-group">
                    <label htmlFor={`favorite-${index + 1}`}>
                      Favorite Thing #{index + 1}
                    </label>
                    <input
                      id={`favorite-${index + 1}`}
                      type="text"
                      value={favorite}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                      placeholder={`Enter your ${['first', 'second', 'third', 'fourth', 'fifth'][index]} favorite thing`}
                      maxLength={100}
                    />
                    <span className="char-count">
                      {favorite.length}/100
                    </span>
                  </div>
                ))}
                
                <Button 
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={saving}
                  disabled={saving}
                  className="save-button"
                >
                  Save My Profile
                </Button>
                    </div>
                  </form>
                </GlassCard>
              </>
            )}
          </>
        ) : mode === 'browse' ? (
          <Browse key={browseRefreshKey} />
        ) : (
          <Chat />
        )}
      </div>
      <MobileTabBar />
    </div>
  )
}

export default App
