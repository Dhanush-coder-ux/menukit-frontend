import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  QrCode, MapPin, Star, ArrowRight,
  Navigation, Tag, X, Search, Store, Gift, Phone, Clock, ExternalLink, Flame, Crown, Sparkles
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  MapContainer, TileLayer, Marker, Popup, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/services/api';
import { PublicShopListing } from '@/types';

const BrandFooter = ({ mode }: { mode: 'landing' | 'scanner' | 'map' }) => {
  if (mode === 'map') {
    return (
      <div style={{
        background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(8px)',
        borderTop: '1px solid #e2e8f0', padding: '6px 16px', zIndex: 50,
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, flexShrink: 0
      }}>
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>Powered by</span>
        <a href="https://menukit.debuggers.co.in/landing" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 800, background: 'linear-gradient(90deg, #f97316, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          Menukit
          <ExternalLink size={10} color="#f97316" />
        </a>
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 0, right: 0,
      display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, zIndex: 40
    }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>Powered by</span>
      <a href="https://menukit.debuggers.co.in/landing" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 800, background: 'linear-gradient(90deg, #f97316, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
        Menukit
        <ExternalLink size={10} color="#f97316" />
      </a>
    </div>
  );
};


// ─── Fix Leaflet default marker icons (Vite doesn't bundle them automatically) ──
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─── Custom shop pin icon factory ────────────────────────────────────────────
function makeShopIcon(hasDeals: boolean) {
  const color = hasDeals ? '#f97316' : '#64748b';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.2 0 0 7.2 0 16C0 26.4 16 40 16 40S32 26.4 32 16C32 7.2 24.8 0 16 0Z" fill="${color}" />
      <circle cx="16" cy="16" r="9" fill="white"/>
      <text x="16" y="20" text-anchor="middle" font-size="11" fill="${color}" font-family="system-ui">🍽</text>
    </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -44],
    className: '',
  });
}

// ─── Helper: fly map to position ─────────────────────────────────────────────
function FlyTo({ position, zoom }: { position: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, zoom, { duration: 1 });
  }, [position, zoom]);
  return null;
}

// ─── Helper: haversine distance (km) ─────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Star rating display ──────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={11}
          className={
            i <= Math.round(rating)
              ? 'text-amber-400 fill-amber-400'
              : 'text-slate-200 fill-slate-200'
          }
        />
      ))}
    </div>
  );
}

