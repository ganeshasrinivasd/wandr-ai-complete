'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Compass, Loader2, Sparkles } from 'lucide-react';

const agents = [
  {
    id: 'parser',
    name: 'Parser',
    description: 'Validating input',
    icon: '◇',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Finding venues',
    icon: '◈',
  },
  {
    id: 'optimizer',
    name: 'Optimizer',
    description: 'Building itinerary',
    icon: '⬡',
  },
  {
    id: 'storyteller',
    name: 'Storyteller',
    description: 'Writing narrative',
    icon: '✦',
  },
];

const backgroundImages = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=2400&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=2400&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=2400&q=80',
];

function GeneratingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<string[]>([]);
  const [bgIndex, setBgIndex] = useState(0);
  const [agentStatus, setAgentStatus] = useState<Record<string, string>>({
    parser: 'waiting',
    researcher: 'waiting',
    optimizer: 'waiting',
    storyteller: 'waiting',
  });
  const [planId, setPlanId] = useState<string | null>(null);
  const [destination, setDestination] = useState<string>('');

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (!dataParam) {
      router.push('/planner');
      return;
    }

    try {
      const planInput = JSON.parse(dataParam);
      setDestination(planInput.destination || '');
      generatePlan(planInput);
    } catch (e) {
      router.push('/planner');
    }
  }, [searchParams, router]);

  const generatePlan = async (planInput: any) => {
    try {
      const response = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planInput),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.agent) {
                  setAgentStatus((prev) => ({
                    ...prev,
                    [data.agent]: data.status,
                  }));
                }

                if (data.message) {
                  setLogs((prev) => [...prev.slice(-50), data.message]);
                }

                if (data.planId) {
                  setPlanId(data.planId);
                  setTimeout(() => {
                    router.push(`/plan/${data.planId}`);
                  }, 2000);
                }
              } catch (e) {
                console.error('Parse error:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Generation error:', error);
      setLogs((prev) => [...prev, `Error: ${error}`]);
    }
  };

  const completedCount = Object.values(agentStatus).filter(
    (s) => s === 'complete'
  ).length;
  const progress = (completedCount / 4) * 100;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <AnimatePresence mode="sync">
        <motion.div
          key={bgIndex}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundImages[bgIndex]})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/85 to-purple-900/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
        </motion.div>
      </AnimatePresence>

      {/* Floating Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
            top: '5%',
            left: '5%',
          }}
          animate={{
            x: [0, 80, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)',
            bottom: '10%',
            right: '5%',
          }}
          animate={{
            x: [0, -60, 0],
            y: [0, -70, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
            top: '40%',
            right: '25%',
          }}
          animate={{
            x: [0, 40, 0],
            y: [0, -40, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/20"
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: typeof window !== 'undefined' ? window.innerHeight + 10 : 1000,
            }}
            animate={{
              y: -10,
              x: `+=${Math.random() * 100 - 50}`,
            }}
            transition={{
              duration: Math.random() * 15 + 10,
              repeat: Infinity,
              ease: 'linear',
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <nav className="flex items-center justify-center px-8 py-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <Compass className="w-7 h-7 text-purple-400" />
            <span className="text-xl font-light tracking-[0.3em] text-white">WANDR</span>
          </motion.div>
        </nav>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-8">
          <div className="max-w-3xl w-full">
            {/* Glass Card Container */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-6 md:p-10 shadow-2xl"
            >
              {/* Title */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-purple-300">Creating your trip</span>
                </motion.div>
                <h1 className="text-2xl md:text-3xl font-light text-white mb-2">
                  {planId ? (
                    'Your journey awaits'
                  ) : (
                    <>
                      Crafting your <span className="text-purple-400">{destination}</span> adventure
                    </>
                  )}
                </h1>
                <p className="text-white/50 text-sm">
                  {planId
                    ? 'Redirecting to your personalized itinerary...'
                    : 'AI agents are working together to create your perfect trip'}
                </p>
              </div>

              {/* Progress bar */}
              <div className="mb-8">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 bg-[length:200%_100%]"
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${progress}%`,
                      backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'],
                    }}
                    transition={{ 
                      width: { duration: 0.5, ease: 'easeOut' },
                      backgroundPosition: { duration: 3, repeat: Infinity, ease: 'linear' }
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-white/40">
                  <span>{completedCount}/4 agents complete</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>

              {/* Agent cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {agents.map((agent, index) => {
                  const status = agentStatus[agent.id];
                  const isActive = status === 'running';
                  const isComplete = status === 'complete';

                  return (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className={`relative p-4 rounded-xl border backdrop-blur-sm transition-all duration-500 ${
                        isComplete
                          ? 'bg-green-500/10 border-green-400/30'
                          : isActive
                          ? 'bg-purple-500/15 border-purple-400/40 scale-[1.02]'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-xl transition-colors duration-500 ${
                            isComplete
                              ? 'text-green-400'
                              : isActive
                              ? 'text-purple-400'
                              : 'text-white/30'
                          }`}
                        >
                          {agent.icon}
                        </span>

                        {isComplete && (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        )}
                        {isActive && (
                          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                        )}
                      </div>

                      <h3
                        className={`text-sm font-medium mb-0.5 transition-colors duration-500 ${
                          isComplete || isActive ? 'text-white' : 'text-white/50'
                        }`}
                      >
                        {agent.name}
                      </h3>
                      <p className="text-[10px] text-white/40">{agent.description}</p>

                      {isActive && (
                        <motion.div 
                          className="absolute inset-0 rounded-xl bg-purple-500/10 -z-10"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Live feed terminal */}
              <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                  </div>
                  <span className="text-[10px] text-white/40 ml-2 tracking-wider uppercase">Live Feed</span>
                </div>

                <div className="p-4 h-40 overflow-y-auto font-mono text-xs">
                  <AnimatePresence>
                    {logs.map((log, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-2 mb-1"
                      >
                        <span className="text-purple-400">→</span>
                        <span className="text-white/60">{log}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {logs.length === 0 && (
                    <div className="flex items-center gap-2 text-white/30">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Initializing agents...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Success state */}
              <AnimatePresence>
                {planId && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="mt-6 p-5 bg-green-500/10 border border-green-400/30 rounded-xl text-center"
                  >
                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                    <h2 className="text-lg font-medium text-white mb-1">
                      Your itinerary is ready!
                    </h2>
                    <p className="text-white/50 text-sm">
                      Redirecting you now...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Preload images */}
      <div className="hidden">
        {backgroundImages.map((img, i) => (
          <img key={i} src={img} alt="" />
        ))}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
        <p className="text-white/50">Loading...</p>
      </div>
    </div>
  );
}

export default function GeneratingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GeneratingContent />
    </Suspense>
  );
}
