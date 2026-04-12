/**
 * Scan Page
 *
 * Business card scanning with OCR - Dark Theme.
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n";
import {
  Camera24Regular,
  Image24Regular,
  Checkmark24Regular,
  ArrowLeft24Regular,
  Sparkle24Regular,
  ImageEdit24Regular,
  DocumentSearch24Regular,
} from "@fluentui/react-icons";

/**
 * Scan steps
 */
type ScanStep = "capture" | "processing" | "confirm" | "enriching" | "complete";

/**
 * Preprocessing info from backend
 */
interface PreprocessingData {
  applied: boolean;
  processingTimeMs?: number;
  cardConfidence?: number;
  qualityScore?: number;
  transformations?: string[];
  originalSize?: { width: number; height: number };
  processedSize?: { width: number; height: number };
  processedImageData?: string;
  processedMimeType?: string;
}

/**
 * Extracted data interface
 */
interface ExtractedData {
  name: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  website: string;
  linkedInUrl: string;
  location: string;
}

/**
 * Deep search result interface (real data from web)
 */
interface DeepSearchResult {
  name: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  bio?: string;
  linkedInUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  skills: string[];
  sectors: string[];
  interests: string[];
  hobbies?: string[];
  experience?: Array<{
    company?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    period?: string;
    isCurrent?: boolean;
    description?: string;
  }>;
  education?: Array<{
    school?: string;
    institution?: string;
    degree?: string;
    field?: string;
    year?: string;
    startYear?: number;
    endYear?: number;
  }>;
  pictureUrl?: string;
  iceBreakers?: string[];
  employmentVerification?: {
    status: "CURRENT" | "CHANGED" | "UNKNOWN" | "UNVERIFIED";
    cardData?: { company?: string; jobTitle?: string };
    verifiedData?: { company?: string; jobTitle?: string; source: string };
    changeDetails?: {
      previousCompany?: string;
      newCompany?: string;
      previousTitle?: string;
      newTitle?: string;
    };
    confidence: {
      overall: number;
      level: "HIGH" | "MEDIUM" | "LOW";
      reasons: string[];
    };
  };
  posts?: Array<{ content?: string; date?: string; url?: string }>;
  latestPostDate?: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
  searchEngine: string;
}

/**
 * AI suggestions interface (legacy, for backward compatibility)
 */
interface AISuggestions {
  sectors: string[];
  skills: string[];
  interests: string[];
  hobbies?: string[];
  bio: string;
  bioFull?: string;
  linkedInUrl?: string;
  location?: string;
  confidence?: string;
}

// Image card side type
interface CardImage {
  file: File;
  preview: string;
  side: "front" | "back";
  dimensions?: { width: number; height: number };
  processed?: boolean;
  extractedData?: Partial<ExtractedData>;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Safely write to sessionStorage, clearing old scan data if quota is exceeded */
function safeSessionSet(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    // Quota exceeded - clear old scan data and retry
    try {
      [
        "scannedContact",
        "aiSuggestions",
        "deepSearchResult",
        "cardImageUrl",
        "contactSource",
        "enrichmentData",
        "preprocessingData",
      ].forEach((k) => {
        try {
          sessionStorage.removeItem(k);
        } catch {}
      });
      sessionStorage.setItem(key, value);
      return true;
    } catch {
      console.warn(`Could not store ${key} in sessionStorage`);
      return false;
    }
  }
}