// ─── Shop Marker Component (Auto-opens popup when selected) ────────────────────
function ShopMarker({
  shop,
  isSelected,
  onSelect
}: {
  shop: PublicShopListing;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isSelected && markerRef.current) {
      // Small timeout ensures the flyTo animation has started so the popup stays in view
      setTimeout(() => markerRef.current?.openPopup(), 150);
    }
  }, [isSelected]);

  return (
    <Marker
      ref={markerRef}
      position={[shop.latitude!, shop.longitude!]}
      icon={makeShopIcon(shop.active_discounts_count > 0)}
      eventHandlers={{ click: onSelect }}
    >
      <Popup>
        <div style={{ minWidth: 180, fontFamily: 'system-ui' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {shop.logo_url
              ? <img src={shop.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
              : <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><Store size={18} /></div>
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{shop.name}</div>
              {shop.average_rating && (
                <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star size={11} className="fill-amber-400 text-amber-400" /> {shop.average_rating} ({shop.total_reviews} reviews)
                </div>
              )}
            </div>
          </div>
          {shop.best_discount_label && (
            <div style={{
              background: '#fff7ed', border: '1px solid #fed7aa',
              borderRadius: 6, padding: '4px 8px', marginBottom: 8,
              fontSize: 12, color: '#ea580c', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 4
            }}>
              <Gift size={12} /> {shop.best_discount_label}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {shop.show_menus_in_discovery !== false && (
              <button
                onClick={() => navigate(`/shop/${shop.id}`)}
                style={{
                  flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg,#f97316,#ea580c)',
                  color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                View Menu
              </button>
            )}
            <button
              onClick={() => {
                // We will dispatch a custom event or set a global state if we refactor,
                // but since ShopMarker is a subcomponent, let's pass a callback or just
                // dispatch a custom event to the parent.
                window.dispatchEvent(new CustomEvent('open-shop-info', { detail: shop.id }));
              }}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0',
                background: 'white', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              Shop Info
            </button>
          </div>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '6px', borderRadius: 8, border: 'none',
              background: '#f1f5f9', color: '#3b82f6', fontWeight: 600, fontSize: 12,
              textDecoration: 'none'
            }}
          >
            <Navigation size={12} /> Directions
          </a>
        </div>
      </Popup>
    </Marker>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
type Mode = 'landing' | 'scanner' | 'map';
type SortMode = 'deals' | 'rating' | 'nearest';

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

export function StoreDiscoveryPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('landing');

  // ── Shops state ──────────────────────────────────────────────────────────
  const [shops, setShops] = useState<PublicShopListing[]>([]);
  const [isLoadingShops, setIsLoadingShops] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('deals');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShop, setSelectedShop] = useState<PublicShopListing | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapTarget, setMapTarget] = useState<{ pos: [number, number]; zoom: number }>({
    pos: INDIA_CENTER,
    zoom: 5,
  });
  const [pendingNearestFly, setPendingNearestFly] = useState(false);

  // ── Modals state ──────────────────────────────────────────────────────────
  const [infoShopId, setInfoShopId] = useState<string | null>(null);
  const [infoShopData, setInfoShopData] = useState<any>(null);
  const [offersShopId, setOffersShopId] = useState<string | null>(null);
  const [offersData, setOffersData] = useState<any[]>([]);

  useEffect(() => {
    const handleOpenShopInfo = (e: any) => {
      setInfoShopId(e.detail);
    };
    window.addEventListener('open-shop-info', handleOpenShopInfo);
    return () => window.removeEventListener('open-shop-info', handleOpenShopInfo);
  }, []);

  useEffect(() => {
    if (infoShopId) {
      setInfoShopData(null);
      api.get(`/public/shop/${infoShopId}`).then(res => setInfoShopData(res.data)).catch(() => { });
    }
  }, [infoShopId]);

  useEffect(() => {
    if (offersShopId) {
      setOffersData([]);
      api.get(`/public/shop/${offersShopId}/discounts`).then(res => setOffersData(res.data)).catch(() => { });
    }
  }, [offersShopId]);

  // ── Scanner state ─────────────────────────────────────────────────────────
  const [scanError, setScanError] = useState('');
  const [isScannerStarted, setIsScannerStarted] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // ── Load shops ────────────────────────────────────────────────────────────
  const loadShops = useCallback(async () => {
    setIsLoadingShops(true);
    try {
      const res = await api.get('/public/shops');
      setShops(res.data || []);
    } catch {
      /* silently ignore */
    } finally {
      setIsLoadingShops(false);
    }
  }, []);

  // ── Geolocation ───────────────────────────────────────────────────────────
  const getUserLocation = useCallback((flyToUser: boolean = true) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setUserLocation(loc);
      if (flyToUser) {
        setMapTarget({ pos: loc, zoom: 13 });
      }
    });
  }, []);

  // ── Start/stop QR scanner ──────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setScanError('');
    setIsScannerStarted(false);
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { }
      scannerRef.current = null;
    }
    const scanner = new Html5Qrcode('qr-reader-div');
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          const match = text.match(/\/shop\/([a-f0-9-]{36})/);
          if (match) {
            stopScanner();
            navigate(`/shop/${match[1]}`);
          } else if (text.startsWith('http')) {
            stopScanner();
            window.location.href = text;
          } else {
            setScanError(`Not a MenuKit QR — scanned: ${text.substring(0, 50)}`);
          }
        },
        () => { }
      );
      setIsScannerStarted(true);
    } catch (err: any) {
      setScanError(err?.message || 'Camera access denied. Please allow camera permissions.');
    }
  }, [navigate]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { }
      scannerRef.current = null;
    }
    setIsScannerStarted(false);
  }, []);

  useEffect(() => {
    if (mode === 'scanner') {
      const t = setTimeout(startScanner, 300);
      return () => { clearTimeout(t); stopScanner(); };
    }
    if (mode === 'map') {
      loadShops();
      getUserLocation(true);
    }
    return () => { stopScanner(); };
  }, [mode]);

  // ── Fly to nearest ────────────────────────────────────────────────────────
  useEffect(() => {
    if (pendingNearestFly && userLocation && shops.length > 0) {
      let nearestShop: PublicShopListing | null = null;
      let minDistance = 9999;
      for (const s of shops) {
        if (s.latitude && s.longitude) {
          const d = haversineKm(userLocation[0], userLocation[1], s.latitude, s.longitude);
          if (d < minDistance) {
            minDistance = d;
            nearestShop = s;
          }
        }
      }
      if (nearestShop) {
        setMapTarget({ pos: [nearestShop.latitude!, nearestShop.longitude!], zoom: 15 });
        setSelectedShop(nearestShop);
      } else {
        setMapTarget({ pos: userLocation, zoom: 13 });
      }
      setPendingNearestFly(false);
    }
  }, [pendingNearestFly, userLocation, shops]);

  // ── Sorted & filtered list ────────────────────────────────────────────────
  const filteredShops = shops
    .filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.address ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortMode === 'deals')
        return (b.active_discounts_count - a.active_discounts_count)
          || ((b.average_rating ?? 0) - (a.average_rating ?? 0));
      if (sortMode === 'rating')
        return (b.average_rating ?? 0) - (a.average_rating ?? 0);
      if (sortMode === 'nearest' && userLocation) {
        const da = a.latitude && a.longitude
          ? haversineKm(userLocation[0], userLocation[1], a.latitude, a.longitude) : 9999;
        const db = b.latitude && b.longitude
          ? haversineKm(userLocation[0], userLocation[1], b.latitude, b.longitude) : 9999;
        return da - db;
      }
      return 0;
    });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. LANDING
  // ════════════════════════════════════════════════════════════════════════════
  if (mode === 'landing') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-start', paddingTop: '8vh', paddingLeft: 20, paddingRight: 20, paddingBottom: 24, position: 'relative', overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        {/* Radial glow blobs */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 20% 50%, #f9731618 0%, transparent 60%), radial-gradient(ellipse at 80% 30%, #7c3aed18 0%, transparent 60%)',
        }} />

        <style>{`
          @keyframes badge-pulse {
            0%, 100% { transform: scale(1);    box-shadow: 0 16px 40px rgba(249,115,22,.4); }
            50%       { transform: scale(1.06); box-shadow: 0 24px 60px rgba(249,115,22,.6); }
          }
          @keyframes scan-beam {
            0%, 100% { top: 18%; }
            50%       { top: 78%; }
          }
        `}</style>

        {/* Logo and Brand Name */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
          marginBottom: 24, position: 'relative', zIndex: 1,
        }}>
          <img
            src="/menukit-logo.svg"
            alt="MenuKit Logo"
            style={{
              width: 80, height: 80, objectFit: 'contain',
              filter: 'drop-shadow(0 12px 24px rgba(249,115,22,0.3))'
            }}
            onError={(e) => {
              // Fallback if svg fails
              e.currentTarget.src = '/menukit.png';
            }}
          />
          <h1 style={{
            fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900,
            color: 'white', textAlign: 'center', lineHeight: 1.1,
            marginBottom: 14, letterSpacing: '-0.02em', position: 'relative', zIndex: 1,
          }}>
            Menu{' '}
            <span style={{
              background: 'linear-gradient(90deg, #f97316, #f59e0b)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Kit</span>
          </h1>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900,
          color: 'white', textAlign: 'center', lineHeight: 1.1,
          marginBottom: 14, letterSpacing: '-0.02em', position: 'relative', zIndex: 1,
        }}>
          Find Your Perfect{' '}
          <span style={{
            background: 'linear-gradient(90deg, #f97316, #f59e0b)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Dining Spot</span>
        </h1>
        <p style={{
          color: 'rgba(255,255,255,.6)', textAlign: 'center', maxWidth: 460,
          fontSize: 'clamp(.875rem, 2vw, 1.1rem)', marginBottom: 48,
          lineHeight: 1.6, position: 'relative', zIndex: 1,
        }}>
          Discover restaurants near you with the best deals, offers, and reviews — completely free.
        </p>

        {/* Main Action Card */}
        <div style={{
          background: 'rgba(255,255,255,.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 32,
          padding: 24,
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginBottom: 40,
          position: 'relative',
          zIndex: 1,
          boxShadow: '0 24px 60px rgba(0,0,0,.2)',
        }}>
          {/* Browse Stores (Primary) */}
          <button
            id="btn-choose-store"
            onClick={() => setMode('map')}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '20px 24px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              boxShadow: '0 12px 30px rgba(249,115,22,.4)',
              transition: 'transform .2s, box-shadow .2s',
              width: '100%',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(255,255,255,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <MapPin size={28} color="white" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
              <span style={{ color: 'white', fontSize: '1.2rem', fontWeight: 800 }}>Browse Stores</span>
              <span style={{ color: 'rgba(255,255,255,.8)', fontSize: '.8rem', textAlign: 'left', fontWeight: 500 }}>
                Explore map, filter by deals
              </span>
            </div>
            <ArrowRight size={20} color="rgba(255,255,255,.9)" />
          </button>

          {/* Scan QR (Secondary) */}
          <button
            id="btn-scan-qr"
            onClick={() => setMode('scanner')}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px', borderRadius: 20, border: '1px solid rgba(255,255,255,.15)',
              cursor: 'pointer', background: 'rgba(255,255,255,.05)',
              transition: 'background .2s',
              width: '100%',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(249,115,22,.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <QrCode size={22} color="#fb923c" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
              <span style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700 }}>Scan QR Code</span>
              <span style={{ color: 'rgba(255,255,255,.6)', fontSize: '.75rem', textAlign: 'left' }}>
                At a restaurant? Scan to order
              </span>
            </div>
          </button>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          {[
            { icon: <Store size={13} color="#a855f7" />, text: 'Shop Menus' },
            { icon: <Tag size={13} color="#fb923c" />, text: 'Best Discounts' },
            { icon: <Star size={13} className="fill-amber-400 text-amber-400" />, text: 'Top Rated' },
            { icon: <Navigation size={13} color="#60a5fa" />, text: 'Nearby Stores' },
          ].map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
              padding: '7px 14px', borderRadius: 100,
              color: 'rgba(255,255,255,.7)', fontSize: '.78rem', fontWeight: 600,
              backdropFilter: 'blur(8px)',
            }}>
              {f.icon} {f.text}
            </div>
          ))}
        </div>

        <BrandFooter mode="landing" />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. QR SCANNER
  // ════════════════════════════════════════════════════════════════════════════
  if (mode === 'scanner') {
    return (
      <div style={{
        minHeight: '100vh', background: '#0b0f1a',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', position: 'relative', overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        {/* Back button */}
        <button
          onClick={() => setMode('landing')}
          style={{
            position: 'absolute', top: 20, left: 20, zIndex: 50,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'white',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: 28, padding: '0 16px' }}>
          <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Scan QR Code</h2>
          <p style={{ color: '#94a3b8', fontSize: '.875rem', marginTop: 6 }}>
            Point at a restaurant's MenuKit QR code
          </p>
        </div>

        {/* Viewfinder frame */}
        <div style={{ position: 'relative', width: 290, height: 290 }}>
          {/* Corner brackets */}
          {[
            { top: 0, left: 0, borderTop: '3px solid rgba(249,115,22,.9)', borderLeft: '3px solid rgba(249,115,22,.9)', borderRadius: '8px 0 0 0' },
            { top: 0, right: 0, borderTop: '3px solid rgba(249,115,22,.9)', borderRight: '3px solid rgba(249,115,22,.9)', borderRadius: '0 8px 0 0' },
            { bottom: 0, left: 0, borderBottom: '3px solid rgba(249,115,22,.9)', borderLeft: '3px solid rgba(249,115,22,.9)', borderRadius: '0 0 0 8px' },
            { bottom: 0, right: 0, borderBottom: '3px solid rgba(249,115,22,.9)', borderRight: '3px solid rgba(249,115,22,.9)', borderRadius: '0 0 8px 0' },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 32, height: 32, ...s }} />
          ))}

          {/* Scanning beam */}
          {isScannerStarted && (
            <div style={{
              position: 'absolute', left: 8, right: 8, height: 2,
              background: 'linear-gradient(90deg, transparent, #f97316, transparent)',
              boxShadow: '0 0 8px #f97316',
              animation: 'scan-beam 2s ease-in-out infinite',
              zIndex: 20,
            }} />
          )}

          {/* Camera feed */}
          <div
            id="qr-reader-div"
            style={{ width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden' }}
          />
        </div>

        {scanError && (
          <div style={{
            marginTop: 20, background: 'rgba(239,68,68,.15)',
            border: '1px solid rgba(239,68,68,.3)', borderRadius: 12,
            padding: '10px 18px', color: '#fca5a5', fontSize: '.85rem',
            maxWidth: 280, textAlign: 'center',
          }}>
            {scanError}
          </div>
        )}

        {!isScannerStarted && !scanError && (
          <div style={{
            marginTop: 20, display: 'flex', alignItems: 'center', gap: 8,
            color: '#64748b', fontSize: '.875rem',
          }}>
            <div style={{
              width: 16, height: 16, border: '2px solid #64748b',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
            Starting camera…
          </div>
        )}

        <p style={{
          marginTop: 32, color: '#475569', fontSize: '.75rem',
          textAlign: 'center', maxWidth: 280, padding: '0 16px',
        }}>
          Allow camera access when prompted. Works with any MenuKit QR code.
        </p>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes scan-beam {
            0%, 100% { top: 18%; }
            50%       { top: 78%; }
          }
        `}</style>

        <BrandFooter mode="scanner" />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. MAP BROWSER  (OpenStreetMap + react-leaflet — 100% free)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', system-ui, sans-serif", background: '#f8fafc',
    }}>
      {/* ── Top bar ── */}
      <div style={{
        background: 'white', borderBottom: '1px solid #e2e8f0',
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,.06)', zIndex: 30, flexShrink: 0,
      }}>
        <button
          onClick={() => setMode('landing')}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none',
            background: '#f1f5f9', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <X size={18} color="#475569" />
        </button>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search restaurants…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', height: 38, paddingLeft: 32, paddingRight: 12,
              borderRadius: 10, border: 'none', background: '#f1f5f9',
              fontSize: '.875rem', fontWeight: 500, color: '#334155',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Locate me */}
        <button
          onClick={() => getUserLocation(true)}
          title="Use my location"
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none',
            background: '#fff7ed', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Navigation size={16} color="#f97316" />
        </button>
      </div>

      {/* ── Main split: Map + List ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: 'column' }}>
        {/* Leaflet Map */}
        <div style={{ height: '42%', minHeight: 220, position: 'relative', zIndex: 0 }}>
          <MapContainer
            center={INDIA_CENTER}
            zoom={5}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
            scrollWheelZoom={true}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Fly to target when user clicks a shop or uses locate */}
            <FlyTo position={mapTarget.pos} zoom={mapTarget.zoom} />

            {/* User location marker */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={L.divIcon({
                  html: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,.3)"></div>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7],
                  className: '',
                })}
              >
                <Popup><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} color="#3b82f6" /> You are here</div></Popup>
              </Marker>
            )}

            {/* Shop markers */}
            {filteredShops
              .filter(s => s.latitude && s.longitude)
              .map(shop => (
                <ShopMarker
                  key={shop.id}
                  shop={shop}
                  isSelected={selectedShop?.id === shop.id}
                  onSelect={() => {
                    setSelectedShop(shop);
                    setMapTarget({ pos: [shop.latitude!, shop.longitude!], zoom: 15 });
                  }}
                />
              ))}
          </MapContainer>
        </div>

        {/* ── Shop list panel ── */}
        <div style={{
          flex: 1, background: 'white', display: 'flex', flexDirection: 'column',
          borderTop: '1px solid #e2e8f0', overflow: 'hidden',
          boxShadow: '0 -4px 16px rgba(0,0,0,.06)',
        }}>
          {/* Sort tabs */}
          <div style={{
            display: 'flex', gap: 6, padding: '10px 12px',
            borderBottom: '1px solid #f1f5f9', flexShrink: 0,
          }}>
            {([
              { id: 'deals', label: <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Flame size={12} /> Best Deals</div> },
              { id: 'rating', label: <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Star size={12} className={sortMode === 'rating' ? 'fill-white' : 'fill-amber-400'} /> Top Rated</div> },
              { id: 'nearest', label: <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><MapPin size={12} /> Nearest</div> },
            ] as { id: SortMode; label: React.ReactNode }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setSortMode(tab.id);
                  if (tab.id === 'nearest') {
                    setPendingNearestFly(true);
                    getUserLocation(false);
                  }
                }}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none',
                  fontSize: '.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                  background: sortMode === tab.id ? '#f97316' : '#f8fafc',
                  color: sortMode === tab.id ? 'white' : '#64748b',
                  boxShadow: sortMode === tab.id ? '0 2px 8px rgba(249,115,22,.35)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Count row */}
          <div style={{
            padding: '6px 14px', borderBottom: '1px solid #f8fafc',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}>
            <span style={{ fontSize: '.75rem', color: '#94a3b8', fontWeight: 500 }}>
              {isLoadingShops ? 'Loading…'
                : `${filteredShops.length} restaurant${filteredShops.length !== 1 ? 's' : ''}`}
            </span>
            {filteredShops.filter(s => s.active_discounts_count > 0).length > 0 && (
              <span style={{
                fontSize: '.65rem', fontWeight: 800, padding: '2px 8px',
                borderRadius: 100, background: '#fff7ed', color: '#ea580c',
                border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 4
              }}>
                <Gift size={10} /> {filteredShops.filter(s => s.active_discounts_count > 0).length} with offers
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '.65rem', color: '#cbd5e1', fontWeight: 500 }}>
              © OpenStreetMap
            </span>
          </div>

          {/* Shop cards */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoadingShops ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{
                  width: 32, height: 32, border: '2px solid #f97316',
                  borderTopColor: 'transparent', borderRadius: '50%',
                  animation: 'spin .7s linear infinite', margin: '0 auto 12px',
                }} />
                Finding restaurants…
              </div>
            ) : filteredShops.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: '#94a3b8' }}><Store size={40} /></div>
                <p style={{ color: '#94a3b8', fontSize: '.875rem', fontWeight: 600 }}>
                  No restaurants found
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ marginTop: 8, fontSize: '.75rem', color: '#f97316', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredShops.map(shop => {
                const distKm = userLocation && shop.latitude && shop.longitude
                  ? haversineKm(userLocation[0], userLocation[1], shop.latitude, shop.longitude)
                  : null;
                const isSelected = selectedShop?.id === shop.id;

                return (
                  <div
                    key={shop.id}
                    onClick={() => {
                      if (shop.latitude && shop.longitude) {
                        setSelectedShop(shop);
                        setMapTarget({ pos: [shop.latitude, shop.longitude], zoom: 15 });
                      } else {
                        alert(`Coordinates not set for ${shop.name}. Ask the shop owner to add their location on the map in Shop Setup!`);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', cursor: 'pointer', transition: 'background .15s',
                      borderBottom: '1px solid #f8fafc',
                      background: isSelected ? '#fff7ed' : 'white',
                      borderLeft: isSelected ? '4px solid #f97316' : '4px solid transparent',
                    }}
                  >
                    {/* Logo */}
                    <div style={{
                      width: 52, height: 52, borderRadius: 14, overflow: 'hidden',
                      background: '#f1f5f9', border: '1px solid #e2e8f0', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                    }}>
                      {shop.logo_url
                        ? <img src={shop.logo_url} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Store size={22} color="#94a3b8" />}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 2 }}>
                        <span style={{
                          fontWeight: 700, fontSize: '.875rem', color: '#1e293b',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{shop.name}</span>
                        {shop.active_discounts_count > 0 && (
                          <span
                            onClick={(e) => { e.stopPropagation(); setOffersShopId(shop.id); }}
                            style={{
                              flexShrink: 0, fontSize: '.65rem', fontWeight: 800,
                              padding: '2px 6px', borderRadius: 100,
                              background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa',
                              display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(249,115,22,.15)'
                            }}>
                            <Gift size={9} /> {shop.active_discounts_count} offer{shop.active_discounts_count > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Best discount */}
                      {shop.best_discount_label && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                          <Tag size={10} color="#f97316" />
                          <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#ea580c' }}>
                            {shop.best_discount_label}
                          </span>
                        </div>
                      )}

                      {/* Rating + distance */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {shop.average_rating ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <StarRating rating={shop.average_rating} />
                            <span style={{ fontSize: '.7rem', fontWeight: 600, color: '#475569' }}>
                              {shop.average_rating} ({shop.total_reviews})
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '.7rem', color: '#cbd5e1' }}>No reviews</span>
                        )}
                        {distKm !== null && (
                          <span style={{ fontSize: '.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Navigation size={9} />
                            {distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`}
                          </span>
                        )}
                      </div>

                      {/* Address */}
                      {shop.address && (
                        <p style={{
                          fontSize: '.68rem', color: '#94a3b8', marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          <MapPin size={8} /> {shop.address}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Go button */}
                      {shop.show_menus_in_discovery !== false && (
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/shop/${shop.id}`); }}
                          style={{
                            width: 36, height: 36, borderRadius: '50%', border: 'none',
                            background: 'linear-gradient(135deg,#f97316,#ea580c)',
                            color: 'white', cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(249,115,22,.35)',
                          }}
                        >
                          <ArrowRight size={15} />
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setInfoShopId(shop.id); }}
                        style={{
                          width: 36, height: 36, borderRadius: '50%', border: '1px solid #e2e8f0',
                          background: 'white',
                          color: '#475569', cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title="Shop Info"
                      >
                        <Store size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Info Modal */}
      {infoShopId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px'
        }} onClick={() => setInfoShopId(null)}>
          <div style={{
            background: 'white', width: '100%', maxWidth: 400, borderRadius: 24, padding: 20,
            transform: 'translateY(0)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Shop Info</h3>
              <button onClick={() => setInfoShopId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color="#64748b" /></button>
            </div>
            {!infoShopData ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>Loading info...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {infoShopData.logo_url ? <img src={infoShopData.logo_url} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} /> : <div style={{ width: 48, height: 48, background: '#f1f5f9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Store size={24} color="#94a3b8" /></div>}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{infoShopData.name}</div>
                    {infoShopData.average_rating && <div style={{ fontSize: '.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}><Star size={12} className="fill-amber-400 text-amber-400" /> {infoShopData.average_rating} ({infoShopData.total_reviews} reviews)</div>}
                  </div>
                </div>
                {infoShopData.description && <div style={{ fontSize: '.875rem', color: '#475569', lineHeight: 1.5 }}>{infoShopData.description}</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 12 }}>
                  {infoShopData.address && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '.875rem', color: '#334155' }}><MapPin size={16} color="#64748b" style={{ flexShrink: 0, marginTop: 2 }} /> <span>{infoShopData.address}</span></div>}
                  {(infoShopData.opening_time || infoShopData.closing_time) && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.875rem', color: '#334155' }}><Clock size={16} color="#64748b" /> {infoShopData.opening_time} - {infoShopData.closing_time}</div>}
                  {infoShopData.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.875rem', color: '#334155' }}><Phone size={16} color="#64748b" /> {infoShopData.phone}</div>}
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {infoShopData.settings?.show_menus_in_discovery !== false && (
                    <button onClick={() => navigate(`/shop/${infoShopData.id}`)} style={{ flex: 1, padding: '12px', background: '#f97316', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>View Menu</button>
                  )}
                  {infoShopData.latitude && infoShopData.longitude && (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${infoShopData.latitude},${infoShopData.longitude}`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#3b82f6', textDecoration: 'none', borderRadius: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Navigation size={16} /> Directions
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offers Modal */}
      {offersShopId && (() => {
        const offersShop = shops.find(s => s.id === offersShopId);
        const showMenuInDiscovery = offersShop?.show_menus_in_discovery !== false;
        return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px'
        }} onClick={() => setOffersShopId(null)}>
          <div style={{
            background: 'white', width: '100%', maxWidth: 400, borderRadius: 24, padding: 20, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            transform: 'translateY(0)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Gift size={22} color="#f97316" /> Available Offers</h3>
              <button onClick={() => setOffersShopId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color="#64748b" /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {offersData.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>Loading offers...</div>
              ) : (
                offersData.map(disc => (
                  <div
                    key={disc.id}
                    className="relative shrink-0 w-full flex shadow-md rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white group"
                    style={{ border: `1px solid #f9731630` }}
                    onClick={() => { 
                      setOffersShopId(null); 
                      if (showMenuInDiscovery) {
                        navigate(`/shop/${offersShopId}`); 
                      } else {
                        setInfoShopId(offersShopId);
                      }
                    }}
                  >
                    {/* Left Ticket Stub */}
                    <div
                      className="relative w-28 sm:w-32 flex flex-col items-center justify-center text-white p-4 shrink-0"
                      style={{ backgroundColor: '#f97316' }}
                    >
                      {/* Cutouts for ticket effect */}
                      <div className="absolute -top-3 -right-3 w-6 h-6 bg-slate-50 rounded-full border-b border-l border-transparent" style={{ borderColor: `#f9731630` }} />
                      <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-slate-50 rounded-full border-t border-l border-transparent" style={{ borderColor: `#f9731630` }} />

                      <div className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-md text-center">
                        {disc.discount_type === 'percentage' && `${Number(disc.discount_value)}%`}
                        {disc.discount_type === 'flat' && `₹${Number(disc.discount_value)}`}
                        {disc.discount_type === 'bogo' && 'BOGO'}
                        {disc.discount_type === 'combo' && 'COMBO'}
                      </div>
                      <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-0.5 opacity-90 text-center">
                        {['percentage', 'flat'].includes(disc.discount_type) && 'Off'}
                        {disc.discount_type === 'bogo' && `Buy ${disc.buy_quantity} Get ${disc.get_quantity}`}
                        {disc.discount_type === 'combo' && `₹${Number(disc.discount_value)}`}
                      </div>
                    </div>

                    {/* Perforated line */}
                    <div className="relative border-l-2 border-dashed border-slate-200 my-4" />

                    {/* Right Ticket Body */}
                    <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center relative bg-white overflow-hidden min-w-0 text-left">
                      <div className="flex justify-between items-start mb-1.5 gap-2">
                        <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight truncate m-0">
                          {disc.title}
                        </h3>
                        <Sparkles size={16} className="shrink-0 animate-pulse text-orange-500" />
                      </div>

                      {disc.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3 font-medium m-0">
                          {disc.description}
                        </p>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2 min-w-0">
                        <div className="flex flex-col gap-1 min-w-0 shrink">
                          <div className="flex gap-1.5">
                            {disc.members_only ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-sm flex items-center gap-1 bg-purple-100 text-purple-700 min-w-0">
                                <Crown size={10} className="shrink-0" />
                                <span className="truncate">Members Only</span>
                              </span>
                            ) : (
                              <span
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-sm truncate min-w-0"
                                style={{ color: '#f97316', backgroundColor: `#f9731615` }}
                              >
                                Limited Offer
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 mt-1">
                            Applies to: {disc.applies_to === 'all' ? 'All Menu' : disc.applies_to === 'category' ? 'Selected Categories' : 'Selected Items'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap">
                          {showMenuInDiscovery ? 'Tap to use' : 'View Info'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {showMenuInDiscovery ? (
              <button onClick={() => { setOffersShopId(null); navigate(`/shop/${offersShopId}`); }} style={{ width: '100%', padding: '14px', background: '#f97316', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', marginTop: 16 }}>
                Order Now
              </button>
            ) : (
              <button onClick={() => { setOffersShopId(null); setInfoShopId(offersShopId); }} style={{ width: '100%', padding: '14px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', marginTop: 16 }}>
                Shop Info
              </button>
            )}
          </div>
        </div>
        );
      })()}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <BrandFooter mode="map" />
    </div>
  );
}
