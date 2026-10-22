"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { GlobeMethods } from 'react-globe.gl';
import { LAND_BITS, LAND_STEP } from '@/lib/land';

// Dynamically import Globe to avoid SSR issues
const Globe = React.lazy(() => import('react-globe.gl'));

const nodes = [
    // Europe (kept minimal)
    { lat: 52.5200, lng: 13.4050, name: 'Berlin' },
    { lat: 51.5074, lng: -0.1278, name: 'London' },

    // North America
    { lat: 40.7128, lng: -74.0060, name: 'New York' },
    { lat: 34.0522, lng: -118.2437, name: 'Los Angeles' },
    { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
    { lat: 19.4326, lng: -99.1332, name: 'Mexico City' },

    // South America
    { lat: -23.5505, lng: -46.6333, name: 'Sao Paulo' },
    { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires' },
    { lat: -12.0464, lng: -77.0428, name: 'Lima' },
    { lat: -33.4489, lng: -70.6693, name: 'Santiago' },
    { lat: 4.7110, lng: -74.0721, name: 'Bogota' },

    // Africa
    { lat: 6.5244, lng: 3.3792, name: 'Lagos' },
    { lat: 30.0444, lng: 31.2357, name: 'Cairo' },
    { lat: -1.2921, lng: 36.8219, name: 'Nairobi' },
    { lat: -26.2041, lng: 28.0473, name: 'Johannesburg' },
    { lat: 5.6037, lng: -0.1870, name: 'Accra' },

    // Russia and wider Eurasia
    { lat: 55.7558, lng: 37.6173, name: 'Moscow' },
    { lat: 55.0084, lng: 82.9357, name: 'Novosibirsk' },
    { lat: 43.1198, lng: 131.8869, name: 'Vladivostok' },
    { lat: 62.0355, lng: 129.6755, name: 'Yakutsk' },

    // Asia-Pacific
    { lat: 35.6895, lng: 139.6917, name: 'Tokyo' },
    { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
    { lat: 39.9042, lng: 116.4074, name: 'Beijing' },
    { lat: 28.6139, lng: 77.2090, name: 'New Delhi' },
    { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
    { lat: 25.2048, lng: 55.2708, name: 'Dubai' }
];

// helper haversine
const toRad = (deg:number)=>deg*Math.PI/180;
const distance = (a:{lat:number,lng:number}, b:{lat:number,lng:number})=>{
  const R=6371;
  const dLat=toRad(b.lat-a.lat);
  const dLng=toRad(b.lng-a.lng);
  const lat1=toRad(a.lat); const lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
};

// Precompute 3 nearest neighbors per node
const neighborMap = nodes.map((n,i)=>{
  const dists = nodes.map((m,j)=>({j,dist:i===j?Infinity:distance(n,m)}));
  dists.sort((x,y)=>x.dist-y.dist);
  return dists.slice(0,3).map(d=>d.j);
});

// Equirectangular texture: dark sphere with a faint dot per land cell.
const landTexture = () => {
    const cols = 360 / LAND_STEP, rows = 180 / LAND_STEP, cell = 12;
    const canvas = document.createElement('canvas');
    canvas.width = cols * cell;
    canvas.height = rows * cell;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(242, 242, 240, 0.22)';
    const bits = atob(LAND_BITS);
    for (let i = 0; i < cols * rows; i++) {
        if (!(bits.charCodeAt(i >> 3) & (1 << (i & 7)))) continue;
        ctx.beginPath();
        ctx.arc((i % cols + 0.5) * cell, (Math.floor(i / cols) + 0.5) * cell, cell * 0.28, 0, Math.PI * 2);
        ctx.fill();
    }
    return canvas.toDataURL('image/png');
};

type Arc = { startLat: number; startLng: number; endLat: number; endLng: number; color: string; t: number };

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const InteractiveGlobe = ({ onReady }: { onReady?: () => void }) => {
    const globeRef = useRef<GlobeMethods | undefined>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dims, setDims] = useState({ width: 0, height: 0 });
    const [arcsData, setArcsData] = useState<Arc[]>([]);
    const [still] = useState(prefersReducedMotion);
    const texture = useMemo(landTexture, []);

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                setDims({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    useEffect(() => {
        // Apply settings only once when component mounts
        const applyGlobeSettings = () => {
            if (globeRef.current) {
                globeRef.current.controls().autoRotate = !still;
                globeRef.current.controls().autoRotateSpeed = 1;
                globeRef.current.controls().enableZoom = false;
                globeRef.current.controls().enablePan = true;
                globeRef.current.controls().enableRotate = true;
                globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2 });
            }
        };

        // Apply settings after a short delay to ensure globe is ready
        const timer = setTimeout(applyGlobeSettings, 500);
        
        return () => clearTimeout(timer);
    }, [still]);

    useEffect(() => {
          const KEEP = 12000;
          
          // Function to generate arcs
          const generateArcs = () => {
              const now = Date.now();
              setArcsData(prev => prev.filter(a => (now - a.t) < KEEP));
  
              // activate only 4-5 nodes per cycle
              const activeCount = Math.floor(Math.random() * 2) + 4; // 4-5 nodes
              const activeNodes = [...Array(nodes.length).keys()].sort(()=>Math.random()-0.5).slice(0,activeCount);
              
              const newA: Arc[] = [];
              activeNodes.forEach(srcIdx => {
                  const src = nodes[srcIdx];
                  const viable = nodes.map((n,i)=>({i,d:distance(src,n)})).filter(o=>o.d>1500 && o.d<8000 && o.i!==srcIdx);
                  
                  let targets:number[] = [];
                  if(viable.length){
                      // pick just 1 viable target
                      const pick = viable[Math.floor(Math.random()*viable.length)];
                      targets.push(pick.i);
                  }
                  if(targets.length===0){
                      const neigh=neighborMap[srcIdx];
                      targets=[neigh[Math.floor(Math.random()*neigh.length)]];
                  }
                  
                  targets.forEach(ti=>{
                      const d = nodes[ti];
                      newA.push({
                          startLat: src.lat, startLng: src.lng,
                          endLat: d.lat, endLng: d.lng,
                          color:'rgba(0,255,178,0.6)',
                          t:now
                      });
                  });
               });
 
              setArcsData(prev=>[...prev,...newA].slice(-30));
          };
          
          // Generate initial arcs after a short delay to ensure globe is loaded
          const timeout = setTimeout(() => {
              generateArcs();
          }, 500);
          
          // Then continue with interval
          const interval = still ? undefined : setInterval(generateArcs, 3000);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    },[still]);


    return (
        <div ref={containerRef} className="absolute inset-0 overflow-hidden">
             {dims.width > 0 && <Suspense fallback={null}><Globe
                ref={globeRef}
                width={dims.width}
                height={dims.height}
                globeImageUrl={texture}
                backgroundColor="rgba(0,0,0,0)"
                showAtmosphere={false}
                
                // Arcs
                arcsData={arcsData}
                arcColor={'color'}
                arcDashLength={0.4}
                arcDashGap={0.2}
                arcDashAnimateTime={still ? 0 : 3000}
                arcStroke={0.3}

                ringsData={still ? [] : nodes}
                ringColor={() => ['rgba(0, 255, 178, 0.6)', 'rgba(0, 255, 178, 0)']}
                ringMaxRadius={3}
                ringPropagationSpeed={2}
                ringRepeatPeriod={1000}
                
                onGlobeReady={() => {
                    if (globeRef.current) {
                        globeRef.current.controls().autoRotate = !still;
                        globeRef.current.controls().autoRotateSpeed = 1;
                        globeRef.current.controls().enableZoom = false;
                        globeRef.current.controls().enablePan = true;
                        globeRef.current.controls().enableRotate = true;
                        globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2 });
                    }
                    onReady?.();
                }}
             /></Suspense>}
        </div>
    );
};

export default InteractiveGlobe; 