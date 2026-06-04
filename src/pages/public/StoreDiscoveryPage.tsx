import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  QrCode, MapPin, Star, ArrowRight, UtensilsCrossed,
  Navigation, TrendingUp, Tag, X, Search
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  MapContainer, TileLayer, Marker, Popup, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/services/api';
import { PublicShopListing } from '@/types';

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
              : <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🍽️</div>
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{shop.name}</div>
              {shop.average_rating && (
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  ⭐ {shop.average_rating} ({shop.total_reviews} reviews)
                </div>
              )}
            </div>
          </div>
          {shop.best_discount_label && (
            <div style={{
              background: '#fff7ed', border: '1px solid #fed7aa',
              borderRadius: 6, padding: '4px 8px', marginBottom: 8,
              fontSize: 12, color: '#ea580c', fontWeight: 700,
            }}>
              🎉 {shop.best_discount_label}
            </div>
          )}
          <button
            onClick={() => navigate(`/shop/${shop.id}`)}
            style={{
              width: '100%', padding: '8px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg,#f97316,#ea580c)',
              color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            View Menu →
          </button>
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
      try { await scannerRef.current.stop(); } catch {}
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
        () => {}
      );
      setIsScannerStarted(true);
    } catch (err: any) {
      setScanError(err?.message || 'Camera access denied. Please allow camera permissions.');
    }
  }, [navigate]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
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
      shops.forEach(s => {
        if (s.latitude && s.longitude) {
          const d = haversineKm(userLocation[0], userLocation[1], s.latitude, s.longitude);
          if (d < minDistance) {
            minDistance = d;
            nearestShop = s;
          }
        }
      });
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
        justifyContent: 'center', padding: '24px 20px', position: 'relative', overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        {/* Radial glow blobs */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 20% 50%, #f9731618 0%, transparent 60%), radial-gradient(ellipse at 80% 30%, #7c3aed18 0%, transparent 60%)',
        }} />

        {/* Floating food emoji particles */}
        <style>{`
          @keyframes sd-float {
            0%   { transform: translateY(110vh) rotate(0deg);   opacity: 0; }
            8%   { opacity: 0.13; }
            92%  { opacity: 0.13; }
            100% { transform: translateY(-15vh) rotate(360deg); opacity: 0; }
          }
          @keyframes badge-pulse {
            0%, 100% { transform: scale(1);    box-shadow: 0 16px 40px rgba(249,115,22,.4); }
            50%       { transform: scale(1.06); box-shadow: 0 24px 60px rgba(249,115,22,.6); }
          }
          @keyframes scan-beam {
            0%, 100% { top: 18%; }
            50%       { top: 78%; }
          }
        `}</style>
        {['🍕','🍔','🍜','🍣','🥗','🍦','🍛','🥘'].map((e, i) => (
          <span key={i} style={{
            position: 'absolute', fontSize: `${20 + (i % 3) * 8}px`,
            left: `${8 + i * 11}%`,
            animation: `sd-float ${4 + (i % 3)}s linear infinite`,
            animationDelay: `${i * 0.5}s`,
            userSelect: 'none', pointerEvents: 'none',
          }}>{e}</span>
        ))}

        {/* Logo badge */}
        <div style={{
          width: 72, height: 72, borderRadius: 24, marginBottom: 24,
          background: 'linear-gradient(135deg, #f97316, #f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 16px 40px rgba(249,115,22,.45)',
          animation: 'badge-pulse 3s ease-in-out infinite', position: 'relative', zIndex: 1,
        }}>
          <UtensilsCrossed size={32} color="white" />
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

        {/* CTA grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16, width: '100%', maxWidth: 500, marginBottom: 40, position: 'relative', zIndex: 1,
        }}>
          {/* Scan QR */}
          <button
            id="btn-scan-qr"
            onClick={() => setMode('scanner')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              padding: '28px 20px', borderRadius: 24, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              boxShadow: '0 12px 40px rgba(249,115,22,.45)',
              transition: 'transform .2s, box-shadow .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div style={{
              width: 60, height: 60, borderRadius: 16,
              background: 'rgba(255,255,255,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <QrCode size={34} color="white" />
            </div>
            <span style={{ color: 'white', fontSize: '1.1rem', fontWeight: 800 }}>Scan QR Code</span>
            <span style={{ color: 'rgba(255,255,255,.65)', fontSize: '.75rem', textAlign: 'center' }}>
              Point camera at a restaurant's QR
            </span>
            <ArrowRight size={18} color="rgba(255,255,255,.7)" style={{ marginTop: 2 }} />
          </button>

          {/* Choose Store */}
          <button
            id="btn-choose-store"
            onClick={() => setMode('map')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              padding: '28px 20px', borderRadius: 24, border: '1px solid rgba(255,255,255,.15)',
              cursor: 'pointer', background: 'rgba(255,255,255,.08)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,.3)',
              transition: 'transform .2s, box-shadow .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div style={{
              width: 60, height: 60, borderRadius: 16,
              background: 'rgba(249,115,22,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MapPin size={34} color="#fb923c" />
            </div>
            <span style={{ color: 'white', fontSize: '1.1rem', fontWeight: 800 }}>Choose Store</span>
            <span style={{ color: 'rgba(255,255,255,.65)', fontSize: '.75rem', textAlign: 'center' }}>
              Browse map, filter by deals & rating
            </span>
            <ArrowRight size={18} color="rgba(255,255,255,.7)" style={{ marginTop: 2 }} />
          </button>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          {[
            { icon: <Tag size={13} color="#fb923c" />, text: 'Best Discounts' },
            { icon: <Star size={13} className="fill-amber-400 text-amber-400" />, text: 'Top Rated' },
            { icon: <Navigation size={13} color="#60a5fa" />, text: 'Nearby Stores' },
            { icon: <span style={{ fontSize: 13 }}>🗺️</span>, text: 'Free Map (OpenStreetMap)' },
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
                <Popup>📍 You are here</Popup>
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
              { id: 'deals',   label: '🔥 Best Deals' },
              { id: 'rating',  label: '⭐ Top Rated'  },
              { id: 'nearest', label: '📍 Nearest'    },
            ] as { id: SortMode; label: string }[]).map(tab => (
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
                border: '1px solid #fed7aa',
              }}>
                🎉 {filteredShops.filter(s => s.active_discounts_count > 0).length} with offers
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
                <div style={{ fontSize: 40, marginBottom: 10 }}>🍽️</div>
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
                        : '🍽️'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 2 }}>
                        <span style={{
                          fontWeight: 700, fontSize: '.875rem', color: '#1e293b',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{shop.name}</span>
                        {shop.active_discounts_count > 0 && (
                          <span style={{
                            flexShrink: 0, fontSize: '.65rem', fontWeight: 800,
                            padding: '2px 6px', borderRadius: 100,
                            background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa',
                          }}>
                            {shop.active_discounts_count} offer{shop.active_discounts_count > 1 ? 's' : ''}
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

                    {/* Go button */}
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
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
