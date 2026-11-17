import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  CalendarPlus,
  Compass,
  Crosshair,
  Footprints,
  Car,
  TrainFront,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { CalendarEventItem, EventCalmSession } from '../types/sanctuary';
import { createId } from '../lib/storage';
import { getTodayStr } from '../lib/dateUtils';

interface MapsViewProps {
  initialDestinationQuery?: string;
  onSaveEventSession: (session: EventCalmSession) => Promise<void>;
  onSaveCalendarEvent: (ev: CalendarEventItem) => Promise<void>;
  onNavigateToEventCalm: () => void;
  onNavigateToCalendar: () => void;
}

interface SelectedPlaceInfo {
  id: string;
  name: string;
  address: string;
  location: google.maps.LatLngLiteral;
  viewport?: google.maps.LatLngBounds | null;
  rating?: number | null;
  isOpenText?: string;
}

type TravelModeOption = 'DRIVING' | 'WALKING' | 'TRANSIT';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function isQuotaError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : JSON.stringify(err || '');
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('QuotaExceeded') ||
    msg.includes('OverQuota') ||
    msg.includes('429')
  );
}

function notifyQuotaExceededIfNeeded(err: unknown) {
  if (isQuotaError(err)) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

function useAutocompleteSuggestions(inputString: string) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!placesLib) return;

    const trimmed = inputString.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearchError(null);
      setIsLoading(false);
      return;
    }

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let cancelled = false;
    setIsLoading(true);
    setSearchError(null);

    const timer = window.setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: trimmed,
        sessionToken: sessionTokenRef.current ?? undefined,
      })
        .then((res: { suggestions: google.maps.places.AutocompleteSuggestion[] }) => {
          if (cancelled) return;
          setSuggestions(res.suggestions ?? []);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          notifyQuotaExceededIfNeeded(err);
          setSuggestions([]);
          setIsLoading(false);
          setSearchError(
            err instanceof Error ? err.message : 'Unable to fetch place suggestions.'
          );
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, inputString]);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
  }, []);

  return { suggestions, isLoading, searchError, resetSession };
}

interface PlaceSearchInputProps {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onPlaceSelected: (place: SelectedPlaceInfo) => void;
  icon: React.ReactNode;
}

