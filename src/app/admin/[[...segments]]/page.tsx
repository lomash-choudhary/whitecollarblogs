import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import config from '../../../payload.config'
import { importMap } from './admin/importMap.js'

type Args = {
  params: Promise<{
    segments?: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = async ({ params, searchParams }: Args) =>
  generatePageMetadata({ config, params, searchParams, importMap } as any)

const Page = async ({ params, searchParams }: Args) =>
  RootPage({ config, params, searchParams, importMap } as any)

export default Page
