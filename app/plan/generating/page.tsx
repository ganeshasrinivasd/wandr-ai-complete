'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, Sparkles } from 'lucide-react';

export default function GeneratingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string[]>(['Starting...']);
  const [agentStatus, setAgentStatus] = useState({
    parser: 'waiting',
    researcher: 'waiting',
    optimizer: 'waiting',
    storyteller: 'waiting',
  });
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (!dataParam) {
      router.push('/planner');
      return;
    }

    const planInput = JSON.parse(dataParam);
    generatePlan(planInput);
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
                  setAgentStatus(prev => ({
                    ...prev,
                    [data.agent]: data.status,
                  }));
                }

                if (data.message) {
                  setStatus(prev => [...prev, `${data.agent || ''}: ${data.message}`]);
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
      setStatus(prev => [...prev, `Error: ${error}`]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Creating Your Perfect Itinerary
          </h1>
          <p className="text-xl text-gray-600">
            Watch our AI agents work their magic ✨
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-12">
          <AgentCard
            name="Parser"
            icon="🧠"
            status={agentStatus.parser}
            description="Validating input"
          />
          <AgentCard
            name="Researcher"
            icon="🔍"
            status={agentStatus.researcher}
            description="Finding venues"
          />
          <AgentCard
            name="Optimizer"
            icon="⚡"
            status={agentStatus.optimizer}
            description="Building itinerary"
          />
          <AgentCard
            name="Storyteller"
            icon="✍️"
            status={agentStatus.storyteller}
            description="Writing narrative"
          />
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-semibold">Live Feed</span>
          </div>
          
          <div className="space-y-2 font-mono text-sm max-h-96 overflow-y-auto">
            {status.map((msg, i) => (
              <div key={i} className="text-green-400">
                {msg}
              </div>
            ))}
          </div>
        </div>

        {planId && (
          <div className="mt-8 bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Your itinerary is ready!
            </h2>
            <p className="text-gray-600">
              Redirecting you to your personalized travel plan...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ name, icon, status, description }: {
  name: string;
  icon: string;
  status: string;
  description: string;
}) {
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-lg transition-all ${
      status === 'running' ? 'ring-4 ring-orange-400 scale-105' :
      status === 'complete' ? 'ring-2 ring-green-400' : 'opacity-60'
    }`}>
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-bold text-gray-900 mb-1">{name}</h3>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      
      <div className="flex items-center gap-2">
        {status === 'waiting' && <div className="w-2 h-2 bg-gray-300 rounded-full" />}
        {status === 'running' && <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />}
        {status === 'complete' && <CheckCircle className="w-4 h-4 text-green-500" />}
        <span className="text-xs font-medium capitalize text-gray-600">{status}</span>
      </div>
    </div>
  );
}