'use client'
import { createContext, useContext } from 'react'

const Ctx = createContext({ regions: [], zones: [] })
export function AppData({ regions, zones, children }) {
  return <Ctx.Provider value={{ regions, zones }}>{children}</Ctx.Provider>
}
export const useAppData = () => useContext(Ctx)
