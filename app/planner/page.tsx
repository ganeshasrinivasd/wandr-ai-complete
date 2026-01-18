'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

const backgroundImages = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2400&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=2400&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=2400&q=80',
];

export default function PlannerPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [bgIndex, setBgIndex] = useState(0);
  const [formData, setFormData] = useState({
    destination: '',
    dates: '',
    budget: '100',
    travelers: '1',
    constraints: [] as string[],
    interests: [] as string[],
    special_requests: '',
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

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
      budget: `${formData.budget} per day`,
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

  const stepTitles = ['Destination', 'Preferences', 'Review'];

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
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-purple-900/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
        </motion.div>
      </AnimatePresence>

      {/* Floating Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
            top: '10%',
            left: '10%',
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
            bottom: '20%',
            right: '10%',
          }}
          animate={{
            x: [0, -40, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)',
            top: '50%',
            right: '30%',
          }}
          animate={{
            x: [0, 30, 0],
            y: [0, -30, 0],
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
        {[...Array(15)].map((_, i) => (
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
        {/* Navigation */}
        <nav className="flex items-center justify-between px-6 md:px-12 py-6">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm tracking-wider hidden sm:inline">BACK</span>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <Compass className="w-7 h-7 text-purple-400" />
            <span className="text-xl font-light tracking-[0.3em] text-white">WANDR</span>
          </motion.div>

          <div className="w-20" />
        </nav>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center mb-8 px-6"
        >
          <div className="flex items-center gap-2 md:gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2 md:gap-4">
                <button
                  onClick={() => s <= step && setStep(s)}
                  className={`relative flex items-center justify-center transition-all duration-500 ${
                    s <= step ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <motion.div
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm font-medium backdrop-blur-md border transition-all duration-500 ${
                      s === step
                        ? 'bg-purple-500/30 border-purple-400/50 text-white shadow-lg shadow-purple-500/20'
                        : s < step
                        ? 'bg-green-500/20 border-green-400/30 text-green-300'
                        : 'bg-white/5 border-white/10 text-white/40'
                    }`}
                    whileHover={s <= step ? { scale: 1.05 } : {}}
                    whileTap={s <= step ? { scale: 0.95 } : {}}
                  >
                    {s < step ? <Check className="w-5 h-5" /> : s}
                  </motion.div>
                  <span className={`absolute -bottom-6 text-xs tracking-wider whitespace-nowrap transition-colors ${
                    s === step ? 'text-white/80' : 'text-white/40'
                  }`}>
                    {stepTitles[s - 1]}
                  </span>
                </button>
                {s < 3 && (
                  <div className={`w-8 md:w-16 h-px transition-all duration-500 ${
                    s < step ? 'bg-gradient-to-r from-green-400/50 to-green-400/20' : 'bg-white/10'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Main Form Area */}
        <div className="flex-1 flex items-center justify-center px-4 md:px-8 py-8 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-2xl"
          >
            {/* Glass Card */}
            <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-6 md:p-10 shadow-2xl">
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
                      <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
                          <MapPin className="w-4 h-4 text-purple-400" />
                          <span className="text-sm text-purple-300">Step 1 of 3</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-light text-white mb-2">
                          Where would you like to go?
                        </h1>
                        <p className="text-white/50 text-sm">
                          Enter your dream destination to get started
                        </p>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs text-white/50 mb-2 tracking-wider uppercase">
                            Destination
                          </label>
                          <LocationAutocomplete
                            value={formData.destination}
                            onChange={(value) => setFormData({ ...formData, destination: value })}
                            placeholder="Tokyo, Japan"
                            required
                          />
                        </div>

                        <div>
                          <label className="flex items-center gap-2 text-xs text-white/50 mb-2 tracking-wider uppercase">
                            <Calendar className="w-3.5 h-3.5" />
                            Travel Dates
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.dates}
                            onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
                            placeholder="March 15-18, 2025"
                            className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.08] transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="flex items-center gap-2 text-xs text-white/50 mb-2 tracking-wider uppercase">
                              <DollarSign className="w-3.5 h-3.5" />
                              Daily Budget
                            </label>
                            <div className="relative">
                              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40">$</span>
                              <input
                                type="number"
                                min="20"
                                max="1000"
                                value={formData.budget}
                                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                                className="w-full pl-10 pr-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.08] transition-all"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="flex items-center gap-2 text-xs text-white/50 mb-2 tracking-wider uppercase">
                              <Users className="w-3.5 h-3.5" />
                              Travelers
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={formData.travelers}
                              onChange={(e) => setFormData({ ...formData, travelers: e.target.value })}
                              className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.08] transition-all"
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
                      <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <span className="text-sm text-purple-300">Step 2 of 3</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-light text-white mb-2">
                          Personalize your trip
                        </h1>
                        <p className="text-white/50 text-sm">
                          Select your requirements and interests
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs text-white/50 mb-3 tracking-wider uppercase">
                          Accessibility & Dietary
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {constraintOptions.map((option) => (
                            <motion.button
                              key={option.id}
                              type="button"
                              onClick={() => toggleConstraint(option.id)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`px-4 py-3 rounded-xl border text-left transition-all duration-200 ${
                                formData.constraints.includes(option.id)
                                  ? 'bg-purple-500/20 border-purple-400/40 text-white'
                                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/[0.08] hover:border-white/20'
                              }`}
                            >
                              <span className="text-lg block mb-0.5">{option.icon}</span>
                              <span className="text-xs">{option.label}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-white/50 mb-3 tracking-wider uppercase">
                          Interests
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {interestOptions.map((option) => (
                            <motion.button
                              key={option.id}
                              type="button"
                              onClick={() => toggleInterest(option.id)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`px-3 py-3 rounded-xl border text-center transition-all duration-200 ${
                                formData.interests.includes(option.id)
                                  ? 'bg-blue-500/20 border-blue-400/40 text-white'
                                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/[0.08] hover:border-white/20'
                              }`}
                            >
                              <span className="text-xl block mb-1">{option.icon}</span>
                              <span className="text-[10px]">{option.label}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
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
                      <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
                          <Check className="w-4 h-4 text-green-400" />
                          <span className="text-sm text-green-300">Final Step</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-light text-white mb-2">
                          Review your trip
                        </h1>
                        <p className="text-white/50 text-sm">
                          Add any special requests before we create your itinerary
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs text-white/50 mb-2 tracking-wider uppercase">
                          Special Requests (Optional)
                        </label>
                        <textarea
                          value={formData.special_requests}
                          onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                          placeholder="I'd love to catch a sunset view, avoid crowded tourist spots..."
                          rows={3}
                          className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.08] transition-all resize-none"
                        />
                      </div>

                      {/* Summary Card */}
                      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
                        <h3 className="text-xs text-white/50 tracking-wider uppercase mb-3">Trip Summary</h3>
                        
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-white/40 text-sm">Destination</span>
                          <span className="text-white text-sm font-medium">{formData.destination || '—'}</span>
                        </div>
                        
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-white/40 text-sm">Dates</span>
                          <span className="text-white text-sm">{formData.dates || '—'}</span>
                        </div>
                        
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-white/40 text-sm">Budget</span>
                          <span className="text-white text-sm">${formData.budget}/day</span>
                        </div>
                        
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-white/40 text-sm">Travelers</span>
                          <span className="text-white text-sm">{formData.travelers}</span>
                        </div>

                        {formData.constraints.length > 0 && (
                          <div className="flex justify-between items-start py-2 border-b border-white/5">
                            <span className="text-white/40 text-sm">Requirements</span>
                            <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                              {formData.constraints.map((c) => (
                                <span key={c} className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                                  {constraintOptions.find((o) => o.id === c)?.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {formData.interests.length > 0 && (
                          <div className="flex justify-between items-start py-2">
                            <span className="text-white/40 text-sm">Interests</span>
                            <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                              {formData.interests.map((i) => (
                                <span key={i} className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
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
                <div className="flex justify-between mt-8 pt-6 border-t border-white/5">
                  {step > 1 ? (
                    <motion.button
                      type="button"
                      onClick={prevStep}
                      whileHover={{ x: -3 }}
                      className="flex items-center gap-2 px-4 py-2 text-white/50 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
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
                      className="flex items-center gap-2 px-6 py-3 bg-purple-500/80 hover:bg-purple-500 text-white rounded-xl transition-all backdrop-blur-sm border border-purple-400/20"
                    >
                      Continue
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  ) : (
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20 border border-purple-400/20"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate Itinerary
                    </motion.button>
                  )}
                </div>
              </form>
            </div>
          </motion.div>
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
