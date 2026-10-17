import type { FC } from 'react'

interface LogoProps {
  variant?: 'horizontal' | 'icon'
  dark?: boolean
  className?: string
  alt?: string
  onClick?: () => void
}

/**
 * Anuvaad AI Theme-Adaptive Logo Component
 * Automatically serves dark or light SVG assets according to theme.
 */
export const Logo: FC<LogoProps> = ({
  variant = 'horizontal',
  dark = true,
  className = '',
  alt = 'Anuvaad AI',
  onClick,
}) => {
  let src = ''

  if (variant === 'icon') {
    src = dark ? '/icon-dark-theme.svg' : '/icon-light-theme.svg'
  } else {
    src = dark ? '/logo-horizontal-dark-theme.svg' : '/logo-horizontal-light-theme.svg'
  }

  return (
    <img
      src={src}
      alt={alt}
      onClick={onClick}
      className={`select-none transition-opacity duration-200 ${
        onClick ? 'cursor-pointer hover:opacity-90' : ''
      } ${className}`}
      loading="eager"
      draggable={false}
    />
  )
}

export default Logo
