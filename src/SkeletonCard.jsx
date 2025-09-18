import React from 'react'
import GlassCard from './components/GlassCard'

// Skeleton Profile Card Component
export function SkeletonProfileCard() {
  return (
    <div className="browse-wrapper">
      <GlassCard className="browse-card skeleton-card" hover={false}>
        {/* Skeleton Match Designation Badge */}
        <div className="skeleton-badge"></div>
        
        {/* Skeleton Profile Header */}
        <div className="skeleton-profile-header">
          <div className="skeleton-avatar"></div>
          <div className="skeleton-info">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-subtitle"></div>
            <div className="skeleton-line skeleton-location"></div>
          </div>
        </div>

        {/* Skeleton Match Details */}
        <div className="skeleton-match-details">
          <div className="skeleton-detail"></div>
          <div className="skeleton-detail-short"></div>
        </div>

        {/* Skeleton Favorites */}
        <div className="skeleton-favorites">
          <div className="skeleton-favorite-item"></div>
          <div className="skeleton-favorite-item"></div>
          <div className="skeleton-favorite-item"></div>
          <div className="skeleton-favorite-item"></div>
          <div className="skeleton-favorite-item"></div>
        </div>

        {/* Skeleton Actions */}
        <div className="skeleton-actions">
          <div className="skeleton-button"></div>
          <div className="skeleton-button"></div>
        </div>
      </GlassCard>
    </div>
  )
}

// Skeleton Match Item Component
export function SkeletonMatchItem() {
  return (
    <GlassCard className="skeleton-match-item" hover={false}>
      <div className="skeleton-match-avatar"></div>
      <div className="skeleton-match-info">
        <div className="skeleton-line skeleton-match-name"></div>
        <div className="skeleton-line skeleton-match-location"></div>
      </div>
    </GlassCard>
  )
}

// Skeleton Message Component
export function SkeletonMessage() {
  return (
    <GlassCard className="skeleton-message" hover={false}>
      <div className="skeleton-message-avatar"></div>
      <div className="skeleton-message-content">
        <div className="skeleton-line skeleton-message-line"></div>
        <div className="skeleton-line skeleton-message-line-short"></div>
      </div>
    </GlassCard>
  )
}

// Skeleton Form Component
export function SkeletonForm() {
  return (
    <GlassCard className="skeleton-form" hover={false}>
      {/* Profile Picture Section */}
      <div className="skeleton-form-section">
        <div className="skeleton-label"></div>
        <div className="skeleton-input"></div>
      </div>

      {/* Age Section */}
      <div className="skeleton-form-section">
        <div className="skeleton-label"></div>
        <div className="skeleton-input"></div>
      </div>

      {/* Gender Section */}
      <div className="skeleton-form-section">
        <div className="skeleton-label"></div>
        <div className="skeleton-checkbox-group">
          <div className="skeleton-checkbox"></div>
          <div className="skeleton-checkbox"></div>
          <div className="skeleton-checkbox"></div>
          <div className="skeleton-checkbox"></div>
        </div>
      </div>

      {/* Location Section */}
      <div className="skeleton-form-section">
        <div className="skeleton-label"></div>
        <div className="skeleton-input"></div>
      </div>

      {/* Looking For Section */}
      <div className="skeleton-form-section">
        <div className="skeleton-label"></div>
        <div className="skeleton-checkbox-group">
          <div className="skeleton-checkbox"></div>
          <div className="skeleton-checkbox"></div>
          <div className="skeleton-checkbox"></div>
          <div className="skeleton-checkbox"></div>
        </div>
      </div>

      {/* Favorites Section */}
      <div className="skeleton-form-section">
        <div className="skeleton-label"></div>
        <div className="skeleton-favorites-grid">
          <div className="skeleton-favorite-input"></div>
          <div className="skeleton-favorite-input"></div>
          <div className="skeleton-favorite-input"></div>
          <div className="skeleton-favorite-input"></div>
          <div className="skeleton-favorite-input"></div>
        </div>
      </div>

      {/* Save Button */}
      <div className="skeleton-form-actions">
        <div className="skeleton-save-button"></div>
      </div>
    </GlassCard>
  )
}

// Loading Spinner Component
export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <div className={`loading-spinner ${sizeClasses[size]} ${className}`}>
      <div className="spinner-inner"></div>
    </div>
  )
}

// Loading Button Component
export function LoadingButton({ children, loading = false, disabled = false, className = '', ...props }) {
  return (
    <button 
      className={`loading-button ${loading ? 'loading' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" />}
      <span className={loading ? 'loading-text' : ''}>{children}</span>
    </button>
  )
}