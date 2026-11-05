export type PageStatus = 'loading' | 'ready' | 'empty' | 'error' | 'network-error' | 'no-permission' | 'disabled' | 'business-unavailable' | 'unavailable'

export interface NavItem {
  label: string
  path: string
  icon: string
}

export interface QuickEntry {
  id: string
  label: string
  icon: string
  tone?: 'teal' | 'orange' | 'green' | 'blue' | 'gray'
  path?: string
  available: boolean
}