/** Compress an image data URL to fit in sessionStorage */
async function compressImageForStorage(
  dataUrl: string,
): Promise<string | null> {
  try {
    // If small enough, use as-is
    if (dataUrl.length < 500_000) return dataUrl;

    const img = new window.Image();
    img.src = dataUrl;
    return new Promise<string | null>((resolve) => {
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const maxDim = 400;
          const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export default function ScanPage() {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const backCameraInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ScanStep>("capture");
  // Multiple images support (front and back of card)
  const [cardImages, setCardImages] = useState<CardImage[]>([]);
  const [currentUploadSide, setCurrentUploadSide] = useState<"front" | "back">(
    "front",
  );
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processedImagePreview, setProcessedImagePreview] = useState<
    string | null
  >(null);
  const [preprocessingData, setPreprocessingData] =
    useState<PreprocessingData | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    jobTitle: "",
    website: "",
    linkedInUrl: "",
    location: "",
  });
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(
    null,
  );
  const [deepSearchResult, setDeepSearchResult] =
    useState<DeepSearchResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [scanStage, setScanStage] = useState<
    | "ocr"
    | "gpt"
    | "web_search"
    | "linkedin"
    | "wikipedia"
    | "analysis"
    | "complete"
  >("ocr");
  const [progressMessage, setProgressMessage] = useState<string>("");

  // Helper to detect LinkedIn URL
  const isLinkedInUrl = (url: string): boolean => {
    return url.toLowerCase().includes("linkedin.com");
  };

  // Parse and separate URLs
  const parseUrls = (
    websiteRaw: string,
  ): { website: string; linkedInUrl: string } => {
    const urls = websiteRaw.split(/[\s,;]+/).filter(Boolean);
    let website = "";
    let linkedInUrl = "";

    for (const url of urls) {
      if (isLinkedInUrl(url)) {
        linkedInUrl = url;
      } else if (!website) {
        website = url;
      }
    }

    return { website, linkedInUrl };
  };

  // Deep search for real data about the person
  const fetchDeepSearch = async (data: {
    name: string;
    company: string;
    jobTitle: string;
    email: string;
    website: string;
    linkedInUrl?: string;
  }) => {
    setIsDeepSearching(true);
    setIsLoadingAI(true);
    try {
      const token = localStorage.getItem("p2p_access_token");
      const response = await fetch("/api/scan/deep-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const searchResult = result.data as DeepSearchResult;
          setDeepSearchResult(searchResult);

          // Auto-fill extracted data with verified info from deep search
          setExtractedData((prev) => ({
            ...prev,
            name: searchResult.name || prev.name,
            company: searchResult.company || prev.company,
            jobTitle: searchResult.jobTitle || prev.jobTitle,
            linkedInUrl: searchResult.linkedInUrl || prev.linkedInUrl,
            website: searchResult.websiteUrl || prev.website,
          }));

          // Convert to AI suggestions format for backward compatibility
          setAiSuggestions({
            sectors: searchResult.sectors || [],
            skills: searchResult.skills || [],
            interests: searchResult.interests || [],
            bio: searchResult.bio || "",
          });

          // Auto-select found sectors
          if (searchResult.sectors?.length > 0) {
            setSelectedSectors(searchResult.sectors.slice(0, 3));
          }

          toast({
            title: t.scan?.profileFound || "Profile Found",
            description: (
              t.scan?.foundRealData ||
              "Found real data from {engine} ({confidence} confidence)"
            )
              .replace("{engine}", searchResult.searchEngine)
              .replace("{confidence}", searchResult.confidence),
            variant: "success",
          });
        }
      }
    } catch (error) {
      console.error("Deep search failed:", error);
      // Fallback to basic AI suggestions if deep search fails
      fetchAISuggestionsFallback(data);
    } finally {
      setIsDeepSearching(false);
      setIsLoadingAI(false);
    }
  };

  // Fallback AI suggestions (legacy)
  const fetchAISuggestionsFallback = async (data: {
    name: string;
    company: string;
    jobTitle: string;
    email: string;
    website: string;
  }) => {
    try {
      const token = localStorage.getItem("p2p_access_token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contacts/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        },
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setAiSuggestions(result.data);
          if (result.data.sectors?.length > 0) {
            setSelectedSectors(result.data.sectors.slice(0, 3));
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch AI suggestions:", error);
    }
  };

  const MAX_FILE_SIZE_MB = 10;

  const handleFileSelect = useCallback(
    (file: File, side: "front" | "back" = "front") => {
      // Validate file size
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast({
          title: t.scan?.fileTooLarge || "File too large",
          description:
            t.scan?.maxFileSize ||
            `Maximum file size is ${MAX_FILE_SIZE_MB}MB. Please use a smaller image.`,
          variant: "error",
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: t.scan?.invalidFileType || "Invalid file type",
          description:
            t.scan?.onlyImages ||
            "Only image files (JPEG, PNG, WebP) are supported.",
          variant: "error",
        });
        return;
      }

      // Low file size warning
      if (file.size < 100 * 1024) {
        toast({
          title: "Low quality image",
          description:
            "This image is very small and may not scan accurately. Try a higher resolution photo.",
          variant: "warning",
        });
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        setImagePreview(preview);

        // Read image dimensions
        const img = new window.Image();
        img.onload = () => {
          const dimensions = { width: img.width, height: img.height };

          if (img.width < 300 || img.height < 200) {
            toast({
              title: "Low resolution",
              description: `Image is ${img.width}×${img.height}px. For best OCR results, use at least 300×200px.`,
              variant: "warning",
            });
          }

          // Add to card images array with dimensions
          setCardImages((prev) => {
            const filtered = prev.filter((i) => i.side !== side);
            return [...filtered, { file, preview, side, dimensions }];
          });
        };
        img.onerror = () => {
          // Fallback without dimensions
          setCardImages((prev) => {
            const filtered = prev.filter((i) => i.side !== side);
            return [...filtered, { file, preview, side }];
          });
        };
        img.src = preview;
      };
      reader.readAsDataURL(file);
    },
    [t],
  );

  const handleCapture = async (side: "front" | "back" = "front") => {
    setCurrentUploadSide(side);
    if (side === "front") {
      fileInputRef.current?.click();
    } else {
      backFileInputRef.current?.click();
    }
  };

  const handleCameraCapture = (side: "front" | "back" = "front") => {
    setCurrentUploadSide(side);
    if (side === "front") {
      cameraInputRef.current?.click();
    } else {
      backCameraInputRef.current?.click();
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    side: "front" | "back" = "front",
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file, side);
    }
    // Reset input value so the same file can be re-selected
    e.target.value = "";
  };

  // Process all card images and combine results
  const processAllImages = async () => {
    if (cardImages.length === 0) {
      toast({
        title: t.scan?.noImage || "No image",
        description:
          t.scan?.pleaseUploadImage || "Please upload at least one image",
        variant: "error",
      });
      return;
    }

    setStep("processing");
    setIsProcessing(true);
    setScanStage("ocr");
    setProgressMessage(
      t.scan?.scanningBusinessCard || "Scanning business card...",
    );

    try {
      // Process each image and collect results
      const allResults: Partial<ExtractedData>[] = [];
      let lastPreprocessing: PreprocessingData | null = null;
      let lastAiData: AISuggestions | null = null;

      for (let i = 0; i < cardImages.length; i++) {
        const cardImage = cardImages[i];
        setProgressMessage(
          (t.scan?.scanningCardNum || "Scanning card {current} of {total}...")
            .replace("{current}", String(i + 1))
            .replace("{total}", String(cardImages.length)),
        );

        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(",")[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(cardImage.file);
        });

        setScanStage("gpt");
        setProgressMessage(
          t.scan?.extractingContactDetails || "Extracting contact details...",
        );

        // Call the OCR API
        const token = localStorage.getItem("p2p_access_token");

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/scan/card`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              imageData: base64,
              mimeType: cardImage.file.type || "image/jpeg",
            }),
          },
        );
        console.log("res", response);

        const data = await response.json();

        // Handle insufficient points
        if (response.status === 402) {
          toast({
            title: t.wallet?.insufficientPoints || "Insufficient Points",
            description: `${t.wallet?.pointsNeeded || "Points needed"}: ${data.error?.details?.needed || 0}. ${t.wallet?.currentBalance || "Current balance"}: ${data.error?.details?.available || 0}`,
            variant: "destructive",
          });
          setStep("capture");
          return;
        }

        if (data.success && data.data) {
          setScanStage("web_search");
          setProgressMessage(
            t.scan?.searchingWebMoreInfo ||
              "Searching the web for more information...",
          );

          const ocrFields =
            data.data.extractedFields || data.data.fields || data.data;
          const aiData = data.data.aiSuggestions;
          const enrichment = data.data.enrichment;
          const preprocessing = data.data
            .preprocessing as PreprocessingData | null;

          // Check if we got LinkedIn data
          if (aiData?.linkedInUrl || enrichment?.pictureUrl) {
            setScanStage("linkedin");
            setProgressMessage(
              t.scan?.foundLinkedIn ||
                "Found LinkedIn profile, extracting data...",
            );
            await new Promise((r) => setTimeout(r, 500)); // Brief pause for UI
          }

          lastPreprocessing = preprocessing;
          if (aiData) lastAiData = aiData;

          // Store enrichment data if available
          if (enrichment) {
            safeSessionSet("enrichmentData", JSON.stringify(enrichment));
          }

          // Parse URLs
          const rawWebsite = ocrFields.website || "";
          const { website, linkedInUrl: parsedLinkedIn } =
            parseUrls(rawWebsite);

          allResults.push({
            name: ocrFields.name || "",
            email: ocrFields.email || "",
            phone: ocrFields.phone || "",
            company: ocrFields.company || "",
            jobTitle: ocrFields.jobTitle || "",
            website: website,
            linkedInUrl: parsedLinkedIn || ocrFields.linkedInUrl || "",
            location: ocrFields.location || "",
          });
        }
      }

      setScanStage("analysis");
      setProgressMessage(
        t.scan?.analyzingCombining || "Analyzing and combining results...",
      );

      // Merge results from all images - prefer the most complete result
      // Sort by number of filled fields (most complete first)
      const scored = allResults.map((r) => ({
        result: r,
        score: Object.values(r).filter((v) => v && String(v).trim()).length,
      }));
      scored.sort((a, b) => b.score - a.score);

      const mergedData: ExtractedData = {
        name: "",
        email: "",
        phone: "",
        company: "",
        jobTitle: "",
        website: "",
        linkedInUrl: "",
        location: "",
      };

      for (const { result } of scored) {
        Object.keys(mergedData).forEach((key) => {
          const k = key as keyof ExtractedData;
          if (!mergedData[k] && result[k]) {
            mergedData[k] = result[k] as string;
          }
        });
      }

      // Apply AI suggestions if available
      if (lastAiData) {
        if (lastAiData.linkedInUrl && !mergedData.linkedInUrl) {
          mergedData.linkedInUrl = lastAiData.linkedInUrl;
        }
        if (lastAiData.location && !mergedData.location) {
          mergedData.location = lastAiData.location;
        }
      }

      setExtractedData(mergedData);
      setPreprocessingData(lastPreprocessing);
      if (lastAiData) setAiSuggestions(lastAiData);

      // === DEEP SEARCH: Discover LinkedIn profile and enrich data ===
      setScanStage("linkedin");
      setProgressMessage(t.scan?.searchingLinkedIn || "Searching LinkedIn...");

      try {
        const token = localStorage.getItem("p2p_access_token");
        const deepSearchResponse = await fetch("/api/scan/deep-search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            name: mergedData.name,
            company: mergedData.company,
            jobTitle: mergedData.jobTitle,
            email: mergedData.email,
            website: mergedData.website,
            linkedInUrl: mergedData.linkedInUrl || undefined,
          }),
        });

        if (deepSearchResponse.ok) {
          const deepResult = await deepSearchResponse.json();
          if (deepResult.success && deepResult.data) {
            const searchData = deepResult.data as DeepSearchResult;
            setDeepSearchResult(searchData);

            // Update merged data with LinkedIn info
            if (searchData.linkedInUrl && !mergedData.linkedInUrl) {
              mergedData.linkedInUrl = searchData.linkedInUrl;
            }
            if (searchData.pictureUrl) {
              (mergedData as any).pictureUrl = searchData.pictureUrl;
            }
            if (searchData.location && !mergedData.location) {
              mergedData.location = searchData.location;
            }
            if (searchData.bio) {
              (mergedData as any).bio = searchData.bio;
            }

            // Update AI suggestions with LinkedIn data
            setAiSuggestions((prev) => ({
              sectors: searchData.sectors || prev?.sectors || [],
              skills: searchData.skills || prev?.skills || [],
              interests: searchData.interests || prev?.interests || [],
              bio: searchData.bio || prev?.bio || "",
            }));

            console.log(
              `[Scan] Deep search found LinkedIn: ${searchData.linkedInUrl} (${searchData.confidence} confidence)`,
            );
          }
        }
      } catch (deepError) {
        console.error("[Scan] Deep search failed:", deepError);
        // Continue without LinkedIn data
      }

      setScanStage("complete");

      // Clear previous scan data to free sessionStorage space
      [
        "scannedContact",
        "aiSuggestions",
        "deepSearchResult",
        "cardImageUrl",
        "contactSource",
        "enrichmentData",
        "preprocessingData",
      ].forEach((key) => {
        try {
          sessionStorage.removeItem(key);
        } catch {}
      });

      // Store in sessionStorage (all writes use safe helper)
      safeSessionSet(
        "scannedContact",
        JSON.stringify({
          fullName: mergedData.name,
          email: mergedData.email,
          phone: mergedData.phone,
          company: mergedData.company,
          jobTitle: mergedData.jobTitle,
          website: mergedData.website,
          linkedInUrl: mergedData.linkedInUrl,
          location: mergedData.location,
        }),
      );

      // Get the current deep search result (from LinkedIn discovery above)
      const currentDeepSearch = deepSearchResult;

      // Store AI suggestions (prefer deep search data over OCR AI data)
      safeSessionSet(
        "aiSuggestions",
        JSON.stringify({
          sectors: currentDeepSearch?.sectors || lastAiData?.sectors || [],
          skills: currentDeepSearch?.skills || lastAiData?.skills || [],
          interests:
            currentDeepSearch?.interests || lastAiData?.interests || [],
          hobbies: lastAiData?.hobbies || [],
          bio: currentDeepSearch?.bio || lastAiData?.bio || "",
          bioFull:
            lastAiData?.bioFull ||
            currentDeepSearch?.bio ||
            lastAiData?.bio ||
            "",
          linkedInUrl:
            currentDeepSearch?.linkedInUrl ||
            lastAiData?.linkedInUrl ||
            mergedData.linkedInUrl ||
            "",
          location:
            currentDeepSearch?.location ||
            lastAiData?.location ||
            mergedData.location ||
            "",
          selectedSectors:
            currentDeepSearch?.sectors?.slice(0, 3) ||
            lastAiData?.sectors?.slice(0, 3) ||
            [],
        }),
      );

      // Store deep search result with all LinkedIn data
      safeSessionSet(
        "deepSearchResult",
        JSON.stringify({
          name: currentDeepSearch?.name || mergedData.name,
          company: currentDeepSearch?.company || mergedData.company,
          jobTitle: currentDeepSearch?.jobTitle || mergedData.jobTitle,
          bio: currentDeepSearch?.bio || lastAiData?.bio || "",
          bioFull:
            lastAiData?.bioFull ||
            currentDeepSearch?.bio ||
            lastAiData?.bio ||
            "",
          skills: currentDeepSearch?.skills || lastAiData?.skills || [],
          sectors: currentDeepSearch?.sectors || lastAiData?.sectors || [],
          interests:
            currentDeepSearch?.interests || lastAiData?.interests || [],
          hobbies: lastAiData?.hobbies || [],
          linkedInUrl:
            currentDeepSearch?.linkedInUrl ||
            lastAiData?.linkedInUrl ||
            mergedData.linkedInUrl ||
            "",
          location:
            currentDeepSearch?.location ||
            lastAiData?.location ||
            mergedData.location ||
            "",
          experience: currentDeepSearch?.experience || [],
          education: currentDeepSearch?.education || [],
          pictureUrl: currentDeepSearch?.pictureUrl || "",
          posts: currentDeepSearch?.posts || [],
          latestPostDate: currentDeepSearch?.latestPostDate || "",
          sources: currentDeepSearch?.sources || [],
          confidence: currentDeepSearch?.confidence || "medium",
          searchEngine: currentDeepSearch?.searchEngine || "none",
        }),
      );

      // Store the first card image - compress to avoid sessionStorage quota
      if (cardImages[0]?.preview) {
        const compressed = await compressImageForStorage(cardImages[0].preview);
        if (compressed) safeSessionSet("cardImageUrl", compressed);
      }

      safeSessionSet("contactSource", "CARD_SCAN");

      toast({
        title: t.scan?.dataExtracted || "Data Extracted",
        description: (
          t.scan?.scannedImages || "Scanned {count} image(s)"
        ).replace("{count}", String(cardImages.length)),
        variant: "success",
      });

      await new Promise((resolve) => setTimeout(resolve, 800));
      router.push("/contacts/new");
    } catch (error: any) {
      console.error("OCR error:", error);
      const errMsg = error?.message || "Unknown error";
      const errStack = error?.stack?.split("\n").slice(0, 2).join(" ") || "";
      toast({
        title: t.scan?.scanFailed || "Scan Failed",
        description: `${errMsg.substring(0, 150)}${errStack ? " | " + errStack.substring(0, 100) : ""}`,
        variant: "error",
      });
      setStep("capture");
    } finally {
      setIsProcessing(false);
    }
  };

  const removeCardImage = (side: "front" | "back") => {
    setCardImages((prev) => prev.filter((img) => img.side !== side));
  };

  const processImage = async (file: File) => {
    setStep("processing");
    setIsProcessing(true);
    setScanStage("ocr");

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix to get pure base64
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Animate through stages while API processes
      const stageAnimation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setScanStage("gpt");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setScanStage("analysis");
      };

      // Start animation and API call in parallel
      const animationPromise = stageAnimation();

      // Call the OCR API
      const token = localStorage.getItem("p2p_access_token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/scan/card`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            imageData: base64,
            mimeType: file.type || "image/jpeg",
          }),
        },
      );

      // Wait for both animation and API
      const [_, data] = await Promise.all([animationPromise, response.json()]);

      // Handle insufficient points
      if (response.status === 402) {
        toast({
          title: t.wallet?.insufficientPoints || "Insufficient Points",
          description: `${t.wallet?.pointsNeeded || "Points needed"}: ${data.error?.details?.needed || 0}. ${t.wallet?.currentBalance || "Current balance"}: ${data.error?.details?.available || 0}`,
          variant: "destructive",
        });
        setStep("capture");
        return;
      }

      setScanStage("complete");
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("Scan API response:", JSON.stringify(data, null, 2));

      if (data.success && data.data) {
        // Backend returns extractedFields and aiSuggestions in one response
        const ocrFields =
          data.data.extractedFields || data.data.fields || data.data;
        const aiData = data.data.aiSuggestions;
        const preprocessing = data.data
          .preprocessing as PreprocessingData | null;
        console.log("OCR fields:", ocrFields);
        console.log("AI data:", aiData);
        console.log("Preprocessing:", preprocessing);

        // Store preprocessing data
        setPreprocessingData(preprocessing);

        // If we have a processed image, create a data URL for it
        let processedDataUrl: string | null = null;
        if (
          preprocessing?.processedImageData &&
          preprocessing?.processedMimeType
        ) {
          processedDataUrl = `data:${preprocessing.processedMimeType};base64,${preprocessing.processedImageData}`;
          console.log("Using processed image:", {
            transformations: preprocessing.transformations,
            originalSize: preprocessing.originalSize,
            processedSize: preprocessing.processedSize,
          });
        }

        // Mark scan as complete
        setScanStage("complete");

        // Parse URLs to separate LinkedIn from website
        const rawWebsite = ocrFields.website || "";
        const { website, linkedInUrl: parsedLinkedIn } = parseUrls(rawWebsite);
        const linkedInUrl = parsedLinkedIn || ocrFields.linkedInUrl || "";

        const extractedFields = {
          name: ocrFields.name || "",
          email: ocrFields.email || "",
          phone: ocrFields.phone || "",
          company: ocrFields.company || "",
          jobTitle: ocrFields.jobTitle || "",
          website: website,
          linkedInUrl: linkedInUrl,
          location: ocrFields.location || "",
        };

        // Clear previous scan data to free sessionStorage space
        [
          "scannedContact",
          "aiSuggestions",
          "deepSearchResult",
          "cardImageUrl",
          "contactSource",
          "enrichmentData",
          "preprocessingData",
        ].forEach((k) => {
          try {
            sessionStorage.removeItem(k);
          } catch {}
        });

        // Store scanned data in sessionStorage to pre-fill the contact form
        safeSessionSet(
          "scannedContact",
          JSON.stringify({
            fullName: extractedFields.name,
            email: extractedFields.email,
            phone: extractedFields.phone,
            company: extractedFields.company,
            jobTitle: extractedFields.jobTitle,
            website: extractedFields.website,
            linkedInUrl: extractedFields.linkedInUrl,
            location: extractedFields.location,
          }),
        );

        // Store AI suggestions if available
        if (aiData) {
          // Update extracted data with AI-found LinkedIn and location
          const finalLinkedIn =
            aiData.linkedInUrl || extractedFields.linkedInUrl || "";
          const finalLocation =
            aiData.location || extractedFields.location || "";

          if (finalLinkedIn) {
            setExtractedData((prev) => ({
              ...prev,
              linkedInUrl: finalLinkedIn,
            }));
          }
          if (finalLocation) {
            setExtractedData((prev) => ({ ...prev, location: finalLocation }));
          }

          // Update scannedContact with AI-found LinkedIn and location
          safeSessionSet(
            "scannedContact",
            JSON.stringify({
              fullName: extractedFields.name,
              email: extractedFields.email,
              phone: extractedFields.phone,
              company: extractedFields.company,
              jobTitle: extractedFields.jobTitle,
              website: extractedFields.website,
              linkedInUrl: finalLinkedIn,
              location: finalLocation,
            }),
          );

          safeSessionSet(
            "aiSuggestions",
            JSON.stringify({
              sectors: aiData.sectors || [],
              skills: aiData.skills || [],
              interests: aiData.interests || [],
              hobbies: aiData.hobbies || [],
              bio: aiData.bio || "",
              bioFull: aiData.bioFull || aiData.bio || "",
              linkedInUrl:
                aiData.linkedInUrl || extractedFields.linkedInUrl || "",
              location: aiData.location || extractedFields.location || "",
              selectedSectors: aiData.sectors?.slice(0, 3) || [],
            }),
          );

          // Store as deep search result for compatibility
          safeSessionSet(
            "deepSearchResult",
            JSON.stringify({
              name: extractedFields.name,
              company: extractedFields.company,
              jobTitle: extractedFields.jobTitle,
              bioFull: aiData.bioFull || aiData.bio || "",
              bio: aiData.bio,
              skills: aiData.skills || [],
              sectors: aiData.sectors || [],
              interests: aiData.interests || [],
              hobbies: aiData.hobbies || [],
              linkedInUrl: aiData.linkedInUrl || "",
              location: aiData.location || extractedFields.location || "",
              sources: [],
              confidence: aiData.confidence || "medium",
              searchEngine: "ai-analysis",
            }),
          );
        }

        // Store the card image - compress to avoid quota issues
        const cardImageToSave = processedDataUrl || imagePreview;
        if (cardImageToSave) {
          const compressed = await compressImageForStorage(cardImageToSave);
          if (compressed) safeSessionSet("cardImageUrl", compressed);
        }

        // Store preprocessing info
        if (preprocessing) {
          safeSessionSet("preprocessingData", JSON.stringify(preprocessing));
        }

        // Mark source as card scan
        safeSessionSet("contactSource", "CARD_SCAN");

        // Show success toast
        toast({
          title: t?.scan?.dataExtracted || "Data Extracted",
          description: aiData?.sectors?.length
            ? (
                t.scan?.aiSuggested ||
                "AI suggested {sectors} sectors and {skills} skills"
              )
                .replace("{sectors}", String(aiData.sectors.length))
                .replace("{skills}", String(aiData.skills?.length || 0))
            : t.scan?.reviewExtractedData || "Review the extracted data",
          variant: "success",
        });

        // Small delay to show completion state, then navigate directly to add contact
        await new Promise((resolve) => setTimeout(resolve, 800));
        router.push("/contacts/new");
      } else {
        throw new Error(data.error?.message || "Failed to extract data");
      }
    } catch (error: any) {
      console.error("OCR error:", error);
      const errMsg = error?.message || "Unknown error";
      const errStack = error?.stack?.split("\n").slice(0, 2).join(" ") || "";
      toast({
        title: t?.scan?.scanFailed || "Scan failed",
        description: `${errMsg.substring(0, 150)}${errStack ? " | " + errStack.substring(0, 100) : ""}`,
        variant: "error",
      });
      setStep("capture");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (!extractedData.name.trim()) {
      toast({
        title: t?.scan?.nameRequired || "Name required",
        description: t?.scan?.enterName || "Please enter the contact name",
        variant: "error",
      });
      return;
    }

    // Clear previous scan data first
    [
      "scannedContact",
      "aiSuggestions",
      "deepSearchResult",
      "cardImageUrl",
      "contactSource",
      "enrichmentData",
      "preprocessingData",
    ].forEach((k) => {
      try {
        sessionStorage.removeItem(k);
      } catch {}
    });

    // Store scanned data in sessionStorage to pre-fill the contact form
    safeSessionSet(
      "scannedContact",
      JSON.stringify({
        fullName: extractedData.name,
        email: extractedData.email,
        phone: extractedData.phone,
        company: extractedData.company,
        jobTitle: extractedData.jobTitle,
        website: extractedData.website,
        linkedInUrl: extractedData.linkedInUrl,
        location: extractedData.location,
      }),
    );

    // Store AI suggestions if available (now includes real data from deep search)
    if (aiSuggestions) {
      safeSessionSet(
        "aiSuggestions",
        JSON.stringify({
          ...aiSuggestions,
          selectedSectors: selectedSectors,
        }),
      );
    }

    // Store deep search results with experience, education, etc.
    if (deepSearchResult) {
      safeSessionSet("deepSearchResult", JSON.stringify(deepSearchResult));
    }

    // Store the PROCESSED card image - compress to avoid quota issues
    const cardImageToSave = processedImagePreview || imagePreview;
    if (cardImageToSave) {
      compressImageForStorage(cardImageToSave).then((compressed) => {
        if (compressed) safeSessionSet("cardImageUrl", compressed);
      });
    }

    // Store preprocessing info for reference
    if (preprocessingData) {
      safeSessionSet("preprocessingData", JSON.stringify(preprocessingData));
    }

    // Store source separately so the form knows it's from scan
    safeSessionSet("contactSource", "CARD_SCAN");

    toast({
      title: t?.scan?.dataExtracted || "Data Extracted",
      description: deepSearchResult
        ? (
            t.scan?.realProfileData ||
            "Real profile data found ({confidence} confidence)"
          ).replace("{confidence}", deepSearchResult.confidence)
        : t?.scan?.completeForm || "Complete the form to save the contact",
      variant: "success",
    });

    // Navigate to the contact form
    router.push("/contacts/new");
  };

  const toggleSector = (sector: string) => {
    if (selectedSectors.includes(sector)) {
      setSelectedSectors(selectedSectors.filter((s) => s !== sector));
    } else if (selectedSectors.length < 3) {
      setSelectedSectors([...selectedSectors, sector]);
    }
  };

  const resetScan = () => {
    setStep("capture");
    setImagePreview(null);
    setProcessedImagePreview(null);
    setPreprocessingData(null);
    setScanStage("ocr");
    setShowComparison(false);
    setCardImages([]); // Clear all card images
    setExtractedData({
      name: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      website: "",
      linkedInUrl: "",
      location: "",
    });
    setSelectedSectors([]);
    setAiSuggestions(null);
    setDeepSearchResult(null);
  };

  // Capture step
  if (step === "capture") {
    const frontImage = cardImages.find((img) => img.side === "front");
    const backImage = cardImages.find((img) => img.side === "back");

    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-th-text mb-2 text-center">
          {t.scan?.title || "Scan Business Card"}
        </h1>
        <p className="text-th-text-t text-center mb-6">
          {t.scan?.multiImageHint ||
            "Upload front and back of the card for complete data extraction"}
        </p>

        <div className="grid grid-rows-2 md:grid-cols-2 gap-4 mb-6">
          {/* Front of card */}
          <div className="relative">
            <p className="text-sm font-medium text-th-text-s mb-2 text-center">
              {t.scan?.frontOfCard || "Front"}
            </p>
            {frontImage ? (
              <div className="relative aspect-[1.6/1] rounded-xl overflow-hidden border-2 border-emerald-500/50 bg-th-surface">
                <img
                  src={frontImage.preview}
                  alt="Front of card"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeCardImage("front")}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <span className="text-sm">×</span>
                </button>
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-green-500/80 rounded text-[10px] text-white font-medium">
                  ✓ {t.scan?.ready || "Ready"}
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] text-white/80">
                  {formatFileSize(frontImage.file.size)}
                  {frontImage.dimensions
                    ? ` · ${frontImage.dimensions.width}×${frontImage.dimensions.height}`
                    : ""}
                </div>
              </div>
            ) : (
              <div className="w-full aspect-[1.6/1] border-2 border-dashed border-white/20 rounded-xl bg-th-surface flex items-center justify-center gap-4 px-4">
                <button
                  onClick={() => handleCameraCapture("front")}
                  className="block md:hidden flex-1 h-full flex flex-col items-center justify-center gap-2 hover:bg-emerald-500/10 rounded-lg transition-all"
                >
                  <Camera24Regular className="w-8 h-8 text-emerald-400" />
                  <span className="text-xs text-th-text-t">Take Photo</span>
                </button>
                <div className=" block md:hidden w-px h-12 bg-white/10" />
                <button
                  onClick={() => handleCapture("front")}
                  className="flex-1 h-full flex flex-col items-center justify-center gap-2 hover:bg-emerald-500/10 rounded-lg transition-all"
                >
                  <Image24Regular className="w-8 h-8 text-emerald-400" />
                  <span className="text-xs text-th-text-t">Upload Image</span>
                </button>
              </div>
            )}
          </div>

          {/* Back of card */}
          <div className="relative">
            <p className="text-sm font-medium text-th-text-s mb-2 text-center">
              {t.scan?.backOfCard || "Back"}{" "}
              <span className="text-th-text-m text-xs">
                ({t.scan?.optional || "Optional"})
              </span>
            </p>
            {backImage ? (
              <div className="relative aspect-[1.6/1] rounded-xl overflow-hidden border-2 border-blue-500/50 bg-th-surface">
                <img
                  src={backImage.preview}
                  alt="Back of card"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeCardImage("back")}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <span className="text-sm">×</span>
                </button>
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-green-500/80 rounded text-[10px] text-white font-medium">
                  ✓ {t.scan?.ready || "Ready"}
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] text-white/80">
                  {formatFileSize(backImage.file.size)}
                  {backImage.dimensions
                    ? ` · ${backImage.dimensions.width}×${backImage.dimensions.height}`
                    : ""}
                </div>
              </div>
            ) : (
              <div className="w-full aspect-[1.6/1] border-2 border-dashed border-white/20 rounded-xl bg-th-surface flex items-center justify-center gap-4 px-4">
                <button
                  onClick={() => handleCameraCapture("back")}
                  className="block md:hidden flex-1 h-full flex flex-col items-center justify-center gap-2 hover:bg-blue-500/10 rounded-lg transition-all"
                >
                  <Camera24Regular className="w-8 h-8 text-blue-400" />
                  <span className=" text-xs text-th-text-t">Take Photo</span>
                </button>
                <div className="block md:hidden w-px h-12 bg-white/10" />
                <button
                  onClick={() => handleCapture("back")}
                  className="flex-1 h-full flex flex-col items-center justify-center gap-2 hover:bg-blue-500/10 rounded-lg transition-all"
                >
                  <Image24Regular className="w-8 h-8 text-blue-400" />
                  <span className="text-xs text-th-text-t">Upload Image</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Format hint */}
        {cardImages.length === 0 && (
          <p className="text-xs text-th-text-m text-center mb-4">
            JPEG, PNG, WebP · Max 10MB per image
          </p>
        )}

        {/* Scan button */}
        {cardImages.length > 0 && (
          <button
            onClick={processAllImages}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 flex items-center justify-center gap-2"
          >
            <Sparkle24Regular className="w-5 h-5" />
            {t.scan?.scanNow || "Scan"}{" "}
            {cardImages.length > 1
              ? `(${cardImages.length} ${t.scan?.images || "images"})`
              : ""}
          </button>
        )}

        {/* Hidden file inputs - gallery (no capture attribute) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onClick={(e) => {
            (e.target as HTMLInputElement).value = "";
          }}
          onChange={(e) => handleFileChange(e, "front")}
          className="hidden"
        />
        <input
          ref={backFileInputRef}
          type="file"
          accept="image/*"
          onClick={(e) => {
            (e.target as HTMLInputElement).value = "";
          }}
          onChange={(e) => handleFileChange(e, "back")}
          className="hidden"
        />
        {/* Hidden file inputs - camera only */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onClick={(e) => {
            (e.target as HTMLInputElement).value = "";
          }}
          onChange={(e) => handleFileChange(e, "front")}
          className="hidden"
        />
        <input
          ref={backCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onClick={(e) => {
            (e.target as HTMLInputElement).value = "";
          }}
          onChange={(e) => handleFileChange(e, "back")}
          className="hidden"
        />

        <p className="text-sm text-th-text-m text-center mt-6">
          {t.scan?.positionTip ||
            "Position the card clearly in frame for best results"}
        </p>
        <p className="text-xs text-th-text-m text-center mt-2">
          {t.scan?.uploadLimit ||
            "Supported: JPEG, PNG, WebP. Max 10MB per image."}
        </p>
      </div>
    );
  }

  // Processing step
  if (step === "processing") {
    const stages = [
      {
        id: "ocr",
        label: t.scan?.scanningCard || "Scanning Card",
        icon: DocumentSearch24Regular,
        color: "from-blue-500 to-cyan-500",
      },
      {
        id: "gpt",
        label: t.scan?.extractingDetails || "Extracting Details",
        icon: Sparkle24Regular,
        color: "from-emerald-500 to-teal-500",
      },
      {
        id: "web_search",
        label: t.scan?.searchingWeb || "Searching Web",
        icon: Sparkle24Regular,
        color: "from-emerald-500 to-blue-500",
      },
      {
        id: "linkedin",
        label: t.scan?.linkedInProfile || "LinkedIn Profile",
        icon: Sparkle24Regular,
        color: "from-blue-600 to-blue-400",
      },
      {
        id: "wikipedia",
        label: t.scan?.wikipedia || "Wikipedia",
        icon: Sparkle24Regular,
        color: "from-gray-500 to-gray-400",
      },
      {
        id: "analysis",
        label: t.scan?.analyzingResults || "Analyzing Results",
        icon: Sparkle24Regular,
        color: "from-yellow-500 to-cyan-500",
      },
      {
        id: "complete",
        label: t.scan?.complete || "Complete",
        icon: Checkmark24Regular,
        color: "from-green-500 to-emerald-500",
      },
    ];

    const currentStageIndex = stages.findIndex((s) => s.id === scanStage);
    const currentStageData = stages[currentStageIndex] || stages[0];
    const StageIcon = currentStageData.icon;

    return (
      <div className="animate-fade-in py-8">
        {/* Card preview with scanning effect */}
        {imagePreview && (
          <div className="relative mb-8">
            <div className="relative mx-auto" style={{ maxWidth: "240px" }}>
              <img
                src={imagePreview}
                alt="Scanned card"
                className="w-full h-auto max-h-48 object-contain rounded-xl"
              />
              {/* Scanning overlay */}
              <div className="absolute inset-0 border-4 border-emerald-500/50 rounded-xl" />
              <div
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 shadow-[0_0_20px_rgba(168,85,247,0.8)]"
                style={{ animation: "scanLine 1.5s ease-in-out infinite" }}
              />
            </div>
          </div>
        )}

        {/* Cycling spinner */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* Outer glow */}
            <div
              className={`absolute inset-0 bg-gradient-to-r ${currentStageData.color} rounded-full blur-xl opacity-40 animate-pulse`}
            />

            {/* Spinning ring */}
            <div className="relative w-20 h-20">
              <svg
                className="w-20 h-20 animate-spin"
                style={{ animationDuration: "2s" }}
                viewBox="0 0 80 80"
              >
                <defs>
                  <linearGradient
                    id="spinnerGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  fill="none"
                  stroke="url(#spinnerGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="180 999"
                />
              </svg>

              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`p-3 rounded-full bg-gradient-to-r ${currentStageData.color}`}
                >
                  <StageIcon className="w-6 h-6 text-th-text" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current stage text */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-th-text mb-2">
            {currentStageData.label}
          </h2>
          <p className="text-th-text-t text-sm">
            {progressMessage || (
              <>
                {scanStage === "ocr" &&
                  (t.scan?.scanningBusinessCard ||
                    "Scanning your business card...")}
                {scanStage === "gpt" &&
                  (t.scan?.usingAiExtract ||
                    "Using AI to extract contact details...")}
                {scanStage === "web_search" &&
                  (t.scan?.searchingGoogleInfo ||
                    "Searching Google for more information...")}
                {scanStage === "linkedin" &&
                  (t.scan?.foundLinkedIn ||
                    "Found LinkedIn profile! Extracting data...")}
                {scanStage === "wikipedia" &&
                  (t.scan?.foundWikipedia ||
                    "Found Wikipedia page! Getting details...")}
                {scanStage === "analysis" &&
                  (t.scan?.analyzingCombining ||
                    "Analyzing and combining all results...")}
                {scanStage === "complete" &&
                  (t.scan?.almostDone || "Almost done!")}
              </>
            )}
          </p>
        </div>

        {/* Stage indicators */}
        <div className="flex justify-center gap-2">
          {stages.slice(0, 5).map((stage, index) => (
            <div
              key={stage.id}
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                index < currentStageIndex
                  ? "bg-green-500"
                  : index === currentStageIndex
                    ? "bg-emerald-500 scale-125"
                    : "bg-th-surface-h"
              }`}
            />
          ))}
        </div>

        {/* Keyframes */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @keyframes scanLine {
              0%, 100% { top: 5%; }
              50% { top: 90%; }
            }
          `,
          }}
        />
      </div>
    );
  }

  // Confirm step
  if (step === "confirm") {
    const formFields = [
      { label: `${t?.scan?.name || "Name"} *`, key: "name", type: "text" },
      { label: t?.scan?.email || "Email", key: "email", type: "email" },
      { label: t?.scan?.phone || "Phone", key: "phone", type: "tel" },
      { label: t?.scan?.company || "Company", key: "company", type: "text" },
      {
        label: t?.scan?.jobTitle || "Job Title",
        key: "jobTitle",
        type: "text",
      },
      { label: t?.scan?.website || "Website", key: "website", type: "url" },
      { label: "LinkedIn", key: "linkedInUrl", type: "url" },
    ];

    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={resetScan}
            className="p-2 hover:bg-th-surface-h rounded-lg transition-colors"
          >
            <ArrowLeft24Regular className="w-5 h-5 text-th-text-t" />
          </button>
          <h1 className="text-2xl font-bold text-th-text">
            {t?.scan?.confirmDetails || "Confirm Details"}
          </h1>
        </div>

        {/* Card image with comparison toggle */}
        {(processedImagePreview || imagePreview) && (
          <div className="mb-6">
            {/* Comparison toggle */}
            {processedImagePreview && imagePreview && (
              <div className="flex justify-center mb-3">
                <button
                  onClick={() => setShowComparison(!showComparison)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-th-surface hover:bg-th-surface-h border border-th-border rounded-full text-xs text-th-text-s transition-all"
                >
                  <ImageEdit24Regular className="w-4 h-4" />
                  {showComparison
                    ? t?.scan?.hideOriginal || "Hide original"
                    : t?.scan?.compareWithOriginal || "Compare with original"}
                </button>
              </div>
            )}

            {showComparison ? (
              /* Side by side comparison */
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-th-text-m text-center mb-1">
                    {t?.scan?.original || "Original"}
                  </p>
                  <img
                    src={imagePreview || undefined}
                    alt="Original card"
                    className="w-full h-32 object-contain rounded-xl bg-th-surface border border-th-border"
                  />
                </div>
                <div>
                  <p className="text-xs text-green-400 text-center mb-1">
                    {t?.scan?.enhanced || "Enhanced"}
                  </p>
                  <img
                    src={processedImagePreview || imagePreview || undefined}
                    alt="Processed card"
                    className="w-full h-32 object-contain rounded-xl bg-th-surface border border-green-500/30"
                  />
                </div>
              </div>
            ) : (
              /* Show processed image (or original if no processed) */
              <div className="relative">
                <img
                  src={processedImagePreview || imagePreview || undefined}
                  alt="Scanned card"
                  className="w-full h-40 object-contain rounded-xl bg-th-surface border border-th-border"
                />
                {processedImagePreview && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Checkmark24Regular className="w-3 h-3" />
                      {t?.scan?.enhanced || "Enhanced"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Preprocessing stats */}
            {preprocessingData?.applied && (
              <div className="flex justify-center gap-4 mt-3 text-xs text-th-text-m">
                {preprocessingData.cardConfidence !== undefined && (
                  <span>
                    Card: {Math.round(preprocessingData.cardConfidence * 100)}%
                  </span>
                )}
                {preprocessingData.qualityScore !== undefined && (
                  <span>
                    Quality: {Math.round(preprocessingData.qualityScore * 100)}%
                  </span>
                )}
                {preprocessingData.processingTimeMs !== undefined && (
                  <span>{preprocessingData.processingTimeMs}ms</span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-5 mb-6 space-y-4">
          {formFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-th-text-s mb-2">
                {field.label}
              </label>
              <input
                type={field.type}
                value={extractedData[field.key as keyof ExtractedData]}
                onChange={(e) =>
                  setExtractedData({
                    ...extractedData,
                    [field.key]: e.target.value,
                  })
                }
                className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                placeholder={
                  field.key === "linkedInUrl" ? "linkedin.com/in/..." : ""
                }
              />
            </div>
          ))}
        </div>

        {/* Deep Search Results - Real Data from Web */}
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-th-text flex items-center gap-2">
              <Sparkle24Regular className="w-4 h-4 text-emerald-400" />
              {deepSearchResult
                ? t?.scan?.profileDataFromWeb || "Profile Data (from Web)"
                : t?.scan?.suggestedSectors || "Suggested Sectors"}
            </h3>
            {isDeepSearching && (
              <div className="flex items-center gap-2 text-xs text-emerald-300">
                <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                {t?.scan?.searchingWebDots || "Searching web..."}
              </div>
            )}
            {deepSearchResult && !isDeepSearching && (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  deepSearchResult.confidence === "high"
                    ? "bg-green-500/20 text-green-300"
                    : deepSearchResult.confidence === "medium"
                      ? "bg-yellow-500/20 text-yellow-300"
                      : "bg-white/[0.03]0/20 text-th-text-s"
                }`}
              >
                {deepSearchResult.confidence === "high"
                  ? t?.scan?.highConfidence || "high confidence"
                  : deepSearchResult.confidence === "medium"
                    ? t?.scan?.mediumConfidence || "medium confidence"
                    : t?.scan?.lowConfidence || "low confidence"}
              </span>
            )}
          </div>

          {/* Deep search bio */}
          {deepSearchResult?.bio && (
            <div className="mb-4 p-3 bg-th-surface rounded-lg">
              <p className="text-xs text-th-text-t mb-1">
                {t?.scan?.bio || "Bio"}:
              </p>
              <p className="text-sm text-neutral-200">{deepSearchResult.bio}</p>
            </div>
          )}

          {/* Sectors */}
          <div className="mb-4">
            <p className="text-xs text-th-text-t mb-2">
              {t?.scan?.sectors || "Sectors"}:
            </p>
            {aiSuggestions?.sectors && aiSuggestions.sectors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {aiSuggestions.sectors.map((sector) => (
                  <button
                    key={sector}
                    onClick={() => toggleSector(sector)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      selectedSectors.includes(sector)
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                        : "bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h"
                    }`}
                  >
                    {sector}
                  </button>
                ))}
              </div>
            ) : !isDeepSearching && !isLoadingAI ? (
              <p className="text-sm text-th-text-m">
                {t?.scan?.noSectorsFound || "No sectors found"}
              </p>
            ) : null}
          </div>

          {/* Skills */}
          {aiSuggestions?.skills && aiSuggestions.skills.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-th-text-t mb-2">
                {t?.scan?.skills || "Skills"}:
              </p>
              <div className="flex flex-wrap gap-1">
                {aiSuggestions.skills.slice(0, 8).map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs"
                  >
                    {skill}
                  </span>
                ))}
                {aiSuggestions.skills.length > 8 && (
                  <span className="px-2 py-1 text-th-text-m text-xs">
                    +{aiSuggestions.skills.length - 8} {t?.scan?.more || "more"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Interests */}
          {aiSuggestions?.interests && aiSuggestions.interests.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-th-text-t mb-2">
                {t?.scan?.interests || "Interests"}:
              </p>
              <div className="flex flex-wrap gap-1">
                {aiSuggestions.interests.slice(0, 8).map((interest) => (
                  <span
                    key={interest}
                    className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Experience from deep search */}
          {deepSearchResult?.experience &&
            deepSearchResult.experience.length > 0 && (
              <div className="mt-4 pt-4 border-t border-th-border">
                <p className="text-xs text-th-text-t mb-2">
                  {t?.scan?.experience || "Experience"}:
                </p>
                <div className="space-y-2">
                  {deepSearchResult.experience.slice(0, 3).map((exp, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-th-text font-medium">
                        {exp.title}
                      </span>
                      <span className="text-th-text-t">
                        {" "}
                        {t?.scan?.at || "at"}{" "}
                      </span>
                      <span className="text-th-text-s">{exp.company}</span>
                      {exp.period && (
                        <span className="text-th-text-m text-xs ml-2">
                          ({exp.period})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Education from deep search */}
          {deepSearchResult?.education &&
            deepSearchResult.education.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-th-text-t mb-2">
                  {t?.scan?.education || "Education"}:
                </p>
                <div className="space-y-1">
                  {deepSearchResult.education.slice(0, 2).map((edu, i) => (
                    <div key={i} className="text-sm text-th-text-s">
                      {edu.degree && <span>{edu.degree} - </span>}
                      <span>{edu.institution}</span>
                      {edu.year && (
                        <span className="text-th-text-m text-xs ml-2">
                          ({edu.year})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Sources from deep search */}
          {deepSearchResult?.sources && deepSearchResult.sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-th-border">
              <p className="text-xs text-th-text-m">
                {t?.scan?.sources || "Sources"}:{" "}
                {deepSearchResult.sources.length}{" "}
                {t?.scan?.webResultsFrom || "web results from"}{" "}
                {deepSearchResult.searchEngine}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={resetScan}
            className="flex-1 px-6 py-3 rounded-xl border border-th-border text-th-text-s hover:bg-th-surface transition-all"
          >
            {t?.scan?.rescan || "Rescan"}
          </button>
          <button onClick={handleConfirm} className="relative flex-1 group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
            <span className="relative flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
              {t?.scan?.saveContact || "Save Contact"}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Enriching step
  if (step === "enriching") {
    return (
      <div className="animate-fade-in text-center py-12">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full blur-lg opacity-50" />
            <div className="relative animate-spin h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-th-text">
          {t?.scan?.savingContact || "Saving Contact..."}
        </h2>
        <p className="text-th-text-t mt-2 flex items-center justify-center gap-2">
          <Sparkle24Regular className="w-4 h-4 text-emerald-400" />
          {t?.scan?.enrichingProfile || "Enriching profile with AI"}
        </p>
      </div>
    );
  }

  // Complete step
  if (step === "complete") {
    return (
      <div className="animate-fade-in text-center py-12">
        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur-lg opacity-50" />
          <div className="relative w-full h-full rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <Checkmark24Regular className="w-10 h-10 text-th-text" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-th-text">
          {t?.scan?.contactAdded || "Contact Added!"}
        </h2>
        <p className="text-th-text-t mt-2">
          {extractedData.name}{" "}
          {t?.scan?.nowInNetwork || "is now in your network"}
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => router.push("/contacts")}
            className="relative w-full group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
            <span className="relative flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
              {t?.scan?.viewContacts || "View Contacts"}
            </span>
          </button>
          <button
            onClick={resetScan}
            className="w-full px-6 py-3 rounded-xl border border-th-border text-th-text-s hover:bg-th-surface transition-all"
          >
            {t?.scan?.scanAnother || "Scan Another Card"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
