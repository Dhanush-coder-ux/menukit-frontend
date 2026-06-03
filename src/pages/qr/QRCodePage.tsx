import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Download, Printer, Copy, RefreshCw, ExternalLink, QrCode, UtensilsCrossed } from 'lucide-react';
import { api } from '@/services/api';
import { useShopStore } from '@/store/shopStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { QRCodeInfo } from '@/types';


export function QRCodePage() {
  const { shop, setShop } = useShopStore();
  const [qrCode, setQrCode] = useState<QRCodeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchQRCode();
  }, []);

  const fetchQRCode = async () => {
    try {
      // Fetch shop data if user refreshed the page and store is empty
      if (!shop) {
        try {
          const shopRes = await api.get('/shops/me');
          if (shopRes.data?.id) {
            setShop(shopRes.data);
          }
        } catch (e) {
          console.error('Failed to fetch shop', e);
        }
      }

      const res = await api.get('/qr/info');
      setQrCode(res.data);
    } catch (error: any) {
      // If 404, it means QR hasn't been generated yet, which is fine
      if (error.response?.status !== 404) {
        toast.error('Failed to load QR code');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      const res = await api.post('/qr/generate');
      setQrCode(res.data);
      toast.success('QR Code generated successfully!');
    } catch (error) {
      toast.error('Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  };
  const publicLink = qrCode?.qr_url || '';

  const handleCopyLink = () => {
    if (!publicLink) return;
    navigator.clipboard.writeText(publicLink);
    toast.success('Link copied to clipboard!');
  };

  const handleDownloadPNG = async () => {
    if (!qrCode?.qr_image_url) return;
    
    const toastId = toast.loading('Generating high-quality image...');
    
    try {
      const canvas = document.createElement('canvas');
      // High-res dimensions
      canvas.width = 1200;
      canvas.height = 1500;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Helper to load images
      const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous'; // Important for CORS
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = url;
        });
      };

      // 1. Draw Background & border
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // 2. Draw Top Accent Bar
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#ea580c');
      gradient.addColorStop(1, '#f59e0b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, 24);

      let currentY = 180;

      // 3. Draw Logo
      if (shop?.logo_url) {
        try {
          const logo = await loadImage(shop.logo_url);
          ctx.save();
          ctx.beginPath();
          ctx.arc(canvas.width / 2, currentY, 120, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          // Calculate logo dimensions to cover the circle
          const scale = Math.max(240 / logo.width, 240 / logo.height);
          const x = (canvas.width / 2) - (logo.width / 2) * scale;
          const y = currentY - (logo.height / 2) * scale;
          ctx.drawImage(logo, x, y, logo.width * scale, logo.height * scale);
          ctx.restore();
          
          // Draw logo border
          ctx.beginPath();
          ctx.arc(canvas.width / 2, currentY, 120, 0, Math.PI * 2);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#e2e8f0';
          ctx.stroke();
        } catch (e) {
          console.warn('Could not load logo for canvas');
          // Draw placeholder
          ctx.beginPath();
          ctx.arc(canvas.width / 2, currentY, 120, 0, Math.PI * 2);
          ctx.fillStyle = '#f8fafc';
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#e2e8f0';
          ctx.stroke();
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 80px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🍽️', canvas.width / 2, currentY);
        }
        currentY += 180;
      } else {
        currentY = 250;
      }

      // 4. Draw Shop Name
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 84px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(shop?.name || 'Restaurant Menu', canvas.width / 2, currentY);
      currentY += 120;

      // 5. Draw Tagline
      ctx.fillStyle = '#ea580c';
      ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
      ctx.letterSpacing = '4px'; // Experimental, might not work in all browsers, so we simulate
      ctx.fillText('SCAN TO VIEW OUR DIGITAL MENU', canvas.width / 2, currentY);
      currentY += 120;

      // 6. Draw QR Code Box
      const qrBoxSize = 600;
      const qrBoxX = (canvas.width - qrBoxSize) / 2;
      const qrBoxY = currentY;
      
      // Draw rounded rect for QR background
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 40);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f1f5f9';
      ctx.stroke();

      // 7. Load and Draw QR Code
      const qrImage = await loadImage(qrCode.qr_image_url);
      const padding = 60;
      ctx.drawImage(
        qrImage, 
        qrBoxX + padding, 
        qrBoxY + padding, 
        qrBoxSize - (padding * 2), 
        qrBoxSize - (padding * 2)
      );

      // Draw Logo in center of QR
      // (Removed as per user request)

      currentY += qrBoxSize + 100;

      // 8. Draw Branding (Powered By)
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.fillText('POWERED BY', canvas.width / 2, currentY);
      currentY += 40;

      // Draw Gradient Brand Name
      const textGradient = ctx.createLinearGradient(
        canvas.width / 2 - 150, 0, 
        canvas.width / 2 + 150, 0
      );
      textGradient.addColorStop(0, '#ea580c');
      textGradient.addColorStop(1, '#f59e0b');
      ctx.fillStyle = textGradient;
      ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
      ctx.fillText('MenuKit', canvas.width / 2, currentY);
      currentY += 60;
      
      // Draw Site Link
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.fillText('menukit.debuggers.co.in/landing', canvas.width / 2, currentY);

      // 9. Export and Download
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${shop?.slug || 'menu'}-qr-poster.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success('Downloaded successfully!', { id: toastId });
    } catch (error) {
      console.error('Failed to generate image:', error);
      toast.error('Failed to generate image. Please try downloading normally.', { id: toastId });
      
      // Fallback to direct download
      const a = document.createElement('a');
      a.href = qrCode.qr_image_url;
      a.download = `${shop?.slug || 'menu'}-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handlePrint = () => {
    if (!qrCode?.qr_image_url) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const logoHtml = shop?.logo_url 
      ? `<img class="logo" src="${shop.logo_url}" alt="Logo" />`
      : `<div class="logo-placeholder">🍽️</div>`;
      
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code - ${shop?.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
            body { 
              font-family: 'Outfit', system-ui, -apple-system, sans-serif; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
              background-color: #f8fafc;
            }
            .container { 
              background: white;
              border: 3px solid #f1f5f9;
              box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
              padding: 40px; 
              border-radius: 24px; 
              width: 380px; 
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            .accent-bar {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 8px;
              background: linear-gradient(90deg, #ea580c 0%, #f59e0b 100%);
            }
            .logo { 
              width: 70px; 
              height: 70px; 
              object-fit: cover;
              border-radius: 50%;
              border: 2px solid #e2e8f0;
              margin: 10px auto 15px auto;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            .logo-placeholder {
              width: 70px;
              height: 70px;
              line-height: 70px;
              font-size: 32px;
              border-radius: 50%;
              border: 2px solid #e2e8f0;
              background-color: #f8fafc;
              margin: 10px auto 15px auto;
            }
            h1 { 
              margin: 0 0 4px 0; 
              font-size: 26px;
              font-weight: 800;
              color: #1e293b; 
            }
            .tagline { 
              color: #ea580c; 
              font-size: 11px; 
              font-weight: 800; 
              letter-spacing: 0.1em;
              text-transform: uppercase;
              margin-bottom: 25px;
            }
            .qr-wrapper {
              background-color: #f8fafc;
              padding: 20px;
              border-radius: 20px;
              border: 1px solid #f1f5f9;
              display: inline-block;
              margin-bottom: 25px;
            }
            .qr-image { 
              width: 240px; 
              height: 240px; 
              display: block;
            }
            .branding {
              margin-top: 10px;
            }
            .powered-by {
              font-size: 9px;
              font-weight: 800;
              letter-spacing: 0.15em;
              color: #94a3b8;
              text-transform: uppercase;
              margin: 0;
            }
            .brand-name {
              font-size: 14px;
              font-weight: 800;
              background: linear-gradient(90deg, #ea580c 0%, #f59e0b 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              margin: 2px 0 0 0;
            }
            .site-link {
              font-size: 9px;
              color: #94a3b8;
              text-decoration: none;
              margin-top: 4px;
              display: inline-block;
            }
            .site-link:hover {
              color: #ea580c;
            }
            @media print {
              body { background-color: white; }
              .container { box-shadow: none; border: 2px solid #e2e8f0; }
              .brand-name {
                background: none;
                -webkit-background-clip: unset;
                -webkit-text-fill-color: #ea580c;
                color: #ea580c;
              }
              .accent-bar {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="accent-bar"></div>
            ${logoHtml}
            <h1>${shop?.name}</h1>
            <div class="tagline">Scan to view our digital menu</div>
            <div class="qr-wrapper">
              <img class="qr-image" src="${qrCode.qr_image_url}" alt="QR Code" />
            </div>
            <div class="branding">
              <p class="powered-by">Powered By</p>
              <h2 class="brand-name">MenuKit</h2>
              <a href="https://menukit.debuggers.co.in/landing" class="site-link" target="_blank" rel="noopener noreferrer">menukit.debuggers.co.in/landing</a>
            </div>
          </div>
          <script>
            window.onload = () => { 
              setTimeout(() => {
                window.print(); 
                window.close(); 
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-96 mb-8" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold font-heading">QR Code Generator</h2>
        <p className="text-slate-500">Download and print your unique menu QR code.</p>
      </div>

      {!qrCode ? (
        <Card className="border-dashed text-center">
          <CardContent className="py-20 flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6">
              <QrCode className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-medium mb-2">No QR Code Generated</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
              Generate your unique QR code that customers will scan to access your digital menu.
            </p>
            <Button size="lg" onClick={generateQRCode} isLoading={isGenerating}>
              Generate QR Code
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card className="md:col-span-2 flex flex-col items-center p-8 text-center bg-white border border-slate-100 shadow-lg rounded-2xl relative overflow-hidden">
            {/* Elegant Header Accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-orange-500 to-amber-500"></div>
            
            {/* Restaurant Logo/Image */}
            <div className="w-16 h-16 rounded-full border-2 border-slate-100 overflow-hidden bg-slate-50 flex items-center justify-center mb-4 shadow-sm">
              {shop?.logo_url ? (
                <img src={shop.logo_url} alt="Restaurant Logo" className="w-full h-full object-cover" />
              ) : (
                <UtensilsCrossed className="w-8 h-8 text-slate-400" />
              )}
            </div>
            
            <h3 className="font-bold text-xl mb-1 text-slate-800">{shop?.name}</h3>
            <p className="text-xs font-semibold tracking-wider text-orange-600 uppercase mb-6">Scan to View Digital Menu</p>
            
            {/* QR Code Container */}
            <div className="bg-slate-50 p-6 rounded-2xl shadow-inner border border-slate-100 inline-block relative">
              {qrCode.qr_image_url ? (
                <img src={qrCode.qr_image_url} alt="Menu QR Code" className="w-48 h-48 sm:w-56 sm:h-56 mix-blend-multiply" />
              ) : (
                <div className="w-48 h-48 bg-slate-100 flex items-center justify-center">Error</div>
              )}
            </div>
            
            {/* Branding */}
            <div className="mt-8 flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Powered By</span>
              <span className="text-sm font-extrabold bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent mt-0.5">MenuKit</span>
              <a
                href="https://menukit.debuggers.co.in/landing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-slate-400 hover:text-orange-500 transition-colors mt-1 flex items-center gap-1"
              >
                menukit.debuggers.co.in/landing
                <ExternalLink size={8} />
              </a>
            </div>
            
            <p className="text-[10px] text-slate-400 mt-6 font-mono">
              Generated: {new Date(qrCode.created_at).toLocaleDateString()}
            </p>
          </Card>

          <div className="md:col-span-3 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Public Menu Link</CardTitle>
                <CardDescription>Direct link to your digital menu</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-xl text-sm text-slate-600 dark:text-slate-300 font-mono overflow-x-auto whitespace-nowrap border border-slate-200 dark:border-slate-700">
                    {publicLink}
                  </div>
                  <Button variant="secondary" onClick={handleCopyLink} className="shrink-0" title="Copy Link">
                    <Copy size={18} />
                  </Button>
                </div>
                <div className="mt-4 flex">
                  <Button 
                    variant="ghost" 
                    className="text-primary hover:text-primary-700 p-0 h-auto"
                    onClick={() => window.open(publicLink, '_blank')}
                    leftIcon={<ExternalLink size={16} />}
                  >
                    Open public menu in new tab
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Download & Print</CardTitle>
                <CardDescription>Export your QR code for physical display</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-row sm:flex-col gap-3 sm:gap-0 sm:space-y-3">
                <Button className="flex-1 sm:w-full sm:justify-start h-12" variant="secondary" onClick={handleDownloadPNG} title="Download PNG">
                  <Download size={20} className="sm:mr-2" />
                  <span className="hidden sm:inline">Download PNG Image (High Quality)</span>
                </Button>
                <Button className="flex-1 sm:w-full sm:justify-start h-12" variant="secondary" onClick={handlePrint} title="Print">
                  <Printer size={20} className="sm:mr-2" />
                  <span className="hidden sm:inline">Print directly from browser</span>
                </Button>
                <Button className="flex-1 sm:w-full sm:justify-start h-12 bg-slate-100 sm:bg-transparent" variant="ghost" onClick={generateQRCode} isLoading={isGenerating} title="Regenerate">
                  {!isGenerating && <RefreshCw size={20} className="sm:mr-2" />}
                  <span className="hidden sm:inline">Regenerate QR Code</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
