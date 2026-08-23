import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  INQUIRY_LIMITS,
  INQUIRY_MESSAGES,
  firstInvalidField,
  validateInquiryInput,
  type RawInquiryInput,
} from './inquiry'

/**
 * The rule set both the browser and the endpoint run. Every case here is one a hand-rolled
 * POST can produce, which is why the validator — not the form — is what is asserted.
 */

const VALID: RawInquiryInput = {
  company: 'Nordisk Verksted AS',
  orgNumber: '123 456 789',
  contactPerson: 'Kari Nordmann',
  email: 'kari@nordiskverksted.no',
  phone: '+47 900 12 345',
  interest: 'aBoks Office',
  quantity: '25',
  message: 'Vi trenger batteriinnsamling på tre avdelinger.',
}

const build = (overrides: RawInquiryInput = {}) =>
  validateInquiryInput({ ...VALID, ...overrides })

/** Asserts a rejection and returns the errors, so each case reads as one statement. */
function errorsOf(overrides: RawInquiryInput) {
  const result = build(overrides)
  assert.equal(result.ok, false, 'expected the submission to be rejected')
  return result.ok ? {} : result.errors
}

function valueOf(overrides: RawInquiryInput = {}) {
  const result = build(overrides)
  assert.equal(result.ok, true, 'expected the submission to be accepted')
  return result.ok ? result.value : ({} as never)
}

describe('validateInquiryInput — a valid submission', () => {
  it('accepts a fully filled form', () => {
    const value = valueOf()
    assert.equal(value.company, 'Nordisk Verksted AS')
    assert.equal(value.contactPerson, 'Kari Nordmann')
    assert.equal(value.email, 'kari@nordiskverksted.no')
    assert.equal(value.interest, 'aBoks Office')
    assert.equal(value.quantity, '25')
    assert.equal(value.message, 'Vi trenger batteriinnsamling på tre avdelinger.')
  })

  it('accepts a submission with only the required fields', () => {
    const value = valueOf({ orgNumber: '', phone: '', quantity: '' })
    assert.equal(value.orgNumber, undefined)
    assert.equal(value.phone, undefined)
    assert.equal(value.quantity, undefined)
  })

  it('trims and collapses whitespace rather than storing it', () => {
    const value = valueOf({ company: '  Nordisk   Verksted AS  ', email: '  kari@a.no ' })
    assert.equal(value.company, 'Nordisk Verksted AS')
    assert.equal(value.email, 'kari@a.no')
  })

  it('keeps paragraph breaks in the message but drops runs of blank lines', () => {
    const value = valueOf({ message: 'Første avsnitt.\n\n\n\nAndre avsnitt.' })
    assert.equal(value.message, 'Første avsnitt.\n\nAndre avsnitt.')
  })

  it('normalises the organisation number to nine digits', () => {
    assert.equal(valueOf({ orgNumber: '123 456 789' }).orgNumber, '123456789')
  })

  it('omits an absent optional field instead of storing an empty string', () => {
    const value = valueOf({ phone: undefined, quantity: undefined, orgNumber: undefined })
    assert.ok(!('phone' in value))
    assert.ok(!('quantity' in value))
    assert.ok(!('orgNumber' in value))
  })
})

describe('validateInquiryInput — required fields', () => {
  it('rejects a missing company name', () => {
    assert.equal(errorsOf({ company: '' }).company, INQUIRY_MESSAGES.companyRequired)
  })

  it('rejects a missing contact person', () => {
    assert.equal(
      errorsOf({ contactPerson: '' }).contactPerson,
      INQUIRY_MESSAGES.contactPersonRequired,
    )
  })

  it('rejects a missing email', () => {
    assert.equal(errorsOf({ email: '' }).email, INQUIRY_MESSAGES.emailRequired)
  })

  it('rejects a missing interest', () => {
    assert.equal(errorsOf({ interest: '' }).interest, INQUIRY_MESSAGES.interestRequired)
  })

  it('rejects a missing message', () => {
    assert.equal(errorsOf({ message: '' }).message, INQUIRY_MESSAGES.messageRequired)
  })

  it('rejects a non-string value as missing rather than coercing it', () => {
    const errors = errorsOf({ company: 42, message: { toString: () => 'hei' } })
    assert.equal(errors.company, INQUIRY_MESSAGES.companyRequired)
    assert.equal(errors.message, INQUIRY_MESSAGES.messageRequired)
  })

  it('reports every failing field at once, so the form can flag them all', () => {
    const errors = errorsOf({ company: '', email: '', message: '' })
    assert.deepEqual(Object.keys(errors).sort(), ['company', 'email', 'message'])
  })
})

describe('validateInquiryInput — whitespace-only values', () => {
  for (const blank of ['   ', '\t\t', '\n\n', '   '.replace(/ /g, ' ')]) {
    it(`rejects ${JSON.stringify(blank)} in a required field`, () => {
      const errors = errorsOf({ company: blank, contactPerson: blank, message: blank })
      assert.equal(errors.company, INQUIRY_MESSAGES.companyRequired)
      assert.equal(errors.contactPerson, INQUIRY_MESSAGES.contactPersonRequired)
      assert.equal(errors.message, INQUIRY_MESSAGES.messageRequired)
    })
  }

  it('treats a whitespace-only optional field as absent, not as an error', () => {
    const value = valueOf({ phone: '   ', quantity: '  ', orgNumber: ' ' })
    assert.equal(value.phone, undefined)
    assert.equal(value.quantity, undefined)
    assert.equal(value.orgNumber, undefined)
  })
})

