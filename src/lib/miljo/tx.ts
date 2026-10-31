import { commitTransaction, initTransaction, killTransaction, type PayloadRequest } from 'payload'

/**
 * Runs `fn` in one database transaction on `req` — every Payload call inside must pass `req`.
 * Used wherever a change and its audit row must land together or not at all. When `req` already
 * carries a transaction, it is joined and left for its owner to commit.
 */
export async function withTransaction<T>(req: PayloadRequest, fn: () => Promise<T>): Promise<T> {
  const owns = await initTransaction(req)
  try {
    const result = await fn()
    if (owns) await commitTransaction(req)
    return result
  } catch (err) {
    if (owns) await killTransaction(req)
    throw err
  }
}
