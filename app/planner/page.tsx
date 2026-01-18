'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar,
  DollarSign,
  Users,
  ArrowLeft,
  Compass,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import LocationAutocomplete from '@/components/LocationAutocomplete';

export default function PlannerPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    destination: '',
    dates: '',
    budget: '100',
    travelers: '1',
    constraints: [] as string[],
    interests: [] as string[],
    special_requests: '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const planInput = {
      destination: formData.destination,
      dates: formData.dates,
      budget: `$${formData.budget} per day`,
      travelers: `${formData.travelers} ${parseInt(formData.travelers) === 1 ? 'person' : 'people'}`,
      constraints: formData.constraints.join(', '),
      interests: formData.interests.join(', '),
      special_requests: formData.special_requests,
    };

    const params = new URLSearchParams({ data: JSON.stringify(planInput) });
    router.push(`/plan/generating?${params.toString()}`);
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20" />
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-8 py-6">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm tracking-wider">BACK</span>
          </button>

          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-purple-400" />
            <span className="text-xl font-light tracking-[0.3em] text-white">WANDR</span>
          </div>

          <div className="w-20" /> {/* Spacer for centering */}
        </nav>

        {/* Progress Steps */}
        <div className="flex justify-center mb-12 px-8">
          <div className="flex items-center gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-4">
                <button
                  onClick={() => setStep(s)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-500 ${
                    s === step
                      ? 'bg-purple-500 text-white scale-110'
                      : s < step
                      ? 'bg-purple-500/30 text-purple-300'
                      : 'bg-white/10 text-white/40'
                  }`}
                >
                  {s}
                </button>
                {s < 3 && (
                  <div
                    className={`w-16 h-px transition-colors duration-500 ${
                      s < step ? 'bg-purple-500' : 'bg-white/20'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Container */}
        <div className="max-w-2xl mx-auto px-8 pb-12">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Destination & Dates */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-8"
              >
                <div className="text-center mb-12">
                  <h1 className="text-4xl md:text-5xl font-light text-white mb-4">
                    Where to?
                  </h1>
                  <p className="text-white/50">
                    Tell us your dream destination
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-white/60 mb-3 tracking-wider">
                      DESTINATION
                    </label>
                    <LocationAutocomplete
                      value={formData.destination}
                      onChange={(value) =>
                        setFormData({ ...formData, destination: value })
                      }
                      placeholder="Tokyo, Japan"
                      required
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm text-white/60 mb-3 tracking-wider">
                      <Calendar className="w-4 h-4" />
                      TRAVEL DATES
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.dates}
                      onChange={(e) =>
                        setFormData({ ...formData, dates: e.target.value })
                      }
                      placeholder="March 15-18, 2025"
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center gap-2 text-sm text-white/60 mb-3 tracking-wider">
                        <DollarSign className="w-4 h-4" />
                        DAILY BUDGET
                      </label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/50">
                          $
                        </span>
                        <input
                          type="number"
                          min="20"
                          max="1000"
                          value={formData.budget}
                          onChange={(e) =>
                            setFormData({ ...formData, budget: e.target.value })
                          }
                          className="w-full pl-10 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm text-white/60 mb-3 tracking-wider">
                        <Users className="w-4 h-4" />
                        TRAVELERS
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={formData.travelers}
                        onChange={(e) =>
                          setFormData({ ...formData, travelers: e.target.value })
                        }
                        className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Constraints */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-8"
              >
                <div className="text-center mb-12">
                  <h1 className="text-4xl md:text-5xl font-light text-white mb-4">
                    Your needs
                  </h1>
                  <p className="text-white/50">
                    We'll find places that meet every requirement
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-4 tracking-wider">
                    ACCESSIBILITY & DIETARY
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {constraintOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleConstraint(option.id)}
                        className={`px-5 py-4 rounded-2xl border text-left transition-all duration-300 ${
                          formData.constraints.includes(option.id)
                            ? 'bg-purple-500/20 border-purple-500/50 text-white'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <span className="text-xl mb-1 block">{option.icon}</span>
                        <span className="text-sm">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-4 tracking-wider">
                    INTERESTS
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {interestOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleInterest(option.id)}
                        className={`px-4 py-4 rounded-2xl border text-center transition-all duration-300 ${
                          formData.interests.includes(option.id)
                            ? 'bg-purple-500/20 border-purple-500/50 text-white'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <span className="text-2xl mb-2 block">{option.icon}</span>
                        <span className="text-xs">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Special Requests & Review */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-8"
              >
                <div className="text-center mb-12">
                  <h1 className="text-4xl md:text-5xl font-light text-white mb-4">
                    Almost there
                  </h1>
                  <p className="text-white/50">
                    Any special requests for your journey?
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-3 tracking-wider">
                    SPECIAL REQUESTS (OPTIONAL)
                  </label>
                  <textarea
                    value={formData.special_requests}
                    onChange={(e) =>
                      setFormData({ ...formData, special_requests: e.target.value })
                    }
                    placeholder="I'd love to catch a sunset view, avoid crowded tourist spots..."
                    rows={4}
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all resize-none"
                  />
                </div>

                {/* Summary */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                  <h3 className="text-white/60 text-sm tracking-wider mb-4">
                    YOUR TRIP SUMMARY
                  </h3>
                  
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Destination</span>
                    <span className="text-white">{formData.destination || '—'}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Dates</span>
                    <span className="text-white">{formData.dates || '—'}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Budget</span>
                    <span className="text-white">${formData.budget}/day</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50">Travelers</span>
                    <span className="text-white">{formData.travelers}</span>
                  </div>

                  {formData.constraints.length > 0 && (
                    <div className="flex justify-between items-start py-2 border-b border-white/10">
                      <span className="text-white/50">Requirements</span>
                      <div className="flex flex-wrap gap-2 justify-end max-w-[60%]">
                        {formData.constraints.map((c) => (
                          <span key={c} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
                            {constraintOptions.find((o) => o.id === c)?.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.interests.length > 0 && (
                    <div className="flex justify-between items-start py-2">
                      <span className="text-white/50">Interests</span>
                      <div className="flex flex-wrap gap-2 justify-end max-w-[60%]">
                        {formData.interests.map((i) => (
                          <span key={i} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                            {interestOptions.find((o) => o.id === i)?.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-12">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-3 text-white/60 hover:text-white transition-colors"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center gap-2 px-8 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-full transition-all hover:scale-105"
                >
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-full transition-all hover:scale-105 shadow-lg shadow-purple-500/25"
                >
                  <Sparkles className="w-5 h-5" />
                  Generate My Itinerary
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
