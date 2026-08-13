import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { getStatusBadgeClass, getStatusOptions, type StatusType, type StatusValue } from '../lib/statusHelpers'

interface StatusDropdownProps {
  jobId: string
  currentValue: StatusValue
  statusType: StatusType
  disabled?: boolean
  onUpdate: (jobId: string, newValue: StatusValue) => Promise<void>
}

export default function StatusDropdown({ jobId, currentValue, statusType, disabled, onUpdate }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; btnTop: number; left: number; up: boolean } | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const badgeRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const options = getStatusOptions(statusType)

  useLayoutEffect(() => {
    if (!isOpen) return
    const badge = badgeRef.current
    if (!badge) return
    const rect = badge.getBoundingClientRect()
    const menuH = options.length * 36 + 12
    const left = rect.left
    const roomRight = window.innerWidth - rect.left
    const estW = 180
    const l = roomRight < estW ? Math.max(8, rect.right - estW) : left
    setPosition({
      top: rect.bottom + 4,
      btnTop: rect.top,
      left: l,
      up: rect.bottom + menuH > window.innerHeight,
    })
  }, [isOpen, options.length])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => (i + 1) % options.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => (i - 1 + options.length) % options.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const option = options[activeIdx]
        if (option) void onUpdate(jobId, option)
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, options, activeIdx, jobId, onUpdate])

  const handlePick = (option: StatusValue) => {
    setIsOpen(false)
    if (option !== currentValue) void onUpdate(jobId, option)
  }

  const badgeClass = getStatusBadgeClass(statusType, currentValue)
  const baseBadge = `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}`

  if (disabled) {
    return <span className={baseBadge}>{currentValue}</span>
  }

  return (
    <>
      <button
        ref={badgeRef}
        type="button"
        role="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((v) => !v)
          setActiveIdx(Math.max(0, options.indexOf(currentValue)))
        }}
        className={`${baseBadge} hover:ring-2 hover:ring-slate-200 cursor-pointer transition-shadow`}
      >
        {currentValue}
        <svg className="w-3 h-3 opacity-60" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      {isOpen && position && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[10rem] max-h-[40vh] overflow-y-auto"
            style={
              position.up
                ? { left: position.left, bottom: window.innerHeight - position.btnTop + 4 }
                : { left: position.left, top: position.top }
            }
          >
            {options.map((option, i) => {
              const isActive = option === currentValue
              const isHover = i === activeIdx
              return (
                <button
                  key={option}
                  type="button"
                  role="menuitem"
                  onClick={() => handlePick(option)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 text-left ${
                    isHover ? 'bg-slate-50' : ''
                  } ${isActive ? 'font-semibold text-slate-900' : ''}`}
                >
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(statusType, option)}`}>
                    {option}
                  </span>
                  {isActive && <Check className="w-4 h-4 ml-auto text-blue-600" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}