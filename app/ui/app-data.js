'use client'
import { createContext, useContext } from 'react'

const Ctx = createContext({ regions: [] })
export function AppData({ regions, children }) {
  return <Ctx.Provider value={{ regions }}>{children}</Ctx.Provider>
}
export const useAppData = () => useContext(Ctx)
