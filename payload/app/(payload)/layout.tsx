import React from 'react'

type Args = {
  children: React.ReactNode
}

const Layout = ({ children }: Args) => {
  return <>{children}</>
}

export default Layout
