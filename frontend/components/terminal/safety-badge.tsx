'use client'

import { ShieldAlert, ShieldCheck, HelpCircle, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SafetyBadgeProps {
  type: 'live-locked' | 'read-only' | 'ai-advisory' | 'general-lock' | 'broker-mutation-disabled'
  className?: string
  size?: 'xs' | 'sm' | 'md'
}

export function SafetyBadge({ type, className, size = 'xs' }: SafetyBadgeProps) {
  let label = ''
  let bgClass = ''
  let borderClass = ''
  let textClass = ''
  let icon = null

  const sizeClasses = {
    xs: 'text-[9px] py-0.5 px-1.5 gap-1 rounded-sm border font-mono tracking-wider uppercase',
    sm: 'text-2xs py-1 px-2 gap-1.5 rounded border font-mono tracking-wider uppercase',
    md: 'text-xs py-1.5 px-2.5 gap-2 rounded border font-mono tracking-wider uppercase font-semibold',
  }

  const iconSize = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

  switch (type) {
    case 'live-locked':
      label = 'LIVE LOCKED'
      bgClass = 'bg-down/10'
      borderClass = 'border-down/30'
      textClass = 'text-down'
      icon = <ShieldCheck className={cn(iconSize, 'text-down')} />
      break
    case 'read-only':
      label = 'PAPER / READ-ONLY'
      bgClass = 'bg-info/10'
      borderClass = 'border-info/30'
      textClass = 'text-info'
      icon = <ShieldAlert className={cn(iconSize, 'text-info')} />
      break
    case 'ai-advisory':
      label = 'AI ADVISORY ONLY'
      bgClass = 'bg-warn/10'
      borderClass = 'border-warn/30'
      textClass = 'text-warn'
      icon = <HelpCircle className={cn(iconSize, 'text-warn')} />
      break
    case 'broker-mutation-disabled':
      label = 'BROKER MUTATION DISABLED'
      bgClass = 'bg-[#a855f7]/10'
      borderClass = 'border-[#a855f7]/30'
      textClass = 'text-[#c084fc]'
      icon = <Lock className={cn(iconSize, 'text-[#c084fc]')} />
      break
    case 'general-lock':
      label = 'EXECUTION SHIELD'
      bgClass = 'bg-white/[0.02]'
      borderClass = 'border-border'
      textClass = 'text-text-2'
      icon = <ShieldCheck className={cn(iconSize, 'text-text-faint')} />
      break
  }

  return (
    <span
      className={cn(
        'inline-flex items-center',
        sizeClasses[size],
        bgClass,
        borderClass,
        textClass,
        className
      )}
      title={`${label} - Security & Hardened Environment Policy`}
    >
      {icon}
      <span>{label}</span>
    </span>
  )
}

export function SafetyBadgeGroup({ className, size = 'xs' }: { className?: string; size?: 'xs' | 'sm' | 'md' }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <SafetyBadge type="live-locked" size={size} />
      <SafetyBadge type="read-only" size={size} />
      <SafetyBadge type="broker-mutation-disabled" size={size} />
      <SafetyBadge type="ai-advisory" size={size} />
    </div>
  )
}
