import { ReactNode } from 'react'

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`panel${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}
