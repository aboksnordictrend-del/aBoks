'use client'

import { Field } from '../registrer/formParts'

// The rule itself is checked on the server (@/lib/miljo/registration/password, node:crypto — not importable here).
const PASSWORD_HINT = 'Minst 10 tegn, med minst én bokstav og ett tall.'

/** «Nytt passord» + «Gjenta nytt passord» — shared by the reset page and Min side. */
export function PasswordFields(props: {
  idPrefix: string
  password: string
  confirmation: string
  onPassword: (v: string) => void
  onConfirmation: (v: string) => void
  error: string | null
}) {
  return (
    <>
      <Field
        id={`${props.idPrefix}-password`}
        label="Nytt passord"
        name="password"
        type="password"
        autoComplete="new-password"
        value={props.password}
        onChange={props.onPassword}
        maxLength={128}
        hint={PASSWORD_HINT}
        error={props.error}
      />
      <Field
        id={`${props.idPrefix}-confirmation`}
        label="Gjenta nytt passord"
        name="passwordConfirmation"
        type="password"
        autoComplete="new-password"
        value={props.confirmation}
        onChange={props.onConfirmation}
        maxLength={128}
      />
    </>
  )
}
