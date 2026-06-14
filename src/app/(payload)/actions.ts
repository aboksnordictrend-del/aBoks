'use server'

import { handleServerFunctions } from '@payloadcms/next/layouts'
import type { ServerFunctionClientArgs } from 'payload'
import configPromise from '@payload-config'
import { importMap } from './admin/importMap.js'

export async function serverFunction(args: ServerFunctionClientArgs) {
  return handleServerFunctions({ ...args, config: configPromise, importMap })
}
