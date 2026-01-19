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
  ImageOff,
} from 'lucide-react';
import DayMap from '@/components/DayMap';

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
    <div className="min-h-screen relative bg-[#F9F7F2] pattern-paper">
      {/* Paper Texture Overlay */}
      <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-8 py-6 border-b border-ink/10 bg-paper/80 backdrop-blur-sm sticky top-0 z-50">
          <button
            onClick={() => router.push('/planner')}
            className="flex items-center gap-2 text-ink/60 hover:text-leather transition-colors font-serif font-bold group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm tracking-widest">NEW TRIP</span>
          </button>

          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-leather" />
            <span className="text-xl font-serif font-bold tracking-[0.2em] text-ink">
              WANDR
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 text-ink/60 hover:text-leather transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
            <button className="p-2 text-ink/60 hover:text-leather transition-colors">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="px-8 py-12 border-b border-ink/10 bg-paper-card relative overflow-hidden">
          {/* Decorative stamp/tape */}
          <div className="absolute top-0 right-10 w-32 h-32 opacity-10 rotate-12 pointer-events-none">
            <Compass className="w-full h-full text-leather" />
          </div>

          <div className="max-w-6xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-nature" />
                  <span className="text-sm text-nature font-bold tracking-widest font-typewriter">
                    ITINERARY READY
                  </span>
                </div>

                <h1 className="text-4xl md:text-5xl font-serif font-bold text-ink mb-4 italic">
                  Your{' '}
                  <span className="text-leather underline decoration-leather/20 underline-offset-8 decoration-2">
                    {plan.destination_city}
                  </span>{' '}
                  Adventure
                </h1>

                <div className="flex flex-wrap items-center gap-6 text-ink/70 font-hand text-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-leather/70" />
                    <span>{plan.duration_days} days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-leather/70" />
                    <span>${plan.budget_per_day}/day budget</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-leather/70" />
                    <span>
                      {plan.destination_city}, {plan.destination_country}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="hidden md:flex gap-8">
                <div className="text-center p-4 bg-paper border border-ink/5 rounded-sm shadow-sm transform -rotate-2">
                  <div className="text-3xl font-bold font-serif text-leather">
                    {days.reduce(
                      (sum: number, d: any) => sum + (d.activities?.length || 0),
                      0
                    )}
                  </div>
                  <div className="text-xs text-ink/40 tracking-widest font-typewriter uppercase mt-1">
                    ACTIVITIES
                  </div>
                </div>
                <div className="text-center p-4 bg-paper border border-ink/5 rounded-sm shadow-sm transform rotate-1">
                  <div className="text-3xl font-bold font-serif text-leather">
                    ${plan.itinerary?.overall_summary?.total_budget?.replace('$', '') || '0'}
                  </div>
                  <div className="text-xs text-ink/40 tracking-widest font-typewriter uppercase mt-1">
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
                className="flex flex-wrap gap-2 mt-8 border-t border-ink/5 pt-6 border-dashed"
              >
                {plan.constraints.accessibility?.map((item: string) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-paper-dark border border-ink/10 text-ink/70 text-sm rounded-sm font-typewriter flex items-center gap-1 shadow-sm"
                  >
                    ♿ {item}
                  </span>
                ))}
                {plan.constraints.dietary?.map((item: string) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-nature/10 border border-nature/20 text-nature text-sm rounded-sm font-bold font-hand flex items-center gap-1 shadow-sm"
                  >
                    🌱 {item}
                  </span>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-8 py-12">
          {!hasActivities ? (
            /* No activities warning */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-stamp/5 border border-stamp/20 rounded-sm p-8 text-center"
            >
              <h2 className="text-xl font-bold text-stamp mb-4 font-serif">
                Just a moment...
              </h2>
              <p className="text-ink/60 mb-6 font-hand text-lg">
                We couldn't find specific venues for this location right now.
              </p>
              <div className="flex justify-center gap-4">
                <a
                  href="https://console.cloud.google.com/apis/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-paper border border-ink/10 hover:bg-ink/5 text-ink rounded-sm transition-colors font-typewriter text-sm"
                >
                  Check API Status
                </a>
                <button
                  onClick={() => router.push('/planner')}
                  className="px-6 py-3 bg-leather hover:bg-leather-light text-paper rounded-sm transition-colors font-bold font-serif tracking-wide shadow-md"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="grid md:grid-cols-[220px_1fr_380px] gap-8">
              {/* Day selector sidebar */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-3 sticky top-32 h-fit"
              >
                <div className="flex items-center gap-2 mb-4 opacity-50">
                  <div className="h-px flex-1 bg-ink/20"></div>
                  <span className="text-xs text-ink/60 tracking-widest font-bold font-typewriter">JOURNAL</span>
                  <div className="h-px flex-1 bg-ink/20"></div>
                </div>

                {days.map((day: any) => (
                  <button
                    key={day.day}
                    onClick={() => setActiveDay(day.day)}
                    className={`w-full text-left px-5 py-4 rounded-sm transition-all border relative overflow-hidden group ${activeDay === day.day
                        ? 'bg-paper-card border-leather shadow-md'
                        : 'bg-paper-dark border-transparent hover:border-ink/10 hover:bg-white text-ink/60'
                      }`}
                  >
                    {activeDay === day.day && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-leather"></div>
                    )}
                    <div className={`font-serif font-bold ${activeDay === day.day ? 'text-leather' : 'text-ink/70 group-hover:text-ink'}`}>Day {day.day}</div>
                    <div className="text-xs text-ink/40 truncate font-typewriter mt-1">
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
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-ink/10 border-dashed">
                      <div>
                        <h2 className="text-3xl font-serif font-bold text-ink mb-1">
                          Day {currentDay.day}
                        </h2>
                        <p className="text-ink/50 font-hand text-lg">
                          {currentDay.date} — <span className="text-leather">{currentDay.neighborhood}</span>
                        </p>
                      </div>
                      <div className="flex gap-6 text-right">
                        <div>
                          <div className="text-xl font-bold font-serif text-ink">
                            ${currentDay.day_summary?.total_cost || 0}
                          </div>
                          <div className="text-xs text-ink/40 uppercase tracking-wider font-typewriter">Est. Cost</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold font-serif text-ink">
                            {currentDay.activities?.length || 0}
                          </div>
                          <div className="text-xs text-ink/40 uppercase tracking-wider font-typewriter">Stops</div>
                        </div>
                      </div>
                    </div>

                    {/* Activities timeline */}
                    <div className="space-y-0 relative">
                      {/* Vertical line for timeline */}
                      <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-ink/5 border-l border-r border-ink/5 border-dashed"></div>

                      {currentDay.activities?.map(
                        (activity: any, idx: number) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="flex gap-6 relative pb-10 last:pb-0"
                          >
                            {/* Timeline Node */}
                            <div className="flex flex-col items-center relative z-10">
                              <div
                                className={`w-10 h-10 rounded-full border-4 border-paper flex items-center justify-center shadow-sm ${activity.type === 'meal'
                                    ? 'bg-nature text-white'
                                    : 'bg-leather text-white'
                                  }`}
                              >
                                <span className="text-xs font-bold font-typewriter">{idx + 1}</span>
                              </div>
                            </div>

                            {/* Content Card */}
                            <div className="flex-1">
                              <div className="bg-paper-card border border-ink/10 rounded-sm p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                                <div className="flex gap-5">
                                  {/* Photo */}
                                  {activity.activity.photo_url ? (
                                    <div className="flex-shrink-0 w-24 h-24 rounded-sm overflow-hidden border border-ink/10 rotate-1 group-hover:rotate-0 transition-transform duration-300 bg-paper-dark">
                                      <img
                                        src={activity.activity.photo_url}
                                        alt={activity.activity.name}
                                        className="w-full h-full object-cover sepia-[0.3]"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                          (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-paper-dark"><span class="text-2xl opacity-20">📷</span></div>';
                                        }}
                                      />
                                    </div>
                                  ) : null}

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between mb-2">
                                      <div>
                                        <div className="text-xs text-leather font-bold tracking-widest uppercase mb-1 font-typewriter">
                                          {activity.time}
                                        </div>
                                        <h3 className="text-xl font-bold font-serif text-ink leading-tight">
                                          {activity.activity.name}
                                        </h3>
                                      </div>
                                      {activity.activity.cost > 0 && (
                                        <span className="text-ink/60 font-typewriter text-sm border border-ink/10 px-2 py-1 rounded-sm bg-paper-dark">
                                          ${activity.activity.cost}
                                        </span>
                                      )}
                                    </div>

                                    <p className="text-ink/60 text-sm mb-4 font-serif leading-relaxed line-clamp-2">
                                      {activity.activity.description}
                                    </p>

                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-2">
                                      <span className="text-[10px] px-2 py-1 bg-paper-dark border border-ink/10 text-ink/50 rounded-sm uppercase tracking-wider font-bold">
                                        <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
                                        {activity.activity.duration_minutes} min
                                      </span>

                                      {activity.activity.accessibility_notes && (
                                        <span className="text-[10px] px-2 py-1 bg-blue-50 border border-blue-100 text-blue-800/70 rounded-sm font-bold">
                                          ♿ {activity.activity.accessibility_notes}
                                        </span>
                                      )}

                                      {activity.activity.vegan_details && (
                                        <span className="text-[10px] px-2 py-1 bg-green-50 border border-green-100 text-green-800/70 rounded-sm font-bold">
                                          🌱 {activity.activity.vegan_details}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Reddit quote */}
                                {activity.activity.reddit_quote && (
                                  <div className="mt-4 pt-3 border-t border-ink/5 flex gap-3">
                                    <div className="w-1 h-full bg-stamp/30 rounded-full self-stretch"></div>
                                    <div>
                                      <p className="text-ink/50 text-xs italic font-serif">
                                        "{activity.activity.reddit_quote}"
                                      </p>
                                      <p className="text-ink/30 text-[10px] mt-1 font-bold uppercase tracking-widest">
                                        — Verified feedback
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )
                      )}
                    </div>

                    {/* Day summary */}
                    {currentDay.day_summary?.constraint_satisfaction && (
                      <div className="mt-10 p-6 bg-paper-dark border border-ink/10 rounded-sm shadow-inner relative">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 bg-paper border border-ink/10 px-3 py-1 rounded-sm shadow-sm">
                          <h4 className="text-xs font-bold text-ink/40 tracking-widest uppercase font-typewriter">
                            Constraint Check
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mt-2">
                          {Object.entries(
                            currentDay.day_summary.constraint_satisfaction
                          ).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between text-sm py-2 border-b border-ink/5 border-dashed last:border-0"
                            >
                              <span className="text-ink/50 capitalize font-serif italic">
                                {key}
                              </span>
                              <span className="text-ink/80 font-bold font-hand">{value as string}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>

              {/* Day Map Side Panel */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="hidden md:block sticky top-32 h-[calc(100vh-160px)]"
              >
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-4 opacity-50 justify-center">
                    <div className="w-2 h-2 rounded-full bg-leather"></div>
                    <p className="text-xs text-leather tracking-widest font-bold uppercase font-typewriter">
                      Route Map
                    </p>
                    <div className="w-2 h-2 rounded-full bg-leather"></div>
                  </div>

                  <div className="flex-1 bg-paper-card border border-ink/10 rounded-sm p-2 shadow-md rotate-1">
                    <DayMap
                      key={activeDay}
                      activities={currentDay?.activities || []}
                      activeActivityId={undefined}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="border-t border-ink/10 px-8 py-12 bg-paper-dark mt-12">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-ink/40 font-serif italic text-lg mb-1">
                Wanderlust is incurable.
              </p>
              <p className="text-ink/30 text-xs font-typewriter uppercase tracking-widest">
                Where to next?
              </p>
            </div>

            <button
              onClick={() => router.push('/planner')}
              className="px-8 py-3 bg-leather hover:bg-leather-light text-paper rounded-sm transition-colors shadow-lg font-bold font-serif tracking-wide border-2 border-transparent hover:border-paper/20"
            >
              Plan Another Trip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
