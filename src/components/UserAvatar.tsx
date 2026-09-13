import { useEffect, useState } from 'react'
import { avatarInitial, resolveAvatarUrl } from '@/lib/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  src?: string | null
  name: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-20 w-20 text-2xl' }

export function UserAvatar({ src, name, className, size = 'md' }: UserAvatarProps) {
  const url = resolveAvatarUrl(src)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  if (url) {
    return (
      <>
        <figure
          className={cn('cursor-zoom-in overflow-hidden rounded-full', sizes[size], className)}
          role="button"
          tabIndex={0}
          aria-label={`View ${name}'s avatar`}
          onClick={event => { event.stopPropagation(); setOpen(true) }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              event.stopPropagation()
              setOpen(true)
            }
          }}
        >
          <img src={url} alt={name} className="h-full w-full object-cover" />
        </figure>
        {open && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-6"
            role="dialog"
            aria-label={`${name}'s avatar`}
            onClick={() => setOpen(false)}
          >
            <img
              src={url}
              alt={name}
              className="max-h-[90vh] max-w-[90vw] object-contain shadow-2xl"
              onClick={event => event.stopPropagation()}
            />
          </div>
        )}
      </>
    )
  }
  return (
    <figure className={cn('flex items-center justify-center rounded-full bg-primary/15 font-semibold text-primary', sizes[size], className)}>
      {avatarInitial(name)}
    </figure>
  )
}
