import { motion } from 'framer-motion'
import './Button.css'

const Button = ({ 
  children, 
  onClick, 
  type = 'button',
  variant = 'primary', 
  size = 'md',
  disabled = false,
  loading = false,
  className = '', 
  ...props 
}) => {
  const buttonClass = `button button--${variant} button--${size} ${className} ${disabled ? 'button--disabled' : ''} ${loading ? 'button--loading' : ''}`

  const LoadingSpinner = () => (
    <div className="button__spinner">
      <div className="spinner-inner"></div>
    </div>
  )

  return (
    <motion.button
      className={buttonClass}
      onClick={onClick}
      type={type}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { 
        transition: { duration: 0.2 }
      } : {}}
      whileTap={!disabled && !loading ? { 
        scale: 0.98,
        transition: { duration: 0.05 }
      } : {}}
      {...props}
    >
      {loading && <LoadingSpinner />}
      <span className={`button__content ${loading ? 'button__content--loading' : ''}`}>
        {children}
      </span>
    </motion.button>
  )
}

export default Button