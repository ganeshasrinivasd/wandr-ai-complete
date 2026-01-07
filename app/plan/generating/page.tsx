'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Compass, Loader2 } from 'lucide-react';

const agents = [
  {
    id: 'parser',
    name: 'Parser',
    description: 'Validating your input',
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

export default function GeneratingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<string[]>([]);
  const [agentStatus, setAgentStatus] = useState<Record<string, string>>({
    parser: 'waiting',
    researcher: 'waiting',
    optimizer: 'waiting',
    storyteller: 'waiting',
  });
  const [planId, setPlanId] = useState<string | null>(null);
  const [destination, setDestination] = useState<string>('');

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
  }, [searchParams]);

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
                  setLogs((prev) => [...prev, data.message]);
                }

                if (data.planId) {
                  setPlanId(data.planId);
                  setTimeout(() => {
                    router.push(`/plan/${data.planId}`);
                  }, 2500);
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
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20" />
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <nav className="flex items-center justify-center px-8 py-6">
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-purple-400" />
            <span className="text-xl font-light tracking-[0.3em] text-white">
              WANDR
            </span>
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
          <div className="max-w-3xl w-full">
            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h1 className="text-4xl md:text-5xl font-light text-white mb-4">
                {planId ? (
                  'Your journey awaits'
                ) : (
                  <>
                    Crafting your
                    <span className="text-purple-400"> {destination}</span> adventure
                  </>
                )}
              </h1>
              <p className="text-white/50">
                {planId
                  ? 'Redirecting you to your personalized itinerary...'
                  : 'Our AI agents are working together to create your perfect trip'}
              </p>
            </motion.div>

            {/* Progress bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-12"
            >
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-white/40">
                <span>{completedCount}/4 agents complete</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </motion.div>

            {/* Agent cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
            >
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
                    className={`relative p-5 rounded-2xl border transition-all duration-500 ${
                      isComplete
                        ? 'bg-green-500/10 border-green-500/30'
                        : isActive
                        ? 'bg-purple-500/10 border-purple-500/30 scale-105'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    {/* Status indicator */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-2xl transition-colors duration-500 ${
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
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      )}
                      {isActive && (
                        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                      )}
                    </div>

                    <h3
                      className={`font-medium mb-1 transition-colors duration-500 ${
                        isComplete || isActive ? 'text-white' : 'text-white/50'
                      }`}
                    >
                      {agent.name}
                    </h3>
                    <p className="text-xs text-white/40">{agent.description}</p>

                    {/* Active glow effect */}
                    {isActive && (
                      <div className="absolute inset-0 rounded-2xl bg-purple-500/20 blur-xl -z-10" />
                    )}
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Live feed terminal */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-black/50 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden"
            >
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                </div>
                <span className="text-xs text-white/40 ml-2">Live Feed</span>
              </div>

              {/* Terminal content */}
              <div className="p-4 h-48 overflow-y-auto font-mono text-sm">
                <AnimatePresence>
                  {logs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-2 mb-1"
                    >
                      <span className="text-purple-400">→</span>
                      <span className="text-white/70">{log}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {logs.length === 0 && (
                  <div className="flex items-center gap-2 text-white/30">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Initializing agents...</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Success state */}
            <AnimatePresence>
              {planId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-8 p-6 bg-green-500/10 border border-green-500/30 rounded-2xl text-center"
                >
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                  <h2 className="text-xl font-medium text-white mb-2">
                    Your itinerary is ready!
                  </h2>
                  <p className="text-white/50 text-sm">
                    Redirecting you now...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
