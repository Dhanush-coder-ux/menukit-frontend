import { useEffect } from 'react';

export function GoogleTranslate() {
  useEffect(() => {
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);

      (window as any).googleTranslateElementInit = () => {
        new (window as any).google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            autoDisplay: false,
          },
          'google_translate_element'
        );
      };
    }
  }, []);

  return (
    <div className="hidden">
      <div id="google_translate_element"></div>
      <style>{`
        /* Hide all forms of the Google Translate top banner */
        .goog-te-banner-frame,
        iframe.goog-te-banner-frame,
        #goog-gt-tt,
        .goog-te-balloon-frame,
        div#goog-gt-tt,
        .VIpgJd-ZVi9od-ORHb-OEVmcd,
        .VIpgJd-ZVi9od-aZ2wEe-wOHMyf {
          display: none !important;
          visibility: hidden !important;
        }
        
        /* Google injects the banner directly into the body */
        body > .skiptranslate {
          display: none !important;
        }

        .goog-text-highlight {
          background: none !important;
          box-shadow: none !important;
        }

        /* Prevent body from shifting down */
        body {
          top: 0 !important;
          position: static !important;
        }
      `}</style>
    </div>
  );
}
