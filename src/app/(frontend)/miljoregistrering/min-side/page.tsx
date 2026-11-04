import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { accountDeliveries, accountOrganization, accountOverview } from '@/lib/miljo/account/organization'
import { dashboard } from '@/lib/miljo/account/service'
import { NO_INDEX, pageSession } from '../konto'
import MinSideView from './MinSideView'

export const metadata: Metadata = {
  title: 'Min side – Miljøregistrering',
  robots: NO_INDEX,
}

export const dynamic = 'force-dynamic'

/**
 * Min side: loads everything for the signed-in account's OWN organisation (the session decides;
 * nothing comes from the request) and renders ./MinSideView. Without an authorised session the
 * page redirects to sign-in.
 */
export default async function MinSidePage() {
  const session = await pageSession()
  // A temporary password must be replaced first; the session is refused here server-side.
  if (!session) redirect((await pageSession('password-change')) ? MILJO_PATHS.changeRequired : MILJO_PATHS.login)
  const [data, account] = await Promise.all([dashboard(session), accountOrganization(session)])
  const [overview, deliveries] = account ? await Promise.all([accountOverview(session, account), accountDeliveries(session, account)]) : [null, null]
  return <MinSideView data={data} overview={overview} deliveries={deliveries} otherLabel={account?.org.otherLabel} />
}
