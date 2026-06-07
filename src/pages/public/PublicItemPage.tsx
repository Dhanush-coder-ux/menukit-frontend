import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ChevronLeft, Star, Loader2, Send } from 'lucide-react';
import { api } from '@/services/api';
import { Shop, MenuItem, ReviewSummary, Discount } from '@/types';
import { Lightbox } from '@/components/ui/Lightbox';
import { Skeleton } from '@/components/ui/Skeleton';

const PRESET_TIMINGS: Record<string, string> = {
  'Early Morning': '(04:00 - 08:00)',
  'Morning': '(08:00 - 12:00)',
  'Afternoon': '(12:00 - 16:00)',
  'Evening': '(16:00 - 20:00)',
  'Night': '(20:00 - 00:00)',
  'Mid-night': '(00:00 - 04:00)'
};

export function PublicItemPage() {
  const { id, itemId } = useParams();
  const navigate = useNavigate();

  const [shop, setShop] = useState<Shop | null>(null);
  const [item, setItem] = useState<MenuItem | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Interaction state
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState<number[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Reviews state
  const [reviewsSummary, setReviewsSummary] = useState<ReviewSummary | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewName, setReviewName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    setSelectedVariantIdx(0);
    setSelectedAddons([]);
    const fetchData = async () => {
      try {
        const [shopRes, itemRes, discountsRes] = await Promise.all([
          api.get(`/public/shop/${id}`),
          api.get(`/public/shop/${id}/items/${itemId}`),
          api.get(`/public/shop/${id}/discounts`)
        ]);
        setShop(shopRes.data);
        setItem(itemRes.data);
        setDiscounts(discountsRes.data);
      } catch (err) {
        console.error('Failed to load item page', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (id && itemId) fetchData();
  }, [id, itemId]);

  useEffect(() => {
    if (id && itemId) {
      api.get(`/public/shop/${id}/items/${itemId}/reviews`)
        .then(res => setReviewsSummary(res.data))
        .catch(() => setReviewsSummary({ average_rating: 0, total_reviews: 0, rating_distribution: {}, reviews: [] }))
        .finally(() => setIsLoadingReviews(false));
    }
  }, [id, itemId]);

  const handleSubmitReview = async () => {
    if (!item || reviewRating === 0 || !id) return;
    setIsSubmittingReview(true);
    try {
      await api.post(`/public/shop/${id}/items/${item.id}/reviews`, {
        rating: reviewRating,
        reviewer_name: reviewName.trim() || null,
        comment: reviewComment.trim() || null,
      });
      setReviewSubmitted(true);
      const res = await api.get(`/public/shop/${id}/items/${item.id}/reviews`);
      setReviewsSummary(res.data);
      setReviewRating(0);
      setReviewName('');
      setReviewComment('');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to submit review.';
      alert(msg);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col p-4">
        <Skeleton className="h-64 w-full rounded-2xl mb-4" />
        <Skeleton className="h-8 w-2/3 mb-2" />
        <Skeleton className="h-4 w-1/3 mb-6" />
        <Skeleton className="h-12 w-full rounded-xl mb-4" />
        <Skeleton className="h-12 w-full rounded-xl mb-4" />
      </div>
    );
  }

  if (!shop || !item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2 text-slate-800 dark:text-slate-100">Item not found</h2>
          <button 
            onClick={() => navigate(`/shop/${id}`)}
            className="text-primary hover:underline"
          >
            Return to Menu
          </button>
        </div>
      </div>
    );
  }

  const { theme, settings } = shop;
  const isDark = theme?.theme === 'dark';
  const primaryColor = theme?.primary_color || '#ea580c';

  return (
    <div className={`min-h-screen pb-20 ${isDark ? 'dark bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'}`}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 p-4 flex items-center gap-3">
        <button 
          onClick={() => navigate(`/shop/${id}`)}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold truncate text-lg">{item.name}</h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-white dark:bg-slate-950">
        {/* Images */}
        {item.images && item.images.length > 0 ? (
          <div className="mb-6">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 relative group cursor-pointer" onClick={() => setLightboxImage(item.images[0].image_url)}>
              <img 
                src={item.images[0].image_url} 
                alt={item.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            {item.images.length > 1 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-2 snap-x hide-scrollbar">
                {item.images.slice(1).map((img, idx) => (
                  <div 
                    key={idx}
                    className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 snap-start cursor-pointer border border-slate-200"
                    onClick={() => setLightboxImage(img.image_url)}
                  >
                    <img 
                      src={img.thumbnail_url || img.image_url} 
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : item.image_url ? (
          <div className="mb-6 aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 relative group cursor-pointer" onClick={() => setLightboxImage(item.image_url)}>
            <img 
              src={item.image_url} 
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ) : null}

        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h2 className="text-2xl font-bold font-heading leading-tight">{item.name}</h2>
            {item.food_type && item.food_type !== 'drink' && (
              <div 
                className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center shrink-0 ${item.food_type === 'veg' ? 'border-green-600' : item.food_type === 'non-veg' ? 'border-red-600' : 'border-yellow-600'}`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${item.food_type === 'veg' ? 'bg-green-600' : item.food_type === 'non-veg' ? 'bg-red-600' : 'bg-yellow-600'}`} />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold" style={{ color: primaryColor }}>
              {(() => {
                let basePrice = 0;
                if (item.variants && item.variants.length > 0) {
                  const v = item.variants[selectedVariantIdx];
                  basePrice = Number(v.offer_price || v.price);
                } else {
                  basePrice = Number(item.offer_price || item.price);
                }
                
                let isDiscounted = false;
                let originalPrice = item.variants && item.variants.length > 0 ? Number(item.variants[selectedVariantIdx].price) : Number(item.price);

                if (!item.offer_price && (!item.variants || !item.variants.length || !item.variants[selectedVariantIdx].offer_price)) {
                  const disc = discounts.find(d => {
                    if (d.applies_to === 'all') return true;
                    if (d.applies_to === 'category' && d.target_ids?.includes(item.category_id)) return true;
                    if (d.applies_to === 'items' && d.target_ids?.includes(item.id)) return true;
                    return false;
                  });
                  if (disc) {
                    const v = Number(disc.discount_value);
                    basePrice = disc.discount_type === 'percentage'
                      ? basePrice * (1 - v / 100)
                      : Math.max(0, basePrice - v);
                    isDiscounted = true;
                  }
                } else {
                  isDiscounted = true;
                }

                let addonsTotal = 0;
                if (item.addons) {
                  selectedAddons.forEach(idx => {
                    addonsTotal += Number(item.addons![idx].price);
                  });
                }
                basePrice += addonsTotal;
                originalPrice += addonsTotal;

                return (
                  <div className="flex items-center gap-2">
                    {settings?.currency || '₹'}{basePrice.toFixed(2).replace(/\.00$/, '')}
                    {(settings?.show_offers && isDiscounted) && (
                      <span className="text-sm text-slate-400 line-through font-normal">
                        {settings?.currency || '₹'}{originalPrice}
                      </span>
                    )}
                  </div>
                );
              })()}
            </span>
          </div>
        </div>

        {((item.available_days && item.available_days.length > 0) || (item.available_time_presets && item.available_time_presets.length > 0) || (item.custom_time_from && item.custom_time_to)) && (
          <div className="mb-6 flex flex-wrap gap-2">
            {item.available_days && item.available_days.length > 0 && (
              <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md shadow-sm">
                Available: {item.available_days.length === 7 ? 'Everyday' : item.available_days.join(', ')}
              </span>
            )}
            {item.available_time_presets && item.available_time_presets.length > 0 && (
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md shadow-sm">
                Timing: {item.available_time_presets.map(p => `${p} ${PRESET_TIMINGS[p] || ''}`).join(', ')}
              </span>
            )}
            {(item.custom_time_from && item.custom_time_to) && (
              <span className="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-md shadow-sm">
                Hours: {item.custom_time_from} - {item.custom_time_to}
              </span>
            )}
          </div>
        )}

        {item.variants && item.variants.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-sm mb-3 text-slate-700 dark:text-slate-300">Portion Size</h3>
            <div className="grid grid-cols-2 gap-2">
              {item.variants.map((variant, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedVariantIdx(idx)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all text-left flex flex-col justify-between h-full ${selectedVariantIdx === idx ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 dark:border-slate-800 hover:border-primary/50'}`}
                  style={selectedVariantIdx === idx ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
                >
                  <span className={selectedVariantIdx === idx ? 'font-semibold' : ''}>{variant.name}</span>
                  <span className="text-xs opacity-70 mt-1">
                    {settings?.currency || '₹'}{variant.offer_price || variant.price}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {item.addons && item.addons.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-sm mb-3 text-slate-700 dark:text-slate-300">Add-ons</h3>
            <div className="grid grid-cols-2 gap-2">
              {item.addons.map((addon, idx) => {
                const isSelected = selectedAddons.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedAddons(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                    className={`p-3 rounded-xl border text-sm font-medium flex justify-between items-center transition-all ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 dark:border-slate-800 hover:border-primary/50 bg-slate-50 dark:bg-slate-900/50'}`}
                    style={isSelected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
                  >
                    <span className={isSelected ? 'font-semibold' : 'text-slate-700 dark:text-slate-300'}>{addon.name}</span>
                    <span className="text-xs font-bold" style={{ color: primaryColor }}>
                      +{settings?.currency || '₹'}{addon.price}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {item.description && (
          <div className="mb-8">
            <h3 className="font-semibold text-sm mb-2 text-slate-700 dark:text-slate-300">About this dish</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.description}</p>
          </div>
        )}

        {/* ── Reviews Section ── */}
        <div className="mt-10 border-t border-slate-100 dark:border-slate-800 pt-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Customer Reviews</h3>
            {reviewsSummary && reviewsSummary.total_reviews > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={16} className={s <= Math.round(reviewsSummary.average_rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700 fill-slate-200 dark:fill-slate-700'} />
                  ))}
                </div>
                <span className="text-base font-bold text-amber-600">{reviewsSummary.average_rating.toFixed(1)}</span>
                <span className="text-sm text-slate-400">({reviewsSummary.total_reviews})</span>
              </div>
            )}
          </div>

          {isLoadingReviews ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-slate-300" size={24} />
            </div>
          ) : reviewsSummary ? (
            <>
              {/* Rating distribution */}
              {reviewsSummary.total_reviews > 0 && (
                <div className="space-y-2 mb-8">
                  {[5,4,3,2,1].map(star => {
                    const count = reviewsSummary.rating_distribution[star] || 0;
                    const pct = reviewsSummary.total_reviews ? Math.round((count / reviewsSummary.total_reviews) * 100) : 0;
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <span className="text-sm w-4 font-medium text-slate-600 dark:text-slate-400">{star}</span>
                        <Star size={12} className="fill-amber-400 text-amber-400 shrink-0" />
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: primaryColor }} />
                        </div>
                        <span className="text-sm text-slate-500 w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reviews List */}
              {reviewsSummary.reviews.length > 0 && (
                <div className="space-y-4 mb-8">
                  {reviewsSummary.reviews.map(rev => (
                    <div key={rev.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{rev.reviewer_name}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} size={12} className={s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700 fill-slate-200 dark:fill-slate-700'} />
                            ))}
                          </div>
                          <span className="text-xs text-slate-400">{rev.created_at}</span>
                        </div>
                      </div>
                      {rev.comment && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{rev.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {reviewsSummary.total_reviews === 0 && (
                <p className="text-sm text-slate-500 text-center py-6">Be the first to review this dish!</p>
              )}

              {/* Submit review form */}
              {!reviewSubmitted ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-5 sm:p-6 mt-4">
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">How was your meal?</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Share your experience to help others</p>

                  <div className="flex items-center gap-2 mb-6">
                    {[1,2,3,4,5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setReviewHover(star)}
                        onMouseLeave={() => setReviewHover(0)}
                        className="transition-transform hover:scale-110 active:scale-95 outline-none"
                      >
                        <Star
                          size={36}
                          className={`transition-all duration-200 ${
                            star <= (reviewHover || reviewRating)
                              ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_4px_rgba(251,191,36,0.3)]'
                              : 'text-slate-200 dark:text-slate-800 fill-slate-100 dark:fill-slate-800'
                          }`}
                        />
                      </button>
                    ))}
                    {reviewRating > 0 && (
                      <span className="ml-3 text-sm font-bold animate-in fade-in slide-in-from-left-2 text-amber-500">
                        {['','Terrible','Poor','Okay','Good','Excellent!'][reviewRating]}
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Your name (optional)"
                      value={reviewName}
                      onChange={e => setReviewName(e.target.value)}
                      className="w-full text-base px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-4 transition-all text-slate-900 dark:text-slate-100"
                      style={reviewName ? { borderBottomColor: primaryColor } : {}}
                      maxLength={60}
                    />
                    <textarea
                      placeholder="What did you think of this dish? (optional)"
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      className="w-full text-base px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:ring-4 resize-none transition-all text-slate-900 dark:text-slate-100"
                      style={reviewComment ? { borderBottomColor: primaryColor } : {}}
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                  <button
                    onClick={handleSubmitReview}
                    disabled={reviewRating === 0 || isSubmittingReview}
                    className="w-full mt-6 py-4 rounded-xl text-white text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-[0.98]"
                    style={reviewRating > 0 ? { backgroundColor: primaryColor, boxShadow: `0 4px 14px 0 ${primaryColor}40` } : { backgroundColor: '#cbd5e1' }}
                  >
                    {isSubmittingReview ? (
                      <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                    ) : (
                      <><Send size={18} /> Submit Review</>
                    )}
                  </button>
                </div>
              ) : (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 text-center mt-4">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="text-base font-bold text-green-700 dark:text-green-400">Thank you for your review!</p>
                  <p className="text-sm text-green-600 dark:text-green-500 mt-2">Your feedback helps others make better choices.</p>
                  <button
                    onClick={() => { setReviewSubmitted(false); setReviewRating(0); }}
                    className="mt-4 text-sm font-semibold text-green-700 dark:text-green-400 hover:underline"
                  >
                    Write another review
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <Lightbox isOpen={!!lightboxImage} onClose={() => setLightboxImage(null)} imageUrl={lightboxImage || ''} />
    </div>
  );
}
