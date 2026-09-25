export const paths = {
  login: '/login',
  home: '/',
  work: '/work',
  workOrder: (id: string) => `/wo/${id}`,
  instructions: (wiId?: string) => (wiId ? `/instructions?wi=${wiId}` : '/instructions'),
  quality: '/quality',
  inspection: (id: string) => `/quality/${id}`,
  alerts: '/alerts',
  more: '/more',
}

export const APP_VERSION = '0.1.0'
