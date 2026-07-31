// `to-snake-case` ships no types. It is the exact package Payload's Postgres adapter uses to
// derive column names from field names (@payloadcms/drizzle, schema/traverseFields), so the
// Pinterest connection tests import it directly rather than reimplementing the rule — a
// reimplementation that drifted would defeat the point of the check.
//
// It arrives as a transitive dependency of @payloadcms/drizzle. If it ever stops being hoisted,
// the import fails loudly in the test run rather than silently passing.
declare module 'to-snake-case' {
  const toSnakeCase: (input: string) => string
  export default toSnakeCase
}
