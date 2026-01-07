import React, { createContext, useContext, useState, useEffect } from 'react'

type PrivacyContextType = {
  isPrivacyOn: boolean
  togglePrivacy: () => void
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivacyOn: false,
  togglePrivacy: () => {},
})

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isPrivacyOn, setIsPrivacyOn] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('babilon_privacy_mode')
    if (saved) {
      setIsPrivacyOn(JSON.parse(saved))
    }
  }, [])

  const togglePrivacy = () => {
    setIsPrivacyOn((prev) => {
      const newValue = !prev
      localStorage.setItem('babilon_privacy_mode', JSON.stringify(newValue))
      return newValue
    })
  }

  return (
    <PrivacyContext.Provider value={{ isPrivacyOn, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  return useContext(PrivacyContext)
}
