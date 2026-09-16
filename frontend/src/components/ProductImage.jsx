import { useEffect, useState } from 'react';
import ProductImagePlaceholder from './ProductImagePlaceholder';
import { getProductImage } from '../services/productService';

const imageCache = new Map();

async function loadProductImage(productId) {
    if (!productId) return null;

    if (!imageCache.has(productId)) {
        imageCache.set(productId, getProductImage(productId).catch(() => null));
    }

    return imageCache.get(productId);
}

export default function ProductImage({
    src,
    productId,
    alt = '',
    className = '',
    imageClassName = '',
    placeholderClassName = '',
    showBlur = false,
    loadingLabel = 'טוען תמונה'
}) {
    const [resolvedSrc, setResolvedSrc] = useState(src || '');
    const [status, setStatus] = useState(src || productId ? 'loading' : 'empty');

    useEffect(() => {
        let isCancelled = false;

        if (src) {
            setResolvedSrc(src);
            setStatus('loading');
            return () => {
                isCancelled = true;
            };
        }

        if (!productId) {
            setResolvedSrc('');
            setStatus('empty');
            return () => {
                isCancelled = true;
            };
        }

        setResolvedSrc('');
        setStatus('loading');
        loadProductImage(productId).then((imageUrl) => {
            if (isCancelled) return;
            setResolvedSrc(imageUrl || '');
            setStatus(imageUrl ? 'loading' : 'empty');
        });

        return () => {
            isCancelled = true;
        };
    }, [src, productId]);

    if (!resolvedSrc && status === 'loading') {
        return (
            <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
                <ProductImagePlaceholder className={`absolute inset-0 ${placeholderClassName}`} />
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/45 backdrop-blur-[1px] text-[#526f52]">
                    <span className="w-6 h-6 rounded-full border-2 border-[#526f52]/25 border-t-[#526f52] animate-spin" />
                    <span className="text-[10px] font-bold">{loadingLabel}</span>
                </div>
            </div>
        );
    }

    if (!resolvedSrc || status === 'empty' || status === 'error') {
        return <ProductImagePlaceholder className={placeholderClassName || className} />;
    }

    const isLoaded = status === 'loaded';

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
            {!isLoaded && (
                <>
                    <ProductImagePlaceholder className={`absolute inset-0 ${placeholderClassName}`} />
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/45 backdrop-blur-[1px] text-[#526f52]">
                        <span className="w-6 h-6 rounded-full border-2 border-[#526f52]/25 border-t-[#526f52] animate-spin" />
                        <span className="text-[10px] font-bold">{loadingLabel}</span>
                    </div>
                </>
            )}

            {showBlur && (
                <img
                    src={resolvedSrc}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 w-full h-full object-cover opacity-20 blur-sm scale-110 pointer-events-none mix-blend-multiply transition-opacity duration-300 ${isLoaded ? '' : 'opacity-0'}`}
                />
            )}

            <img
                src={resolvedSrc}
                alt={alt}
                loading="lazy"
                decoding="async"
                onLoad={() => setStatus('loaded')}
                onError={() => setStatus('error')}
                className={`${imageClassName} transition-opacity duration-300 ${isLoaded ? '' : 'opacity-0'}`}
            />
        </div>
    );
}
