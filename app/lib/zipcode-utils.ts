/**
 * ZIP Code utilities for looking up town/city information
 */

export interface ZipCodeInfo {
  zipCode: string;
  city: string;
  state: string;
  county?: string;
}

/**
 * Look up town/city information from a ZIP code using Zippopotam.us API
 * @param zipCode - 5-digit US ZIP code
 * @returns City and state information, or null if not found
 */
export async function lookupZipCode(zipCode: string): Promise<ZipCodeInfo | null> {
  // Validate ZIP code format
  const cleanZip = zipCode.replace(/\D/g, '');
  if (cleanZip.length !== 5) {
    return null;
  }

  try {
    const response = await fetch(`https://api.zippopotam.us/us/${cleanZip}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      return {
        zipCode: cleanZip,
        city: place['place name'],
        state: place['state abbreviation'],
        county: place['county'] || undefined,
      };
    }

    return null;
  } catch (error) {
    console.error('Error looking up ZIP code:', error);
    return null;
  }
}

/**
 * Format ZIP code for display (adds hyphen for ZIP+4 if needed)
 */
export function formatZipCode(zip: string): string {
  const cleaned = zip.replace(/\D/g, '');
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }
  return cleaned.slice(0, 5);
}
