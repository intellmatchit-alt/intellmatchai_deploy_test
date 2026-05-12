/**
 * CallerKit Phone Enrichment Service
 *
 * Looks up phone numbers via CallerKit API (caller-kit.com) to get caller name,
 * location, and carrier information.
 *
 * API: POST https://caller-kit.com/api/v1/search/number
 * Auth: api-key header
 *
 * @module infrastructure/external/enrichment/CallerKitService
 */

import { logger } from "../../../shared/logger/index.js";
import { config } from "../../../config/index.js";

/**
 * CallerKit lookup result
 */
export interface CallerKitResult {
  success: boolean;
  data?: {
    name: string;
    aliases: string[];
    location: { city: string; region: string; countryCode: string };
    carrier: { name: string; lineType: string };
  };
  error?: string;
  processingTimeMs: number;
}

/**
 * Phone prefix to ISO country code mapping
 */
const PHONE_COUNTRY_MAP: Record<string, string> = {
  "+962": "JO", // Jordan
  "+966": "SA", // Saudi Arabia
  "+971": "AE", // UAE
  "+968": "OM", // Oman
  "+965": "KW", // Kuwait
  "+973": "BH", // Bahrain
  "+974": "QA", // Qatar
  "+20": "EG", // Egypt
  "+961": "LB", // Lebanon
  "+963": "SY", // Syria
  "+964": "IQ", // Iraq
  "+970": "PS", // Palestine
  "+212": "MA", // Morocco
  "+216": "TN", // Tunisia
  "+213": "DZ", // Algeria
  "+218": "LY", // Libya
  "+249": "SD", // Sudan
  "+967": "YE", // Yemen
  "+1": "US", // US/Canada
  "+44": "GB", // UK
  "+49": "DE", // Germany
  "+33": "FR", // France
  "+39": "IT", // Italy
  "+90": "TR", // Turkey
  "+91": "IN", // India
  "+86": "CN", // China
  "+81": "JP", // Japan
  "+82": "KR", // South Korea
  "+61": "AU", // Australia
  "+55": "BR", // Brazil
  "+52": "MX", // Mexico
  "+7": "RU", // Russia
  "+234": "NG", // Nigeria
  "+27": "ZA", // South Africa
  "+60": "MY", // Malaysia
  "+65": "SG", // Singapore
  "+63": "PH", // Philippines
  "+62": "ID", // Indonesia
  "+66": "TH", // Thailand
  "+84": "VN", // Vietnam
  "+92": "PK", // Pakistan
  "+880": "BD", // Bangladesh
};

/**
 * Get ISO country code from phone number
 */
function getCountryCode(phone: string): string {
  // Try longest prefix first (4 digits like +962, +966)
  for (let len = 4; len >= 2; len--) {
    const prefix = phone.substring(0, len);
    if (PHONE_COUNTRY_MAP[prefix]) {
      return PHONE_COUNTRY_MAP[prefix];
    }
  }
  // Default to Jordan for unknown prefixes
  return "JO";
}

/**
 * CallerKit Phone Enrichment Service
 */
export class CallerKitService {
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.ai.callerKit?.apiKey;
    this.baseUrl = "https://caller-kit.com/api/v1";

    if (this.apiKey) {
      logger.info("CallerKit service configured", { baseUrl: this.baseUrl });
    } else {
      logger.warn("CallerKit service not configured - missing API key");
    }
  }

  /**
   * Check if CallerKit service is available
   */
  async isAvailable(): Promise<boolean> {
    return config.features.callerKit && !!this.apiKey;
  }

  /**
   * Look up a phone number
   */
  async lookupPhone(phone: string): Promise<CallerKitResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "CallerKit service not configured",
        processingTimeMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      const cleanPhone = phone.replace(
        /[\s\-\(\)\u0660-\u0669\u06F0-\u06F9]/g,
        (match) => {
          // Convert Arabic-Indic digits to Western digits
          const code = match.charCodeAt(0);
          if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
          if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
          return "";
        },
      );

      // Ensure + prefix
      const normalizedPhone = cleanPhone.startsWith("+")
        ? cleanPhone
        : `+${cleanPhone}`;
      const countryCode = getCountryCode(normalizedPhone);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.baseUrl}/search/number`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify({
          number: normalizedPhone,
          country_code: countryCode,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const processingTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = String(await response.json());
        logger.warn("CallerKit API error", {
          status: response.status,
          phone: normalizedPhone,
          error: errorBody,
        });
        return {
          success: false,
          error: `CallerKit API error: ${response.status}`,
          processingTimeMs,
        };
      }

      const result = (await response.json()) as any;

      if (!result.status) {
        return {
          success: false,
          error: result.msg || "CallerKit lookup failed",
          processingTimeMs,
        };
      }

      // Extract data from response
      const numberData = result.data?.numbers?.data?.[0];
      if (!numberData || !numberData.name) {
        return {
          success: false,
          error: "No data found for this number",
          processingTimeMs,
        };
      }

      // Get best name (primary name from CallerKit)
      const name = numberData.name;

      // Get aliases for additional context
      const aliases = (numberData.aliases || [])
        .map((a: any) => a.alias)
        .filter((a: string) => a && a !== name);

      logger.info("CallerKit lookup success", {
        phone: normalizedPhone,
        name,
        country: numberData.country,
        carrier: numberData.carrier,
        aliasCount: aliases.length,
        processingTimeMs,
      });

      return {
        success: true,
        data: {
          name,
          aliases,
          location: {
            city: "",
            region: "",
            countryCode: numberData.country || countryCode,
          },
          carrier: {
            name: numberData.carrier || "",
            lineType: "",
          },
        },
        processingTimeMs,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      if (error instanceof Error && error.name === "AbortError") {
        logger.warn("CallerKit lookup timed out", { phone });
        return {
          success: false,
          error: "Request timed out (15s)",
          processingTimeMs,
        };
      }

      logger.error("CallerKit lookup failed", { error, phone });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs,
      };
    }
  }
}

