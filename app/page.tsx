'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Map, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-20 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered Travel Planning
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-6">
            AI that solves
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-blue-600">
              impossible travel plans
            </span>
          </h1>

          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Wheelchair accessible + vegan + $60/day budget? No problem.
            Our 4 specialized AI agents create perfect itineraries that satisfy
            every constraint.
          </p>

          <Link
            href="/planner"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            Start Planning Your Trip
            <Zap className="w-5 h-5" />
          </Link>

          <p className="text-sm text-gray-500 mt-4">
            Free to use • No credit card required
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-24"
        >
          <FeatureCard
            icon={<CheckCircle className="w-8 h-8 text-orange-500" />}
            title="100% Constraint Satisfaction"
            description="Every venue meets ALL your requirements: accessibility, dietary needs, budget."
          />
          <FeatureCard
            icon={<Map className="w-8 h-8 text-blue-500" />}
            title="Smart Route Optimization"
            description="Minimized travel time, clustered by neighborhood, perfectly paced days."
          />
          <FeatureCard
            icon={<Sparkles className="w-8 h-8 text-purple-500" />}
            title="Reddit-Verified Picks"
            description="Authentic recommendations from real travelers, not sponsored content."
          />
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-32 max-w-4xl mx-auto"
        >
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            How It Works
          </h2>

          <div className="space-y-12">
            <Step
              number="1"
              title="Tell us your constraints"
              description="Wheelchair accessible, vegan, budget $60/day? Add as many constraints as you want."
            />
            <Step
              number="2"
              title="Watch AI agents work"
              description="4 specialized agents parse, research, optimize, and write your perfect itinerary in real-time."
            />
            <Step
              number="3"
              title="Get your perfect plan"
              description="A beautiful, day-by-day itinerary that satisfies every single constraint. Export or share instantly."
            />
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-32 bg-gradient-to-r from-orange-500 to-blue-600 rounded-3xl p-12 text-center text-white shadow-2xl"
        >
          <h2 className="text-4xl font-bold mb-4">
            Ready to plan the impossible?
          </h2>
          <p className="text-xl mb-8 text-orange-100">
            Join travelers who've planned 1,000+ accessible trips
          </p>
          <Link
            href="/planner"
            className="inline-flex items-center gap-2 bg-white text-orange-600 hover:bg-orange-50 px-8 py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-105"
          >
            Create Your Itinerary
            <Zap className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
        {number}
      </div>
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-lg">{description}</p>
      </div>
    </div>
  );
}
