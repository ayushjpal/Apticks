/**
 * Aptiverse Validation Utilities
 * Enforces canonical username rules, password strength, and identity normalization.
 */

export interface UsernameValidationStatus {
  isValid: boolean
  clean: string
  message: string
}

export interface PasswordValidationStatus {
  isValid: boolean
  message: string
}

/**
 * Normalizes user input into canonical username format.
 * Converts to lowercase and strips leading/trailing whitespaces.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Validates a username according to Aptiverse Master Specification:
 * - 3–20 characters
 * - lowercase letters (a-z), numbers (0-9), '.', '_', '-'
 * - no spaces or uppercase in canonical form
 * - cannot start with '.', '_', '-'
 * - cannot end with '.', '_', '-'
 * - reject consecutive separators ('..', '__', '--', '._', '_.', '.-', '-.')
 */
export function validateUsername(raw: string): UsernameValidationStatus {
  const clean = normalizeUsername(raw)

  if (!clean) {
    return {
      isValid: false,
      clean: '',
      message: 'Username cannot be empty.',
    }
  }

  if (clean.length < 3) {
    return {
      isValid: false,
      clean,
      message: 'Username must be at least 3 characters.',
    }
  }

  if (clean.length > 20) {
    return {
      isValid: false,
      clean,
      message: 'Username cannot exceed 20 characters.',
    }
  }

  // Allowed characters: lowercase a-z, 0-9, '.', '_', '-'
  const allowedCharsPattern = /^[a-z0-9_.-]+$/
  if (!allowedCharsPattern.test(clean)) {
    return {
      isValid: false,
      clean,
      message: 'Username can only contain letters, numbers, periods (.), underscores (_), and hyphens (-).',
    }
  }

  // Cannot start with separator
  if (/^[._-]/.test(clean)) {
    return {
      isValid: false,
      clean,
      message: 'Username cannot start with a period, underscore, or hyphen.',
    }
  }

  // Cannot end with separator
  if (/[._-]$/.test(clean)) {
    return {
      isValid: false,
      clean,
      message: 'Username cannot end with a period, underscore, or hyphen.',
    }
  }

  // Reject consecutive separators (e.g. .., __, --, ._, _., .-, -.)
  if (/[._-]{2,}/.test(clean)) {
    return {
      isValid: false,
      clean,
      message: 'Username cannot contain consecutive separators (e.g., "..", "__", "--", "._").',
    }
  }

  return {
    isValid: true,
    clean,
    message: 'Username format is valid.',
  }
}

/**
 * Validates password strength:
 * - minimum 8 characters
 * - at least one uppercase letter
 * - at least one lowercase letter
 * - at least one number
 * - at least one special character
 */
export function validatePassword(password: string): PasswordValidationStatus {
  if (!password) {
    return {
      isValid: false,
      message: 'Please enter a password.',
    }
  }

  if (password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long.',
    }
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter (A-Z).',
    }
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter (a-z).',
    }
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number (0-9).',
    }
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one special character (!@#$%^&* etc.).',
    }
  }

  return {
    isValid: true,
    message: 'Password is strong.',
  }
}


