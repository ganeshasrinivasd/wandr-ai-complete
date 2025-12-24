'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, DollarSign, Users, Accessibility, Heart } from 'lucide-react';

export default function PlannerPage() {
  const router = useRouter();
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
    { id: 'wheelchair', label: '♿ Wheelchair Accessible', icon: '♿' },
    { id: 'vegan', label: '🌱 Vegan', icon: '🌱' },
    { id: 'vegetarian', label: '🥗 Vegetarian', icon: '🥗' },
    { id: 'halal', label: '☪️ Halal', icon: '☪️' },
    { id: 'kosher', label: '✡️ Kosher', icon: '✡️' },
    { id: 'gluten-free', label: '🌾 Gluten-Free', icon: '🌾' },
  ];

  const interestOptions = [
    { id: 'food', label: '🍜 Food', icon: '🍜' },
    { id: 'temples', label: '⛩️ Temples', icon: '⛩️' },
    { id: 'museums', label: '🏛️ Museums', icon: '🏛️' },
    { id: 'nature', label: '🌳 Nature', icon: '🌳' },
    { id: 'shopping', label: '🛍️ Shopping', icon: '🛍️' },
    { id: 'nightlife', label: '🌃 Nightlife', icon: '🌃' },
    { id: 'art', label: '🎨 Art', icon: '🎨' },
    { id: 'history', label: '📚 History', icon: '📚' },
  ];

  const toggleConstraint = (id: string) => {
    setFormData(prev => ({
      ...prev,
      constraints: prev.constraints.includes(id)
        ? prev.constraints.filter(c => c !== id)
        : [...prev.constraints, id]
    }));
  };

  const toggleInterest = (id: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter(i => i !== id)
        : [...prev.interests, id]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Format the data for the API
    const planInput = {
      destination: formData.destination,
      dates: formData.dates,
      budget: `$${formData.budget} per day`,
      travelers: `${formData.travelers} ${parseInt(formData.travelers) === 1 ? 'person' : 'people'}`,
      constraints: formData.constraints.join(', '),
      interests: formData.interests.join(', '),
      special_requests: formData.special_requests,
    };

    // Navigate to generation page with data
    const params = new URLSearchParams({ data: JSON.stringify(planInput) });
    router.push(`/plan/generating?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Plan Your Perfect Trip
          </h1>
          <p className="text-xl text-gray-600">
            Tell us what you need, and our AI will create a personalized itinerary
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl p-8 space-y-8">
          {/* Destination */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Where do you want to go? 🌍
            </label>
            <input
              type="text"
              required
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              placeholder="e.g., Tokyo, Japan"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all text-lg"
            />
          </div>

          {/* Dates */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Calendar className="w-4 h-4" />
              When are you traveling?
            </label>
            <input
              type="text"
              required
              value={formData.dates}
              onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
              placeholder="e.g., March 15-18, 2025 or next week"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
            />
          </div>

          {/* Budget & Travelers Row */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <DollarSign className="w-4 h-4" />
                Budget per day
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="20"
                  max="500"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  className="flex-1"
                />
                <span className="text-2xl font-bold text-orange-500 min-w-[80px]">
                  ${formData.budget}
                </span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Users className="w-4 h-4" />
                Number of travelers
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.travelers}
                onChange={(e) => setFormData({ ...formData, travelers: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
              />
            </div>
          </div>

          {/* Constraints */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Accessibility className="w-4 h-4" />
              Special Requirements
            </label>
            <div className="flex flex-wrap gap-3">
              {constraintOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleConstraint(option.id)}
                  className={`px-4 py-2 rounded-full border-2 transition-all ${
                    formData.constraints.includes(option.id)
                      ? 'bg-orange-500 border-orange-500 text-white shadow-lg scale-105'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-orange-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Heart className="w-4 h-4" />
              What are you interested in?
            </label>
            <div className="flex flex-wrap gap-3">
              {interestOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleInterest(option.id)}
                  className={`px-4 py-2 rounded-full border-2 transition-all ${
                    formData.interests.includes(option.id)
                      ? 'bg-blue-500 border-blue-500 text-white shadow-lg scale-105'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Special Requests */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Any special requests? (Optional)
            </label>
            <textarea
              value={formData.special_requests}
              onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
              placeholder="e.g., prefer quiet neighborhoods, avoid crowds, photography spots..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
          >
            Generate My Itinerary ✨
          </button>

          <p className="text-center text-sm text-gray-500">
            This usually takes 30-60 seconds
          </p>
        </form>
      </div>
    </div>
  );
}
