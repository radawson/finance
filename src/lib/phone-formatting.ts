/**
 * Phone Number Formatting Utilities
 * 
 * Handles phone number formatting for display and storage
 * - Display format: +1 (XXX) XXX-XXXX
 * - Storage format: E.164 (+1XXXXXXXXXX)
 * - Default country code: +1 (US/Canada)
 */

/**
 * Normalize phone input by extracting digits and handling country code
 * @param input - Raw phone input (can contain formatting characters)
 * @returns Normalized phone number with country code
 */
export function normalizePhoneInput(input: string): string {
  if (!input) return ''

  // Extract all digits
  const digits = input.replace(/\D/g, '')

  if (digits.length === 0) return ''

  // If input starts with +, user explicitly provided country code
  if (input.trim().startsWith('+')) {
    // Extract country code and number
    const afterPlus = input.substring(1).replace(/\D/g, '')
    return `+${afterPlus}`
  }

  // If 11 digits and starts with 1, assume it's already +1XXXXXXXXXX
  if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`
  }

  // If 10 digits, prepend +1
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // If less than 10 digits, assume it's partial input for US number
  if (digits.length < 10) {
    return `+1${digits}`
  }

  // If more than 11 digits or doesn't start with 1, assume it has country code
  // Just prepend + if not already there
  return `+${digits}`
}

/**
 * Format phone number for display: +1 (XXX) XXX-XXXX
 * @param phone - Phone number in E.164 format or any format
 * @returns Formatted phone number for display
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return ''

  // Normalize first to ensure we have consistent format
  const normalized = normalizePhoneInput(phone)

  // Extract all digits
  const digits = normalized.replace(/\D/g, '')
  
  if (digits.length === 0) return ''

  // Determine country code
  let countryCode = '+1'
  let numberDigits = digits

  if (normalized.startsWith('+')) {
    // Extract country code (1-3 digits after +)
    const countryCodeMatch = normalized.match(/^\+(\d{1,3})/)
    if (countryCodeMatch) {
      countryCode = `+${countryCodeMatch[1]}`
      // Remove country code digits from the number
      const countryCodeDigits = countryCodeMatch[1]
      if (digits.startsWith(countryCodeDigits)) {
        numberDigits = digits.substring(countryCodeDigits.length)
      }
    }
  } else {
    // No + prefix, assume US number
    // If 11 digits starting with 1, remove the leading 1
    if (digits.length === 11 && digits[0] === '1') {
      numberDigits = digits.substring(1)
    }
    // If 10 digits, use as-is
    // If less than 10, use as-is (partial number)
  }

  // Handle US/Canada (+1) format
  if (countryCode === '+1' && numberDigits.length === 10) {
    const areaCode = numberDigits.substring(0, 3)
    const exchange = numberDigits.substring(3, 6)
    const number = numberDigits.substring(6, 10)
    return `+1 (${areaCode}) ${exchange}-${number}`
  }

  // Handle partial US numbers (less than 10 digits)
  if (countryCode === '+1' && numberDigits.length < 10) {
    // Show partial formatting
    if (numberDigits.length === 0) {
      return '+1'
    } else if (numberDigits.length <= 3) {
      return `+1 (${numberDigits}`
    } else if (numberDigits.length <= 6) {
      return `+1 (${numberDigits.substring(0, 3)}) ${numberDigits.substring(3)}`
    } else {
      return `+1 (${numberDigits.substring(0, 3)}) ${numberDigits.substring(3, 6)}-${numberDigits.substring(6)}`
    }
  }

  // Handle other country codes - format as +XX XXX XXX XXXX (flexible)
  if (countryCode !== '+1' && numberDigits.length > 0) {
    // For non-US numbers, show country code and format the rest
    if (numberDigits.length <= 4) {
      return `${countryCode} ${numberDigits}`
    } else if (numberDigits.length <= 8) {
      const first = numberDigits.substring(0, numberDigits.length - 4)
      const last = numberDigits.substring(numberDigits.length - 4)
      return `${countryCode} ${first} ${last}`
    } else {
      // For longer numbers, group in chunks of 3-4 digits
      const chunks: string[] = []
      let remaining = numberDigits
      while (remaining.length > 0) {
        if (remaining.length > 4) {
          chunks.push(remaining.substring(0, 3))
          remaining = remaining.substring(3)
        } else {
          chunks.push(remaining)
          remaining = ''
        }
      }
      return `${countryCode} ${chunks.join(' ')}`
    }
  }

  // If we can't format properly, return normalized version
  return normalized
}

/**
 * Format phone number for storage in E.164 format: +1XXXXXXXXXX
 * @param phone - Phone number in any format
 * @returns Phone number in E.164 format
 */
export function formatPhoneForStorage(phone: string | null | undefined): string {
  if (!phone) return ''

  const normalized = normalizePhoneInput(phone)
  return normalized
}

/**
 * Validate phone number format
 * @param phone - Phone number to validate
 * @returns true if phone number is valid
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false

  const normalized = normalizePhoneInput(phone)
  const digits = normalized.replace(/\D/g, '')

  // US/Canada: +1 followed by 10 digits = 11 total
  if (normalized.startsWith('+1')) {
    return digits.length === 11
  }

  // Other countries: + followed by country code (1-3 digits) and number (7-15 digits)
  // Total should be between 8 and 18 digits
  return digits.length >= 8 && digits.length <= 18
}
