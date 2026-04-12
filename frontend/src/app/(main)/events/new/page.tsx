/**
 * Create Event Page
 *
 * Form to create a new networking event with thumbnail, welcome message, and map.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  ArrowLeft24Regular,
  CalendarLtr24Regular,
  Location24Regular,
  TextDescription24Regular,
  Save24Regular,
  Image24Regular,
  Dismiss24Regular,
  Chat24Regular,
  Map24Regular,
} from '@fluentui/react-icons';
import { createEvent, uploadEventThumbnail } from '@/lib/api/events';
import { toast } from '@/components/ui/Toast';
import Link from 'next/link';

export default function CreateEventPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dateTime: '',
    location: '',
    welcomeMessage: '',
    locationLat: null as number | null,
    locationLng: null as number | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  // Load Google Maps script
  useEffect(() => {
    if (showMapPicker && !mapLoaded && typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&libraries=places`;
      script.async = true;
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
    }
  }, [showMapPicker, mapLoaded]);

  // Initialize map when loaded
  useEffect(() => {
    if (mapLoaded && showMapPicker && mapRef.current && !mapInstanceRef.current) {
      const defaultCenter = { lat: 25.2048, lng: 55.2708 }; // Dubai
      const center = formData.locationLat && formData.locationLng
        ? { lat: formData.locationLat, lng: formData.locationLng }
        : defaultCenter;

      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom: 13,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
        ],
      });

      const marker = new google.maps.Marker({
        position: center,
        map,
        draggable: true,
      });

      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        if (position) {
          setFormData((prev) => ({
            ...prev,
            locationLat: position.lat(),
            locationLng: position.lng(),
          }));
        }
      });

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          marker.setPosition(e.latLng);
          setFormData((prev) => ({
            ...prev,
            locationLat: e.latLng!.lat(),
            locationLng: e.latLng!.lng(),
          }));
        }
      });

      // Search box
      const searchInput = document.getElementById('map-search') as HTMLInputElement;
      if (searchInput) {
        const searchBox = new google.maps.places.SearchBox(searchInput);
        searchBox.addListener('places_changed', () => {
          const places = searchBox.getPlaces();
          if (places && places.length > 0) {
            const place = places[0];
            if (place.geometry?.location) {
              map.setCenter(place.geometry.location);
              marker.setPosition(place.geometry.location);
              setFormData((prev) => ({
                ...prev,
                locationLat: place.geometry!.location!.lat(),
                locationLng: place.geometry!.location!.lng(),
                location: place.formatted_address || place.name || prev.location,
              }));
            }
          }
        });
      }

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }
  }, [mapLoaded, showMapPicker, formData.locationLat, formData.locationLng]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrors((prev) => ({ ...prev, thumbnail: 'Please upload an image file' }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, thumbnail: 'File size must be less than 5MB' }));
        return;
      }
      setThumbnailFile(file);
      setErrors((prev) => ({ ...prev, thumbnail: '' }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    const input = document.getElementById('thumbnail') as HTMLInputElement;
    if (input) input.value = '';
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Event name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Event name must be at least 3 characters';
    }

    if (!formData.dateTime) {
      newErrors.dateTime = 'Date and time is required';
    } else {
      const eventDate = new Date(formData.dateTime);
      if (eventDate < new Date()) {
        newErrors.dateTime = 'Event date must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      const { event } = await createEvent({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        dateTime: new Date(formData.dateTime).toISOString(),
        location: formData.location.trim() || undefined,
        locationLat: formData.locationLat || undefined,
        locationLng: formData.locationLng || undefined,
        welcomeMessage: formData.welcomeMessage.trim() || undefined,
      });

      // Upload thumbnail if provided
      if (thumbnailFile) {
        try {
          await uploadEventThumbnail(event.id, thumbnailFile);
        } catch (err) {
          console.error('Failed to upload thumbnail:', err);
          // Continue anyway, event was created
        }
      }

      toast({ title: 'Event created!', description: 'Your QR code is ready to share', variant: 'success' });
      router.push(`/events/${event.id}`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Get min datetime for input (current time)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-th-bg via-th-bg-s to-th-bg p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/events"
            className="p-2 rounded-lg text-th-text-t hover:text-th-text hover:bg-th-surface-h transition-all"
          >
            <ArrowLeft24Regular className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-th-text">Create Event</h1>
            <p className="text-th-text-t mt-1">Set up a networking event with QR check-in</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-6 space-y-5">
            {/* Event Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-th-text mb-2">
                Event Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Tech Networking Meetup"
                  className={`w-full px-4 py-3 bg-th-surface border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    errors.name ? 'border-red-500' : 'border-th-border'
                  }`}
                  maxLength={255}
                />
              </div>
              {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
            </div>

            {/* Date & Time */}
            <div>
              <label htmlFor="dateTime" className="block text-sm font-medium text-th-text mb-2">
                <CalendarLtr24Regular className="w-4 h-4 inline mr-1" />
                Date & Time <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                id="dateTime"
                name="dateTime"
                value={formData.dateTime}
                onChange={handleChange}
                min={getMinDateTime()}
                className={`w-full px-4 py-3 bg-th-surface border rounded-lg text-th-text focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.dateTime ? 'border-red-500' : 'border-th-border'
                }`}
              />
              {errors.dateTime && <p className="mt-1 text-sm text-red-400">{errors.dateTime}</p>}
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-th-text mb-2">
                <Location24Regular className="w-4 h-4 inline mr-1" />
                Location <span className="text-th-text-m">(optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., Conference Room A, 123 Main St"
                  className="flex-1 px-4 py-3 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  maxLength={500}
                />
                <button
                  type="button"
                  onClick={() => setShowMapPicker(!showMapPicker)}
                  className={`px-4 py-3 rounded-lg border transition-all ${
                    showMapPicker
                      ? 'bg-emerald-600 border-emerald-500 text-th-text'
                      : 'bg-th-surface border-th-border text-th-text-t hover:text-th-text hover:bg-th-surface-h'
                  }`}
                  title="Pick location on map"
                >
                  <Map24Regular className="w-5 h-5" />
                </button>
              </div>
              {formData.locationLat && formData.locationLng && (
                <p className="mt-1 text-xs text-emerald-400">
                  Map location set ({formData.locationLat.toFixed(4)}, {formData.locationLng.toFixed(4)})
                </p>
              )}
            </div>

            {/* Map Picker */}
            {showMapPicker && (
              <div className="space-y-2">
                <input
                  type="text"
                  id="map-search"
                  placeholder="Search for a location..."
                  className="w-full px-4 py-2 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div
                  ref={mapRef}
                  className="w-full h-64 rounded-lg overflow-hidden border border-th-border"
                />
                <p className="text-xs text-th-text-m">Click on the map or drag the marker to set location</p>
              </div>
            )}

            {/* Thumbnail Upload */}
            <div>
              <label htmlFor="thumbnail" className="block text-sm font-medium text-th-text mb-2">
                <Image24Regular className="w-4 h-4 inline mr-1" />
                Event Thumbnail <span className="text-th-text-m">(optional)</span>
              </label>
              <p className="text-xs text-th-text-m mb-2">
                Recommended: 1200x630px for best display on social media (WhatsApp, Facebook, Twitter)
              </p>
              {thumbnailPreview ? (
                <div className="relative">
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    className="w-full h-48 object-cover rounded-lg border border-th-border"
                  />
                  <button
                    type="button"
                    onClick={clearThumbnail}
                    className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white hover:bg-red-600"
                  >
                    <Dismiss24Regular className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 bg-th-surface border border-dashed border-white/20 rounded-lg cursor-pointer hover:bg-th-surface-h transition-all">
                  <Image24Regular className="w-8 h-8 text-th-text-m mb-2" />
                  <span className="text-sm text-th-text-m">Click to upload thumbnail</span>
                  <span className="text-xs text-white/70 mt-1">PNG, JPG, WebP up to 5MB</span>
                  <input
                    type="file"
                    id="thumbnail"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    className="hidden"
                  />
                </label>
              )}
              {errors.thumbnail && <p className="mt-1 text-sm text-red-400">{errors.thumbnail}</p>}
            </div>

            {/* Welcome Message */}
            <div>
              <label htmlFor="welcomeMessage" className="block text-sm font-medium text-th-text mb-2">
                <Chat24Regular className="w-4 h-4 inline mr-1" />
                Welcome Message <span className="text-th-text-m">(optional)</span>
              </label>
              <p className="text-xs text-th-text-m mb-2">
                This message will appear when sharing the event link on WhatsApp, social media, etc.
              </p>
              <textarea
                id="welcomeMessage"
                name="welcomeMessage"
                value={formData.welcomeMessage}
                onChange={handleChange}
                placeholder="e.g., Join us for an exciting networking event! Connect with industry professionals and expand your network."
                rows={3}
                className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                maxLength={500}
              />
              <p className="mt-1 text-xs text-th-text-m">{formData.welcomeMessage.length}/500</p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-th-text mb-2">
                <TextDescription24Regular className="w-4 h-4 inline mr-1" />
                Description <span className="text-th-text-m">(optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="What's this event about? Who should attend?"
                rows={4}
                className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-lg text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                maxLength={5000}
              />
              <p className="mt-1 text-xs text-th-text-m">{formData.description.length}/5000</p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <Link
              href="/events"
              className="flex-1 px-6 py-3 text-center border border-th-border text-th-text rounded-lg font-medium hover:bg-th-surface transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-lg font-medium transition-all"
            >
              {loading ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <Save24Regular className="w-5 h-5" />
              )}
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <h3 className="font-medium text-th-text mb-2">What happens next?</h3>
          <ul className="text-sm text-th-text-s space-y-1">
            <li>1. A unique QR code will be generated for your event</li>
            <li>2. Share the QR code or link with your guests</li>
            <li>3. Guests scan and fill out a short form to join</li>
            <li>4. Attendees get matched based on what they&apos;re looking for</li>
          </ul>
        </div>

        {/* Social Sharing Preview */}
        {(thumbnailPreview || formData.welcomeMessage) && (
          <div className="mt-4 p-4 bg-th-surface border border-th-border rounded-xl">
            <h3 className="font-medium text-th-text mb-3">Social Share Preview</h3>
            <div className="bg-th-bg-t rounded-lg overflow-hidden">
              {thumbnailPreview && (
                <img
                  src={thumbnailPreview}
                  alt="Preview"
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-3">
                <p className="text-th-text font-medium">{formData.name || 'Event Name'}</p>
                <p className="text-th-text-t text-sm mt-1">
                  {formData.welcomeMessage || formData.description || 'Event description will appear here'}
                </p>
              </div>
            </div>
            <p className="text-xs text-th-text-m mt-2">
              This is how your event will appear when shared on WhatsApp, Facebook, etc.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
