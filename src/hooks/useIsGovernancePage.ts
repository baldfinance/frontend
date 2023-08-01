import { useLocation } from 'react-router-dom'

export function useIsGovernancePage() {
  const { pathname } = useLocation()
  return (
    pathname.startsWith('/vote')
  )
}
