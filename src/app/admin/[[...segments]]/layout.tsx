import '@payloadcms/next/css'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import config from '../../../payload.config'
import React from 'react'
import { importMap } from './admin/importMap.js'
import '../custom-admin.css'

type Args = {
  children: React.ReactNode
  params: Promise<{
    segments?: string[]
  }>
}

const Layout = async ({ children, params }: Args) => {
  const resolvedParams = await params

  const serverFunction = async function (args: any) {
    'use server'
    return handleServerFunctions({
      ...args,
      config,
      importMap,
    })
  }

  return (
    <RootLayout
      config={config}
      importMap={importMap}
      serverFunction={serverFunction}
    >
      {children}
    </RootLayout>
  )
}

export default Layout
