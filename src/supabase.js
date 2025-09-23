import { createClient } from '@supabase/supabase-js'

// Access Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug logging to help troubleshoot
console.log('Environment check:')
console.log('import.meta.env keys:', Object.keys(import.meta.env))
console.log('VITE_SUPABASE_URL:', supabaseUrl)
console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Present (length: ' + supabaseAnonKey.length + ')' : 'Missing')

// Validate environment variables
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is missing. Please check your .env file.')
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is missing. Please check your .env file.')
}

if (!supabaseUrl.startsWith('https://')) {
  throw new Error('VITE_SUPABASE_URL must start with https://')
}

if (supabaseAnonKey.length < 100) {
  throw new Error('VITE_SUPABASE_ANON_KEY appears to be invalid (too short)')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Authentication helper functions
export const signUp = async (email, password) => {
  try {
    console.log('📝 Attempting sign up with:', { email, passwordLength: password?.length })
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) {
      console.error('🚨 Sign up error:', error)
      throw error
    }
    console.log('✅ Sign up successful:', data)
    return { data, error: null }
  } catch (error) {
    console.error('💥 Sign up failed:', error)
    return { data: null, error }
  }
}

export const signIn = async (email, password) => {
  try {
    console.log('🔐 Attempting sign in with:', { email, passwordLength: password?.length })
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      console.error('🚨 Sign in error:', error)
      throw error
    }
    console.log('✅ Sign in successful:', data)
    return { data, error: null }
  } catch (error) {
    console.error('💥 Sign in failed:', error)
    return { data: null, error }
  }
}

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) throw error
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export const getUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) throw error
    return { user, error: null }
  } catch (error) {
    return { user: null, error }
  }
}
