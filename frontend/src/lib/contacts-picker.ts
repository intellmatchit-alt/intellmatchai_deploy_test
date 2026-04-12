/**
 * Web Contacts Picker API Wrapper
 *
 * Provides access to the browser's Contact Picker API
 * for importing contacts from the user's phone.
 *
 * Note: This API is only available on mobile browsers (Chrome on Android, Safari on iOS)
 * and requires HTTPS in production.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Contact_Picker_API
 */

/**
 * Contact properties that can be requested
 */
export type ContactProperty = 'name' | 'email' | 'tel' | 'address' | 'icon';

/**
 * Options for the contact picker
 */
export interface ContactPickerOptions {
  /** Allow multiple contact selection */
  multiple?: boolean;
}

/**
 * Address returned from contact picker
 */
export interface ContactAddress {
  city?: string;
  country?: string;
  dependentLocality?: string;
  organization?: string;
  phone?: string;
  postalCode?: string;
  recipient?: string;
  region?: string;
  sortingCode?: string;
  streetAddress?: string;
}

/**
 * Contact returned from the Contact Picker API
 */
export interface PickedContact {
  name?: string[];
  email?: string[];
  tel?: string[];
  address?: ContactAddress[];
  icon?: Blob[];
}

/**
 * Normalized contact for our app
 */
export interface NormalizedContact {
  fullName: string;
  email?: string;
  phone?: string;
  company?: string;
  location?: string;
}

/**
 * Contact picker result
 */
export interface ContactPickerResult {
  success: boolean;
  contacts: NormalizedContact[];
  error?: string;
}

/**
 * Check if the Contact Picker API is supported
 */
export function isContactPickerSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'contacts' in navigator &&
    'ContactsManager' in window
  );
}

/**
 * Get supported contact properties
 */
export async function getSupportedProperties(): Promise<ContactProperty[]> {
  if (!isContactPickerSupported()) {
    return [];
  }

  try {
    // @ts-ignore - Contact Picker API types
    const supported = await navigator.contacts.getProperties();
    return supported as ContactProperty[];
  } catch {
    return [];
  }
}

/**
 * Pick contacts from the device
 *
 * @param properties - Which contact properties to request
 * @param options - Picker options
 * @returns Promise with picked contacts
 */
export async function pickContacts(
  properties: ContactProperty[] = ['name', 'email', 'tel'],
  options: ContactPickerOptions = { multiple: true }
): Promise<ContactPickerResult> {
  if (!isContactPickerSupported()) {
    return {
      success: false,
      contacts: [],
      error: 'Contact Picker API is not supported on this device or browser. Please use a mobile browser (Chrome on Android or Safari on iOS).',
    };
  }

  try {
    // @ts-ignore - Contact Picker API types
    const contacts: PickedContact[] = await navigator.contacts.select(properties, options);

    if (!contacts || contacts.length === 0) {
      return {
        success: false,
        contacts: [],
        error: 'No contacts selected',
      };
    }

    // Normalize contacts to our format
    const normalizedContacts = contacts.map(normalizeContact).filter((c): c is NormalizedContact => c !== null);

    return {
      success: true,
      contacts: normalizedContacts,
    };
  } catch (error) {
    // User cancelled or error occurred
    if (error instanceof Error && error.name === 'InvalidStateError') {
      return {
        success: false,
        contacts: [],
        error: 'Contact picker is already active',
      };
    }

    if (error instanceof Error && error.name === 'SecurityError') {
      return {
        success: false,
        contacts: [],
        error: 'Permission denied. Please allow access to contacts.',
      };
    }

    return {
      success: false,
      contacts: [],
      error: error instanceof Error ? error.message : 'Failed to pick contacts',
    };
  }
}

/**
 * Normalize a picked contact to our app format
 */
function normalizeContact(contact: PickedContact): NormalizedContact | null {
  // Must have at least a name
  const name = contact.name?.[0];
  if (!name) {
    return null;
  }

  // Get first email
  const email = contact.email?.[0];

  // Get first phone number and clean it
  let phone = contact.tel?.[0];
  if (phone) {
    // Remove common formatting but keep the digits
    phone = phone.replace(/[^\d+]/g, '');
  }

  // Try to extract company/organization from address
  const company = contact.address?.[0]?.organization;

  // Try to extract location from address
  let location: string | undefined;
  if (contact.address?.[0]) {
    const addr = contact.address[0];
    const parts = [addr.city, addr.region, addr.country].filter(Boolean);
    location = parts.join(', ') || undefined;
  }

  return {
    fullName: name,
    email,
    phone,
    company,
    location,
  };
}

/**
 * Deduplicate contacts against existing contacts
 *
 * @param newContacts - Newly imported contacts
 * @param existingContacts - Existing contacts to check against
 * @returns Contacts that don't already exist
 */
export function deduplicateContacts(
  newContacts: NormalizedContact[],
  existingContacts: Array<{ email?: string; phone?: string }>
): NormalizedContact[] {
  const existingEmails = new Set(
    existingContacts
      .map((c) => c.email?.toLowerCase())
      .filter(Boolean)
  );

  const existingPhones = new Set(
    existingContacts
      .map((c) => c.phone?.replace(/[^\d+]/g, ''))
      .filter(Boolean)
  );

  return newContacts.filter((contact) => {
    // Check email
    if (contact.email && existingEmails.has(contact.email.toLowerCase())) {
      return false;
    }

    // Check phone
    if (contact.phone) {
      const cleanPhone = contact.phone.replace(/[^\d+]/g, '');
      if (existingPhones.has(cleanPhone)) {
        return false;
      }
    }

    return true;
  });
}