describe('validateInquiryInput — email', () => {
  for (const bad of ['kari', 'kari@', '@nordisk.no', 'kari@nordisk', 'kari nordmann@a.no']) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      assert.equal(errorsOf({ email: bad }).email, INQUIRY_MESSAGES.emailInvalid)
    })
  }

  it(`rejects an address longer than ${INQUIRY_LIMITS.emailMax} characters`, () => {
    const long = `${'a'.repeat(INQUIRY_LIMITS.emailMax)}@example.no`
    assert.equal(errorsOf({ email: long }).email, INQUIRY_MESSAGES.emailInvalid)
  })
})

describe('validateInquiryInput — lengths', () => {
  it('accepts a message of exactly the maximum length', () => {
    const message = 'a'.repeat(INQUIRY_LIMITS.messageMax)
    assert.equal(valueOf({ message }).message.length, INQUIRY_LIMITS.messageMax)
  })

  it('rejects an overlong message', () => {
    const message = 'a'.repeat(INQUIRY_LIMITS.messageMax + 1)
    assert.equal(errorsOf({ message }).message, INQUIRY_MESSAGES.messageTooLong)
  })

  it('rejects an overlong company name', () => {
    const company = 'a'.repeat(INQUIRY_LIMITS.companyMax + 1)
    assert.equal(errorsOf({ company }).company, INQUIRY_MESSAGES.companyTooLong)
  })

  it('rejects an overlong contact name', () => {
    const contactPerson = 'a'.repeat(INQUIRY_LIMITS.contactPersonMax + 1)
    assert.equal(errorsOf({ contactPerson }).contactPerson, INQUIRY_MESSAGES.contactPersonTooLong)
  })

  it('rejects an overlong phone number', () => {
    const phone = '9'.repeat(INQUIRY_LIMITS.phoneMax + 1)
    assert.equal(errorsOf({ phone }).phone, INQUIRY_MESSAGES.phoneInvalid)
  })

  it('rejects an overlong quantity', () => {
    const quantity = '1'.repeat(INQUIRY_LIMITS.quantityMax + 1)
    assert.equal(errorsOf({ quantity }).quantity, INQUIRY_MESSAGES.quantityInvalid)
  })
})

describe('validateInquiryInput — optional field formats', () => {
  it('rejects an organisation number that is not nine digits', () => {
    assert.equal(errorsOf({ orgNumber: '12345' }).orgNumber, INQUIRY_MESSAGES.orgNumberInvalid)
    assert.equal(errorsOf({ orgNumber: 'abcdefghi' }).orgNumber, INQUIRY_MESSAGES.orgNumberInvalid)
  })

  it('rejects a phone number with fewer than eight digits', () => {
    assert.equal(errorsOf({ phone: '12 34' }).phone, INQUIRY_MESSAGES.phoneInvalid)
  })

  it('rejects a quantity that is not a plain number', () => {
    assert.equal(errorsOf({ quantity: 'ca. 25' }).quantity, INQUIRY_MESSAGES.quantityInvalid)
  })
})

describe('validateInquiryInput — interest', () => {
  it('accepts every option the dropdown offers', () => {
    for (const option of [
      'Produkter til egen bedrift',
      'aBoks Spesial',
      'aBoks Office',
      'Større bestilling',
      'Forhandlersamarbeid',
      'Dropshipping',
      'Annet',
    ]) {
      assert.equal(valueOf({ interest: option }).interest, option)
    }
  })

  it('rejects a value the dropdown cannot produce', () => {
    assert.equal(
      errorsOf({ interest: 'Noe helt annet' }).interest,
      INQUIRY_MESSAGES.interestRequired,
    )
  })
})

describe('validateInquiryInput — markup is preserved for the templates to escape', () => {
  it('keeps angle brackets rather than silently deleting part of a message', () => {
    const value = valueOf({ message: 'Vi trenger <10 bokser per avdeling.' })
    assert.equal(value.message, 'Vi trenger <10 bokser per avdeling.')
  })

  it('keeps a script-looking company name verbatim, so escaping is the single defence', () => {
    const value = valueOf({ company: '<script>alert(1)</script>' })
    assert.equal(value.company, '<script>alert(1)</script>')
  })
})

describe('firstInvalidField', () => {
  it('walks the fields in form order', () => {
    assert.equal(firstInvalidField({ message: 'x', company: 'x' }), 'company')
    assert.equal(firstInvalidField({ message: 'x', email: 'x' }), 'email')
    assert.equal(firstInvalidField({ message: 'x' }), 'message')
  })

  it('returns undefined when nothing failed', () => {
    assert.equal(firstInvalidField({}), undefined)
  })
})
