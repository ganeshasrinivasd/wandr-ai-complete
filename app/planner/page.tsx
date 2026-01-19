'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // Correct import
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  DollarSign,
  Users,
  ArrowLeft,
  Compass,
  Sparkles,
  ChevronRight,
  MapPin,
  Check
} from 'lucide-react';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import DateRangePicker from '@/components/ui/DateRangePicker';
import AnimatedProgress from '@/components/ui/AnimatedProgress';
import SmartSuggestions from '@/components/ui/SmartSuggestions';
import DraggablePriorities from '@/components/ui/DraggablePriorities';
import ConflictDetection from '@/components/ui/ConflictDetection';
import { confettiBursts } from '@/components/ui/Confetti';
import BackgroundDecorations from './BackgroundDecorations';


const constraintOptions = [
  { id: 'wheelchair', label: 'Wheelchair Accessible', icon: '♿' },
  { id: 'vegan', label: 'Vegan', icon: '🌱' },
  { id: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
  { id: 'halal', label: 'Halal', icon: '☪️' },
  { id: 'kosher', label: 'Kosher', icon: '✡️' },
  { id: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
];

const interestOptions = [
  { id: 'food', label: 'Culinary', icon: '🍜' },
  { id: 'temples', label: 'Sacred Sites', icon: '⛩️' },
  { id: 'museums', label: 'Museums', icon: '🏛️' },
  { id: 'nature', label: 'Nature', icon: '🌳' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'nightlife', label: 'Nightlife', icon: '🌃' },
  { id: 'art', label: 'Art & Culture', icon: '🎨' },
  { id: 'history', label: 'History', icon: '📚' },
];

function PlannerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();



  const theme = searchParams.get('theme') || 'inventor';

  const [step, setStep] = useState(1);
  const [bgIndex, setBgIndex] = useState(0);
  const [dismissedConflicts, setDismissedConflicts] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    destination: '',
    dates: '',
    budget: '100',
    travelers: '1',
    constraints: [] as string[],
    interests: [] as string[],
    special_requests: '',
  });

  const toggleConstraint = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      constraints: prev.constraints.includes(id)
        ? prev.constraints.filter((c) => c !== id)
        : [...prev.constraints, id],
    }));
  };

  const toggleInterest = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter((i) => i !== id)
        : [...prev.interests, id],
    }));
  };

  const handleReorderInterests = (newOrder: string[]) => {
    setFormData((prev) => ({
      ...prev,
      interests: newOrder,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Fire confetti celebration! 🎉
    confettiBursts.celebration();

    // Small delay to let confetti show before navigation
    setTimeout(() => {
      const planInput = {
        destination: formData.destination,
        dates: formData.dates,
        budget: `${formData.budget} per day`,
        travelers: `${formData.travelers} ${parseInt(formData.travelers) === 1 ? 'person' : 'people'}`,
        constraints: formData.constraints.join(', '),
        interests: formData.interests.join(', '),
        special_requests: formData.special_requests,
      };
      const params = new URLSearchParams({ data: JSON.stringify(planInput) });
      router.push(`/plan/generating?${params.toString()}`);
    }, 800);
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const stepTitles = ['Destination', 'Preferences', 'Review'];

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* Dynamic Background Decorations */}
      <BackgroundDecorations theme={theme} />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col max-w-5xl mx-auto">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-6 md:px-12 py-8">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-ink/60 hover:text-leather transition-colors group font-serif"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm tracking-wider hidden sm:inline font-bold">BACK to HOME</span>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <Compass className="w-8 h-8 text-leather" />
            <span className="text-2xl font-serif font-bold tracking-widest text-ink">WANDR</span>
          </motion.div>

          <div className="w-20" />
        </nav>

        {/* Animated Progress Journey */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-6 mb-8"
        >
          <AnimatedProgress
            currentStep={step}
            stepTitles={stepTitles}
            onStepClick={(s) => s <= step && setStep(s)}
          />
        </motion.div>

        {/* Main Form Area */}
        <div className="flex-1 flex items-center justify-center px-4 md:px-8 py-8 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-2xl"
          >
            {/* Paper Card */}
            <div className="paper-card rounded-sm p-8 md:p-12 shadow-xl transform rotate-1 transition-transform hover:rotate-0 duration-500">
              {/* Tape effect */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 bg-[#e8e6df]/80 backdrop-blur-sm -rotate-2 shadow-sm border border-white/20" />

              <form onSubmit={handleSubmit}>
                <AnimatePresence mode="wait">
                  {/* Step 1: Destination & Dates */}
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-paper-dark border border-ink/10 mb-6 shadow-sm">
                          <MapPin className="w-4 h-4 text-leather" />
                          <span className="text-xs font-bold text-ink/70 uppercase tracking-widest font-typewriter">Step 1 of 3</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-serif font-bold text-ink mb-3 italic">
                          Where to next?
                        </h1>
                        <p className="text-ink/60 text-lg font-hand">
                          Every great story begins with a destination...
                        </p>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs text-ink/50 mb-2 tracking-wider uppercase font-typewriter font-bold">
                            Destination
                          </label>
                          <LocationAutocomplete
                            value={formData.destination}
                            onChange={(value) => setFormData({ ...formData, destination: value })}
                            placeholder="e.g. Kyoto, Japan"
                            required
                          />
                        </div>

                        <div>
                          <label className="flex items-center gap-2 text-xs text-ink/50 mb-2 tracking-wider uppercase font-typewriter font-bold">
                            <Calendar className="w-3.5 h-3.5" />
                            Travel Dates
                          </label>
                          <DateRangePicker
                            value={formData.dates}
                            onChange={(value) => setFormData({ ...formData, dates: value })}
                            placeholder="When are you going?"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="flex items-center gap-2 text-xs text-ink/50 mb-2 tracking-wider uppercase font-typewriter font-bold">
                              <DollarSign className="w-3.5 h-3.5" />
                              Daily Budget
                            </label>
                            <div className="relative">
                              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-ink/40 font-serif italic">$</span>
                              <input
                                type="number"
                                min="20"
                                max="1000"
                                value={formData.budget}
                                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                                className="w-full pl-9 pr-5 py-4 bg-paper-dark border border-ink/10 rounded-sm text-ink font-typewriter focus:outline-none focus:border-leather focus:bg-white transition-all shadow-inner"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="flex items-center gap-2 text-xs text-ink/50 mb-2 tracking-wider uppercase font-typewriter font-bold">
                              <Users className="w-3.5 h-3.5" />
                              Travelers
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={formData.travelers}
                              onChange={(e) => setFormData({ ...formData, travelers: e.target.value })}
                              className="w-full px-5 py-4 bg-paper-dark border border-ink/10 rounded-sm text-ink font-typewriter focus:outline-none focus:border-leather focus:bg-white transition-all shadow-inner"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Constraints & Interests */}
                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-paper-dark border border-ink/10 mb-6 shadow-sm">
                          <Sparkles className="w-4 h-4 text-leather" />
                          <span className="text-xs font-bold text-ink/70 uppercase tracking-widest font-typewriter">Step 2 of 3</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-serif font-bold text-ink mb-3 italic">
                          Personalize your journey
                        </h1>
                        <p className="text-ink/60 text-lg font-hand">
                          Tell us what makes your heart beat faster...
                        </p>
                      </div>

                      {/* Smart Suggestions based on destination */}
                      <SmartSuggestions
                        destination={formData.destination}
                        selectedInterests={formData.interests}
                        onToggleInterest={toggleInterest}
                      />

                      <div>
                        <label className="block text-xs text-ink/50 mb-3 tracking-wider uppercase font-typewriter font-bold">
                          Accessibility & Dietary
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {constraintOptions.map((option) => (
                            <motion.button
                              key={option.id}
                              type="button"
                              onClick={() => toggleConstraint(option.id)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`px-4 py-3 rounded-sm border text-left transition-all duration-200 shadow-sm ${formData.constraints.includes(option.id)
                                ? 'bg-paper text-leather border-leather ring-1 ring-leather'
                                : 'bg-paper-dark border-transparent text-ink/60 hover:bg-white hover:border-ink/10 hover:text-ink'
                                }`}
                            >
                              <span className="text-lg block mb-0.5">{option.icon}</span>
                              <span className="text-xs font-medium">{option.label}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-ink/50 mb-3 tracking-wider uppercase font-typewriter font-bold">
                          Interests
                        </label>
                        <div className="grid grid-cols-4 gap-3">
                          {interestOptions.map((option) => (
                            <motion.button
                              key={option.id}
                              type="button"
                              onClick={() => toggleInterest(option.id)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`px-3 py-3 rounded-sm border text-center transition-all duration-200 shadow-sm ${formData.interests.includes(option.id)
                                ? 'bg-paper text-nature border-nature ring-1 ring-nature'
                                : 'bg-paper-dark border-transparent text-ink/60 hover:bg-white hover:border-ink/10 hover:text-ink'
                                }`}
                            >
                              <span className="text-xl block mb-1 grayscale opacity-80">{option.icon}</span>
                              <span className="text-[10px] font-bold tracking-wide uppercase">{option.label}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Draggable Priority Reordering */}
                      <DraggablePriorities
                        interests={formData.interests}
                        onReorder={handleReorderInterests}
                      />
                    </motion.div>
                  )}

                  {/* Step 3: Review */}
                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-paper-dark border border-ink/10 mb-6 shadow-sm">
                          <Check className="w-4 h-4 text-nature" />
                          <span className="text-xs font-bold text-ink/70 uppercase tracking-widest font-typewriter">Final Step</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-serif font-bold text-ink mb-3 italic">
                          Review your trip
                        </h1>
                        <p className="text-ink/60 text-lg font-hand">
                          Almost there! Just a few final touches...
                        </p>
                      </div>

                      {/* Conflict Detection Alerts */}
                      <ConflictDetection
                        budget={formData.budget}
                        constraints={formData.constraints}
                        interests={formData.interests}
                        destination={formData.destination}
                        onDismiss={(id) => setDismissedConflicts([...dismissedConflicts, id])}
                        onAdjustBudget={() => setStep(1)}
                      />

                      <div>
                        <label className="block text-xs text-ink/50 mb-2 tracking-wider uppercase font-typewriter font-bold">
                          Special Requests (Optional)
                        </label>
                        <textarea
                          value={formData.special_requests}
                          onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                          placeholder="Note: I'm vegan, love sunsets, and want to avoid tourist traps..."
                          rows={3}
                          className="w-full px-5 py-4 bg-paper-dark border border-ink/10 rounded-sm text-ink placeholder:text-ink/30 font-hand text-lg focus:outline-none focus:border-leather focus:bg-white transition-all resize-none shadow-inner"
                        />
                      </div>

                      {/* Summary Card */}
                      <div className="bg-paper border-2 border-dashed border-ink/10 rounded-sm p-6 space-y-4 relative">
                        {/* Tape effect */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-[#e8e6df]/90 backdrop-blur-sm rotate-1 shadow-sm border border-white/20" />

                        <h3 className="text-xs text-ink/40 tracking-widest uppercase mb-3 font-typewriter text-center">Trip Summary</h3>

                        <div className="flex justify-between items-center py-2 border-b border-ink/5">
                          <span className="text-ink/50 text-sm font-serif italic">Destination</span>
                          <span className="text-ink text-lg font-bold font-serif">{formData.destination || '—'}</span>
                        </div>

                        <div className="flex justify-between items-center py-2 border-b border-ink/5">
                          <span className="text-ink/50 text-sm font-serif italic">Dates</span>
                          <span className="text-ink text-sm font-typewriter">{formData.dates || '—'}</span>
                        </div>

                        <div className="flex justify-between items-center py-2 border-b border-ink/5">
                          <span className="text-ink/50 text-sm font-serif italic">Budget</span>
                          <span className="text-ink text-sm font-typewriter">${formData.budget}/day</span>
                        </div>

                        <div className="flex justify-between items-center py-2 border-b border-ink/5">
                          <span className="text-ink/50 text-sm font-serif italic">Travelers</span>
                          <span className="text-ink text-sm font-typewriter">{formData.travelers}</span>
                        </div>

                        {formData.constraints.length > 0 && (
                          <div className="flex justify-between items-start py-2 border-b border-ink/5">
                            <span className="text-ink/50 text-sm font-serif italic">Requirements</span>
                            <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                              {formData.constraints.map((c) => (
                                <span key={c} className="text-[10px] bg-paper-dark border border-ink/10 text-ink/70 px-2 py-0.5 rounded-sm font-typewriter">
                                  {constraintOptions.find((o) => o.id === c)?.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {formData.interests.length > 0 && (
                          <div className="flex justify-between items-start py-2">
                            <span className="text-ink/50 text-sm font-serif italic">Interests</span>
                            <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                              {formData.interests.map((i, idx) => (
                                <span key={i} className="text-[10px] bg-nature/10 text-nature font-bold px-2 py-0.5 rounded-sm flex items-center gap-1 border border-nature/10">
                                  {idx === 0 && '★ '}
                                  {interestOptions.find((o) => o.id === i)?.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-10 pt-6 border-t border-ink/5">
                  {step > 1 ? (
                    <motion.button
                      type="button"
                      onClick={prevStep}
                      whileHover={{ x: -3 }}
                      className="flex items-center gap-2 px-4 py-2 text-ink/50 hover:text-leather transition-colors font-serif font-bold tracking-wide"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      BACK
                    </motion.button>
                  ) : (
                    <div />
                  )}

                  {step < 3 ? (
                    <motion.button
                      type="button"
                      onClick={nextStep}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-8 py-3 bg-leather hover:bg-leather-light text-paper rounded-sm transition-all shadow-md font-serif font-bold tracking-wide"
                    >
                      CONTINUE
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  ) : (
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-8 py-3 bg-stamp hover:bg-red-700 text-white rounded-sm transition-all shadow-lg font-serif font-bold tracking-wide"
                    >
                      <Sparkles className="w-4 h-4" />
                      CREATE ITINERARY
                    </motion.button>
                  )}
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </div>

      {/* No preloaded images needed for paper theme */}
    </div>
  );
}

// Wrap in Suspense for useSearchParams safety
export default function PlannerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper flex items-center justify-center text-ink/50">Loading journal...</div>}>
      <PlannerPageContent />
    </Suspense>
  );
}
