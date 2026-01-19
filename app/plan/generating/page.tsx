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
    <div className="min-h-screen relative overflow-hidden bg-[#F9F7F2] pattern-paper">
      {/* Paper Texture Overlay */}
      <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <nav className="flex items-center justify-center px-8 py-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <Compass className="w-8 h-8 text-leather" />
            <span className="text-2xl font-serif font-bold tracking-widest text-ink">WANDR</span>
          </motion.div>
        </nav>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-8">
          <div className="max-w-3xl w-full">
            {/* Paper Card Container */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-paper-card border border-ink/10 rounded-sm p-6 md:p-10 shadow-xl relative overflow-hidden transform rotate-1"
            >
              {/* Tape Effect */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 bg-[#e8e6df]/90 backdrop-blur-sm -rotate-2 shadow-sm border border-white/20 z-10" />

              {/* Title */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-paper-dark border border-ink/10 mb-4 shadow-sm"
                >
                  <Sparkles className="w-4 h-4 text-leather" />
                  <span className="text-sm text-ink/70 font-typewriter uppercase tracking-widest">Creating your trip</span>
                </motion.div>
                <h1 className="text-3xl md:text-4xl font-serif font-bold text-ink mb-2 italic">
                  {planId ? (
                    'Your journey awaits'
                  ) : (
                    <>
                      Crafting your <span className="text-leather underline decoration-leather/20 underline-offset-4">{destination}</span> adventure
                    </>
                  )}
                </h1>
                <p className="text-ink/60 text-lg font-hand">
                  {planId
                    ? 'Redirecting to your personalized itinerary...'
                    : 'Our AI travel agents are looking at maps and writing notes...'}
                </p>
              </div>

              {/* Progress bar */}
              <div className="mb-8">
                <div className="h-2 bg-ink/5 rounded-full overflow-hidden border border-ink/5">
                  <motion.div
                    className="h-full bg-gradient-to-r from-leather via-stamp to-nature bg-[length:200%_100%]"
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
                <div className="flex justify-between mt-2 text-xs text-ink/40 font-typewriter">
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
                      className={`relative p-4 rounded-sm border transition-all duration-500 ${isComplete
                          ? 'bg-nature/10 border-nature/30 shadow-sm'
                          : isActive
                            ? 'bg-paper-dark border-leather/30 shadow-md scale-[1.02] z-10'
                            : 'bg-paper border-ink/5 opacity-60'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-xl transition-colors duration-500 ${isComplete
                              ? 'text-nature grayscale-0'
                              : isActive
                                ? 'text-leather grayscale-0'
                                : 'text-ink/20 grayscale'
                            }`}
                        >
                          {agent.icon}
                        </span>

                        {isComplete && (
                          <CheckCircle className="w-4 h-4 text-nature" />
                        )}
                        {isActive && (
                          <Loader2 className="w-4 h-4 text-leather animate-spin" />
                        )}
                      </div>

                      <h3
                        className={`text-sm font-bold font-serif mb-0.5 transition-colors duration-500 ${isComplete ? 'text-nature' : isActive ? 'text-leather' : 'text-ink/40'
                          }`}
                      >
                        {agent.name}
                      </h3>
                      <p className="text-[10px] text-ink/50 font-typewriter leading-tight">{agent.description}</p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Live feed terminal */}
              <div className="bg-paper-dark border border-ink/10 rounded-sm overflow-hidden shadow-inner">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-ink/5 bg-ink/5">
                  <div className="flex gap-1.5 opacity-50">
                    <div className="w-2.5 h-2.5 rounded-full bg-ink/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-ink/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-ink/20" />
                  </div>
                  <span className="text-[10px] text-ink/40 ml-2 tracking-wider uppercase font-bold font-typewriter">Journal Log</span>
                </div>

                <div className="p-4 h-40 overflow-y-auto font-typewriter text-xs bg-paper">
                  <AnimatePresence>
                    {logs.map((log, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-2 mb-2"
                      >
                        <span className="text-leather font-bold">»</span>
                        <span className="text-ink/70">{log}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {logs.length === 0 && (
                    <div className="flex items-center gap-2 text-ink/30 italic">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Initializing travel agents...</span>
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
                    className="mt-6 p-5 bg-nature/10 border border-nature/30 rounded-sm text-center"
                  >
                    <CheckCircle className="w-10 h-10 text-nature mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-nature mb-1 font-serif">
                      Your itinerary is ready!
                    </h2>
                    <p className="text-ink/60 text-sm font-hand">
                      Opening your journal...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
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