const PlaceSearchInput: React.FC<PlaceSearchInputProps> = ({
  placeholder,
  value,
  onChange,
  onPlaceSelected,
  icon,
}) => {
  const placesLib = useMapsLibrary('places');
  const { suggestions, isLoading, searchError, resetSession } = useAutocompleteSuggestions(value);
  const [openDropdown, setOpenDropdown] = useState(false);

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'viewport',
          'rating',
          'regularOpeningHours',
        ],
      });

      const loc = place.location;
      if (!loc) return;

      const latLng: google.maps.LatLngLiteral = {
        lat: typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat),
        lng: typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng),
      };

      const name = place.displayName || suggestion.placePrediction.text?.text || 'Selected Place';
      const address = place.formattedAddress || suggestion.placePrediction.text?.text || '';

      onChange(name);
      setOpenDropdown(false);
      resetSession();

      let isOpenText: string | undefined;
      try {
        const weekdayDescriptions = place.regularOpeningHours?.weekdayDescriptions;
        if (weekdayDescriptions && weekdayDescriptions.length > 0) {
          const todayIdx = (new Date().getDay() + 6) % 7;
          isOpenText = weekdayDescriptions[todayIdx] || weekdayDescriptions[0];
        }
      } catch {
        // Optional hours metadata
      }

      onPlaceSelected({
        id: place.id || createId('place'),
        name,
        address,
        location: latLng,
        viewport: place.viewport ?? null,
        rating: place.rating ?? null,
        isOpenText,
      });
    } catch (err) {
      notifyQuotaExceededIfNeeded(err);
    }
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <span className="absolute left-3.5 text-[#98A2B3] pointer-events-none">{icon}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpenDropdown(true);
          }}
          onFocus={() => setOpenDropdown(true)}
          placeholder={placeholder}
          className="w-full min-h-[44px] pl-10 pr-9 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6] placeholder-[#98A2B3]/70 focus:outline-none focus:border-[#9BC4E2]/50"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              resetSession();
            }}
            aria-label="Clear search"
            className="absolute right-2.5 w-7 h-7 rounded-xl text-[#98A2B3] hover:text-[#F1F3F6] flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {openDropdown && (suggestions.length > 0 || isLoading || searchError) && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-2xl bg-[#1D212A] border border-white/[0.1] shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {isLoading && (
            <p className="px-4 py-3 text-xs text-[#98A2B3]">Searching places...</p>
          )}
          {searchError && (
            <p className="px-4 py-3 text-xs text-[#F2B8A2]">{searchError}</p>
          )}
          {suggestions.map((suggestion, idx) => {
            const label = suggestion.placePrediction?.text?.text;
            if (!label) return null;
            return (
              <button
                key={suggestion.placePrediction?.placeId || idx}
                type="button"
                onClick={() => void handleSelectSuggestion(suggestion)}
                className="w-full text-left px-4 py-3 text-xs text-[#F1F3F6] hover:bg-white/[0.06] border-b border-white/[0.04] last:border-none flex items-start gap-2.5 min-h-[44px]"
              >
                <MapPin className="w-3.5 h-3.5 text-[#9BC4E2] shrink-0 mt-0.5" />
                <span className="leading-relaxed">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface RouteOverlayProps {
  origin: google.maps.LatLngLiteral | string | null;
  destination: google.maps.LatLngLiteral | string | null;
  travelMode: TravelModeOption;
  onRouteSummary: (
    summary: { distanceMeters: number; durationMillis: number } | null,
    errorMsg: string | null
  ) => void;
}

const RouteOverlay: React.FC<RouteOverlayProps> = ({
  origin,
  destination,
  travelMode,
  onRouteSummary,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!routesLib || !map || !origin || !destination) {
      onRouteSummary(null, null);
      return;
    }

    let cancelled = false;

    const request = {
      origin,
      destination,
      travelMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
    };

    const RouteClass = routesLib.Route as unknown as {
      computeRoutes: (req: typeof request) => Promise<{
        routes?: Array<{
          distanceMeters?: number;
          durationMillis?: number;
          viewport?: google.maps.LatLngBounds;
          createPolylines: () => google.maps.Polyline[];
        }>;
      }>;
    };

    RouteClass.computeRoutes(request)
      .then((res) => {
        if (cancelled) return;
        const routes = res?.routes;
        if (!routes || routes.length === 0) {
          onRouteSummary(null, 'No route found between those points for this mode.');
          return;
        }

        const primaryRoute = routes[0];
        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: '#9BC4E2',
            strokeOpacity: 0.9,
            strokeWeight: 5,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        onRouteSummary(
          {
            distanceMeters: primaryRoute.distanceMeters ?? 0,
            durationMillis: primaryRoute.durationMillis ?? 0,
          },
          null
        );
      })
      .catch((err) => {
        if (cancelled) return;
        notifyQuotaExceededIfNeeded(err);
        onRouteSummary(
          null,
          err instanceof Error ? err.message : 'Unable to calculate route right now.'
        );
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin, destination, travelMode, onRouteSummary]);

  return null;
};

interface MapWorkspaceProps {
  initialDestinationQuery?: string;
  onSaveEventSession: (session: EventCalmSession) => Promise<void>;
  onSaveCalendarEvent: (ev: CalendarEventItem) => Promise<void>;
  onNavigateToEventCalm: () => void;
  onNavigateToCalendar: () => void;
}

const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  initialDestinationQuery,
  onSaveEventSession,
  onSaveCalendarEvent,
  onNavigateToEventCalm,
  onNavigateToCalendar,
}) => {
  const map = useMap();
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState(initialDestinationQuery || '');

  const [originPlace, setOriginPlace] = useState<SelectedPlaceInfo | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<SelectedPlaceInfo | null>(null);
  const [currentUserCoords, setCurrentUserCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const [travelMode, setTravelMode] = useState<TravelModeOption>('DRIVING');
  const [routeSummary, setRouteSummary] = useState<{
    distanceMeters: number;
    durationMillis: number;
  } | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [destMarkerRef, destMarker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (initialDestinationQuery) {
      setDestinationQuery(initialDestinationQuery);
    }
  }, [initialDestinationQuery]);

  const handleSelectDestination = (place: SelectedPlaceInfo) => {
    setDestinationPlace(place);
    setInfoOpen(true);
    setSavedFeedback(null);
    if (map) {
      if (place.viewport) {
        map.fitBounds(place.viewport);
      } else {
        map.panTo(place.location);
        map.setZoom(15);
      }
    }
  };

  const handleSelectOrigin = (place: SelectedPlaceInfo) => {
    setOriginPlace(place);
    setCurrentUserCoords(null);
  };

  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('Geolocation is not supported in this browser.');
      return;
    }
    setGeoStatus('Locating...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCurrentUserCoords(coords);
        setOriginPlace(null);
        setOriginQuery('My Current Location');
        setGeoStatus(null);
        if (map && !destinationPlace) {
          map.panTo(coords);
          map.setZoom(14);
        }
      },
      (err) => {
        setGeoStatus(err.message || 'Location permission declined.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleRouteSummary = useCallback(
    (
      summary: { distanceMeters: number; durationMillis: number } | null,
      errorMsg: string | null
    ) => {
      setRouteSummary(summary);
      setRouteError(errorMsg);
    },
    []
  );

  const resolvedOrigin = originPlace?.location || currentUserCoords || null;
  const resolvedDestination = destinationPlace?.location || null;

  const handleSendToEventCalm = async () => {
    if (!destinationPlace) return;
    await onSaveEventSession({
      id: createId('evcalm'),
      eventName: destinationPlace.name,
      venue: destinationPlace.address || destinationPlace.name,
      date: getTodayStr(),
      startTime: '18:00',
      endTime: '20:30',
      intervalMinutes: 20,
      isMidpointOnly: false,
      selectedPrompts: [
        "It's okay. You don't have to perform or impress anyone. You are just here to attend, and afterward you can leave.",
        'Step outside for 2 minutes of fresh air and take 3 slow breaths.',
      ],
      customPrompts: [],
      active: true,
      createdAt: new Date().toISOString(),
    });
    setSavedFeedback('Added to Event Calm Mode.');
  };

  const handleAddToCalendar = async () => {
    if (!destinationPlace) return;
    await onSaveCalendarEvent({
      id: createId('cal'),
      title: `Visit ${destinationPlace.name}`,
      date: getTodayStr(),
      startTime: '15:00',
      endTime: '16:30',
      location: destinationPlace.address || destinationPlace.name,
      notes: routeSummary
        ? `Estimated travel: ${Math.max(1, Math.round(routeSummary.durationMillis / 60000))} mins`
        : 'Added from Sanctuary Explorer',
      color: 'sky',
      createdAt: new Date().toISOString(),
    });
    setSavedFeedback('Added to Calendar.');
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="text-xs text-[#98A2B3] block">Destination / Venue</label>
            <PlaceSearchInput
              placeholder="Search parks, cafés, wedding venues, quiet spots..."
              value={destinationQuery}
              onChange={setDestinationQuery}
              onPlaceSelected={handleSelectDestination}
              icon={<Search className="w-4 h-4 text-[#9BC4E2]" />}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-[#98A2B3]">Starting Point (for route)</label>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="text-xs text-[#9EC5AB] hover:underline inline-flex items-center gap-1"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Use current location
              </button>
            </div>
            <PlaceSearchInput
              placeholder="Search starting address or click Use current location..."
              value={originQuery}
              onChange={setOriginQuery}
              onPlaceSelected={handleSelectOrigin}
              icon={<Compass className="w-4 h-4 text-[#9EC5AB]" />}
            />
          </div>
        </div>

        {geoStatus && <p className="text-xs text-[#98A2B3]">{geoStatus}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'DRIVING', label: 'Drive', icon: Car },
                { id: 'WALKING', label: 'Walk', icon: Footprints },
                { id: 'TRANSIT', label: 'Transit', icon: TrainFront },
              ] as const
            ).map((mode) => {
              const Icon = mode.icon;
              const active = travelMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setTravelMode(mode.id)}
                  className={`min-h-[40px] px-3.5 rounded-2xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-[#9BC4E2]/20 text-[#9BC4E2] border border-[#9BC4E2]/40'
                      : 'bg-[#1D212A] text-[#98A2B3] border border-white/[0.06] hover:text-[#F1F3F6]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>

          {routeSummary && (
            <div className="text-xs text-[#F1F3F6] font-mono-tabular flex items-center gap-3">
              <span>{(routeSummary.distanceMeters / 1000).toFixed(1)} km</span>
              <span className="text-[#98A2B3]">·</span>
              <span className="text-[#9EC5AB] font-semibold">
                {Math.max(1, Math.round(routeSummary.durationMillis / 60000))} min
              </span>
            </div>
          )}
        </div>

        {routeError && <p className="text-xs text-[#F2B8A2]">{routeError}</p>}
      </section>

      <div className="rounded-3xl overflow-hidden border border-white/[0.08] bg-[#171A21] h-[420px] sm:h-[520px] w-full relative">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: 37.7749, lng: -122.4194 }}
          defaultZoom={12}
          gestureHandling="greedy"
          disableDefaultUI={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {resolvedOrigin && (
            <AdvancedMarker position={resolvedOrigin} title="Starting point">
              <Pin background="#9EC5AB" borderColor="#0F1115" glyphColor="#0F1115" />
            </AdvancedMarker>
          )}

          {destinationPlace && (
            <>
              <AdvancedMarker
                ref={destMarkerRef}
                position={destinationPlace.location}
                title={destinationPlace.name}
                onClick={() => setInfoOpen(true)}
              >
                <Pin background="#9BC4E2" borderColor="#0F1115" glyphColor="#0F1115" />
              </AdvancedMarker>

              {infoOpen && destMarker && (
                <InfoWindow anchor={destMarker} onCloseClick={() => setInfoOpen(false)}>
                  <div className="text-[#0F1115] p-1 max-w-[220px]">
                    <p className="font-semibold text-sm">{destinationPlace.name}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{destinationPlace.address}</p>
                    {destinationPlace.rating && (
                      <p className="text-xs text-slate-700 mt-1">
                        Rating: {destinationPlace.rating.toFixed(1)} / 5
                      </p>
                    )}
                  </div>
                </InfoWindow>
              )}
            </>
          )}

          <RouteOverlay
            origin={resolvedOrigin}
            destination={resolvedDestination}
            travelMode={travelMode}
            onRouteSummary={handleRouteSummary}
          />
        </GoogleMap>
      </div>

      {destinationPlace && (
        <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-[#9BC4E2]">Selected Destination</p>
            <h2 className="font-display text-lg font-medium text-[#F1F3F6]">
              {destinationPlace.name}
            </h2>
            <p className="text-xs text-[#98A2B3]">{destinationPlace.address}</p>
            {destinationPlace.isOpenText && (
              <p className="text-xs text-[#D0D5DD] pt-0.5">{destinationPlace.isOpenText}</p>
            )}
            {savedFeedback && (
              <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
                <span className="text-[#9EC5AB]">{savedFeedback}</span>
                <button
                  type="button"
                  onClick={onNavigateToEventCalm}
                  className="text-[#9BC4E2] underline"
                >
                  Open Event Calm
                </button>
                <button
                  type="button"
                  onClick={onNavigateToCalendar}
                  className="text-[#9BC4E2] underline"
                >
                  Open Calendar
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleSendToEventCalm()}
              className="min-h-[44px] px-4 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              Prepare Event Calm
            </button>
            <button
              type="button"
              onClick={() => void handleAddToCalendar()}
              className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-[#F1F3F6] inline-flex items-center gap-2 whitespace-nowrap"
            >
              <CalendarPlus className="w-4 h-4 text-[#9BC4E2]" />
              Add to Calendar
            </button>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                destinationPlace.address || destinationPlace.name
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-[#9BC4E2] inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Navigation className="w-4 h-4" />
              Open in Google Maps
            </a>
          </div>
        </section>
      )}
    </div>
  );
};

export const MapsView: React.FC<MapsViewProps> = (props) => {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs text-[#9BC4E2]">Places & Quiet Route Planner</p>
        <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
          Sanctuary Maps
        </h1>
        <p className="text-sm text-[#98A2B3] mt-1 max-w-2xl">
          Search venues, explore travel routes before leaving home, and link upcoming destinations
          to Event Calm Mode or your Calendar.
        </p>
      </header>

      {!MAPS_API_KEY ? (
        <div className="rounded-3xl bg-[#171A21] border border-[#F2B8A2]/30 p-6 space-y-2">
          <p className="text-sm font-medium text-[#F1F3F6]">
            Google Maps API key not detected in the client environment.
          </p>
          <p className="text-xs text-[#98A2B3]">
            Enable Google Maps in the AI Studio Google Maps panel or ensure{' '}
            <code className="text-[#9BC4E2]">VITE_GOOGLE_MAPS_API_KEY</code> is available.
          </p>
        </div>
      ) : (
        <APIProvider
          apiKey={MAPS_API_KEY}
          language="en"
        >
          <MapWorkspace {...props} />
        </APIProvider>
      )}
    </div>
  );
};
