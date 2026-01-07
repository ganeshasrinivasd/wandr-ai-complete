'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  MapPin,
  Clock,
  DollarSign,
  Compass,
  ArrowLeft,
  Calendar,
  Footprints,
  Download,
  Share2,
} from 'lucide-react';

export default function PlanResultsPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(1);

  useEffect(() => {
    fetchPlan();
  }, [planId]);

  const fetchPlan = async () => {
    try {
      const response = await fetch(`/api/plan/${planId}`);
      if (response.ok) {
        const data = await response.json();
        setPlan(data);
      }
    } catch (error) {
      console.error('Failed to fetch plan:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50">Loading your itinerary...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-light text-white mb-4">
            Plan not found
          </h1>
          <p className="text-white/50 mb-8">
            This itinerary doesn't exist or has been deleted.
          </p>
          <button
            onClick={() => router.push('/planner')}
            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-full transition-colors"
          >
            Create New Plan
          </button>
        </div>
      </div>
    );
  }

  const itinerary = plan.itinerary?.itinerary || {};
  const days = Object.values(itinerary) as any[];
  const currentDay = days.find((d: any) => d.day === activeDay) || days[0];

  // Check if we have activities
  const hasActivities = days.some((day: any) => day.activities?.length > 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10" />

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10">
          <button
            onClick={() => router.push('/planner')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm tracking-wider">NEW TRIP</span>
          </button>

          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-purple-400" />
            <span className="text-xl font-light tracking-[0.3em] text-white">
              WANDR
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 text-white/60 hover:text-white transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
            <button className="p-2 text-white/60 hover:text-white transition-colors">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="px-8 py-12 border-b border-white/10">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-green-400 tracking-wider">
                    ITINERARY READY
                  </span>
                </div>

                <h1 className="text-4xl md:text-5xl font-light text-white mb-4">
                  Your{' '}
                  <span className="text-purple-400">
                    {plan.destination_city}
                  </span>{' '}
                  Adventure
                </h1>

                <div className="flex flex-wrap items-center gap-6 text-white/60">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{plan.duration_days} days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>${plan.budget_per_day}/day budget</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {plan.destination_city}, {plan.destination_country}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="hidden md:flex gap-6">
                <div className="text-center">
                  <div className="text-3xl font-light text-white">
                    {days.reduce(
                      (sum: number, d: any) => sum + (d.activities?.length || 0),
                      0
                    )}
                  </div>
                  <div className="text-xs text-white/40 tracking-wider">
                    ACTIVITIES
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-light text-white">
                    ${plan.itinerary?.overall_summary?.total_budget?.replace('$', '') || '0'}
                  </div>
                  <div className="text-xs text-white/40 tracking-wider">
                    TOTAL COST
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Constraint badges */}
            {plan.constraints && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-2 mt-6"
              >
                {plan.constraints.accessibility?.map((item: string) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full"
                  >
                    ♿ {item}
                  </span>
                ))}
                {plan.constraints.dietary?.map((item: string) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full"
                  >
                    🌱 {item}
                  </span>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-8 py-12">
          {!hasActivities ? (
            /* No activities warning */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-8 text-center"
            >
              <h2 className="text-xl text-white mb-4">
                Google Maps API Issue
              </h2>
              <p className="text-white/60 mb-6">
                No venues were found. This is likely due to API configuration
                issues.
              </p>
              <div className="flex justify-center gap-4">
                <a
                  href="https://console.cloud.google.com/apis/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                >
                  Check Google APIs
                </a>
                <button
                  onClick={() => router.push('/planner')}
                  className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-full transition-colors"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="grid md:grid-cols-[200px_1fr] gap-8">
              {/* Day selector sidebar */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-2"
              >
                <p className="text-xs text-white/40 tracking-wider mb-4">
                  SELECT DAY
                </p>
                {days.map((day: any) => (
                  <button
                    key={day.day}
                    onClick={() => setActiveDay(day.day)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                      activeDay === day.day
                        ? 'bg-purple-500/20 border border-purple-500/30 text-white'
                        : 'bg-white/5 border border-transparent text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-medium">Day {day.day}</div>
                    <div className="text-xs text-white/40 truncate">
                      {day.theme?.replace(`Day ${day.day} - `, '') || day.neighborhood}
                    </div>
                  </button>
                ))}
              </motion.div>

              {/* Day details */}
              <motion.div
                key={activeDay}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {currentDay && (
                  <>
                    {/* Day header */}
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
                      <div>
                        <h2 className="text-2xl text-white mb-1">
                          Day {currentDay.day}
                        </h2>
                        <p className="text-white/50">
                          {currentDay.date} • {currentDay.neighborhood}
                        </p>
                      </div>
                      <div className="flex gap-6 text-right">
                        <div>
                          <div className="text-xl text-white">
                            ${currentDay.day_summary?.total_cost || 0}
                          </div>
                          <div className="text-xs text-white/40">Cost</div>
                        </div>
                        <div>
                          <div className="text-xl text-white">
                            {currentDay.activities?.length || 0}
                          </div>
                          <div className="text-xs text-white/40">Activities</div>
                        </div>
                      </div>
                    </div>

                    {/* Activities timeline */}
                    <div className="space-y-6">
                      {currentDay.activities?.map(
                        (activity: any, idx: number) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="flex gap-6"
                          >
                            {/* Timeline */}
                            <div className="flex flex-col items-center">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  activity.type === 'meal'
                                    ? 'bg-green-500'
                                    : 'bg-purple-500'
                                }`}
                              />
                              {idx < currentDay.activities.length - 1 && (
                                <div className="w-px h-full bg-white/10 my-2" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 pb-6">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="text-xs text-white/40 mb-1">
                                    {activity.time}
                                  </div>
                                  <h3 className="text-lg text-white">
                                    {activity.activity.name}
                                  </h3>
                                </div>
                                {activity.activity.cost > 0 && (
                                  <span className="text-white/60">
                                    ${activity.activity.cost}
                                  </span>
                                )}
                              </div>

                              <p className="text-white/50 text-sm mb-3">
                                {activity.activity.description}
                              </p>

                              {/* Tags */}
                              <div className="flex flex-wrap gap-2">
                                <span className="text-xs px-2 py-1 bg-white/5 text-white/40 rounded">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {activity.activity.duration_minutes} min
                                </span>

                                {activity.activity.accessibility_notes && (
                                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                                    ♿ {activity.activity.accessibility_notes}
                                  </span>
                                )}

                                {activity.activity.vegan_details && (
                                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded">
                                    🌱 {activity.activity.vegan_details}
                                  </span>
                                )}
                              </div>

                              {/* Reddit quote */}
                              {activity.activity.reddit_quote && (
                                <div className="mt-4 pl-4 border-l-2 border-white/10">
                                  <p className="text-white/40 text-sm italic">
                                    "{activity.activity.reddit_quote}"
                                  </p>
                                  <p className="text-white/30 text-xs mt-1">
                                    — Reddit
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )
                      )}
                    </div>

                    {/* Day summary */}
                    {currentDay.day_summary?.constraint_satisfaction && (
                      <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-2xl">
                        <h4 className="text-sm text-white/40 tracking-wider mb-4">
                          CONSTRAINT CHECK
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(
                            currentDay.day_summary.constraint_satisfaction
                          ).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-white/60 capitalize">
                                {key}
                              </span>
                              <span className="text-white/80">{value as string}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="border-t border-white/10 px-8 py-8">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <p className="text-white/40">
              Want to explore somewhere else?
            </p>
            <button
              onClick={() => router.push('/planner')}
              className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-full transition-colors"
            >
              Plan Another Trip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
