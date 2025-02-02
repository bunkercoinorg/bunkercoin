import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';

interface Image {
    src: string;
    alt: string;
    title?: string;
    description?: string;
    showCaption?: boolean;
}

interface GallerySlideshowProps {
    images: Image[];
    interval?: number;
    className?: string;
}

const GallerySlideshow: React.FC<GallerySlideshowProps> = ({
                                                               images,
                                                               interval = 5000,
                                                               className = '',
                                                           }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [previousIndex, setPreviousIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalIndex, setModalIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const progressInterval = useRef<number | undefined>(undefined);
    const lastUpdateTime = useRef<number>(Date.now());

    const nextSlide = useCallback((index: number) => {
        setPreviousIndex(index);
        return (index + 1) % images.length;
    }, [images.length]);

    const previousSlide = useCallback((index: number) => {
        setPreviousIndex(index);
        return (index - 1 + images.length) % images.length;
    }, [images.length]);

    // Handle progress bar and slide transitions
    useEffect(() => {
        if (isPaused || isModalOpen) {
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
                lastUpdateTime.current = Date.now();
            }
            return;
        }

        const startTime = Date.now();
        lastUpdateTime.current = startTime;

        const updateProgress = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - lastUpdateTime.current;
            const newProgress = (elapsed / interval) * 100;

            if (newProgress >= 100) {
                setCurrentIndex(prev => nextSlide(prev));
                setProgress(0);
                lastUpdateTime.current = currentTime;
            } else {
                setProgress(newProgress);
            }
        };

        progressInterval.current = window.setInterval(updateProgress, 16); // ~60fps

        return () => {
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
        };
    }, [interval, isPaused, isModalOpen, nextSlide]);

    const handleSlideChange = (newIndex: number) => {
        setCurrentIndex(newIndex);
        setProgress(0);
        lastUpdateTime.current = Date.now();
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setIsPaused(true);
        setTouchStart(e.touches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStart === null) return;

        const currentTouch = e.touches[0].clientX;
        const diff = touchStart - currentTouch;

        if (Math.abs(diff) > 50) {
            handleSlideChange(diff > 0 ? nextSlide(currentIndex) : previousSlide(currentIndex));
            setTouchStart(null);
        }
    };

    const handleTouchEnd = () => {
        setIsPaused(false);
        setTouchStart(null);
    };

    const handleImageClick = (index: number) => {
        setModalIndex(index);
        setIsModalOpen(true);
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isModalOpen) return;

        switch (e.key) {
            case 'ArrowLeft':
                setModalIndex(prev => previousSlide(prev));
                break;
            case 'ArrowRight':
                setModalIndex(prev => nextSlide(prev));
                break;
            case 'Escape':
                setIsModalOpen(false);
                break;
        }
    }, [isModalOpen, nextSlide, previousSlide]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <>
            <Card
                className={`relative overflow-hidden rounded-lg border-none border-0 group ${className}`}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="relative w-full aspect-video bg-neutral-900">
                    <div className="absolute top-0 left-0 right-0 h-0.5 rounded-full bg-neutral-800 z-10">
                        <div
                            className="h-full bg-emerald-400 rounded-full transition-transform duration-0 origin-left"
                            style={{ transform: `scaleX(${progress / 100})` }}
                        />
                    </div>

                    <div
                        className="absolute inset-0 flex transition-transform duration-700 ease-out will-change-transform"
                        style={{
                            transform: `translateX(-${currentIndex * 100}%)`,
                            transition: currentIndex === 0 && previousIndex === images.length - 1 ? 'none' :
                                currentIndex === images.length - 1 && previousIndex === 0 ? 'none' :
                                    'transform 700ms ease-out'
                        }}
                    >
                        {images.map((image, index) => (
                            <div
                                key={index}
                                className="min-w-full h-full flex-shrink-0 cursor-pointer"
                                onClick={() => handleImageClick(index)}
                            >
                                <img
                                    src={image.src}
                                    alt={image.alt}
                                    className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                                />
                                {image.showCaption && (image.title || image.description) && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-4 transform transition-transform duration-300">
                                        {image.title && (
                                            <h3 className="text-lg font-semibold mb-1">{image.title}</h3>
                                        )}
                                        {image.description && (
                                            <p className="text-sm text-neutral-200">{image.description}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSlideChange(previousSlide(currentIndex));
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Previous slide"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSlideChange(nextSlide(currentIndex));
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Next slide"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </button>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {images.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => handleSlideChange(index)}
                                className={`w-2 h-2 rounded-full transition-colors ${
                                    index === currentIndex ? 'bg-white scale-125' : 'bg-white/50'
                                }`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[90vw] h-[90vh] p-0 bg-neutral-900 overflow-hidden [&>button]:hidden border-0">
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute right-4 top-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>

                        <div className="absolute inset-y-0 left-0 right-0 pointer-events-none">
                            <div className="h-full flex items-center justify-between px-4">
                                <button
                                    onClick={() => setModalIndex(prev => previousSlide(prev))}
                                    className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-50 pointer-events-auto"
                                    aria-label="Previous image"
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </button>

                                <button
                                    onClick={() => setModalIndex(prev => nextSlide(prev))}
                                    className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-50 pointer-events-auto"
                                    aria-label="Next image"
                                >
                                    <ChevronRight className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        <div className="w-full max-h-[90vh] overflow-hidden flex items-center justify-center">
                            <img
                                src={images[modalIndex].src}
                                alt={images[modalIndex].alt}
                                className="w-full h-full object-contain object-center"
                            />
                        </div>

                        {images[modalIndex].showCaption && (images[modalIndex].title || images[modalIndex].description) && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-4">
                                {images[modalIndex].title && (
                                    <h3 className="text-xl font-semibold mb-2">{images[modalIndex].title}</h3>
                                )}
                                {images[modalIndex].description && (
                                    <p className="text-neutral-200">{images[modalIndex].description}</p>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

const LandingGallerySlideshow: React.FC = () => {
    const landingImages: Image[] = Array.from({ length: 16 }, (_, i) => ({
        src: `/img/slider/${i + 1}.jpg`,
        alt: "",
        showCaption: false
    }));

    return (
        <div className="w-full mt-6">
            <GallerySlideshow images={landingImages} interval={5000} />
        </div>
    );
};

export default LandingGallerySlideshow;