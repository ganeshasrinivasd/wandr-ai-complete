'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, MapPin, Clock, DollarSign, Utensils } from 'lucide-react';

export default function PlanResultsPage() {
  const params = useParams();
  const planId = params.id as string;
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your itinerary...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Plan Not Found</h1>
          <p className="text-gray-600 mb-8">This itinerary doesn't exist or has been deleted.</p>
          <a
            href="/planner"
            className="inline-block bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition"
          >
            Create New Plan
          </a>
        </div>
      </div>
    );
  }

  const itinerary = plan.itinerary?.itinerary || {};
  const days = Object.values(itinerary);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <CheckCircle className="w-4 h-4" />
            Itinerary Created
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Your {plan.destination_city} Adventure
          </h1>
          
          <div className="flex items-center justify-center gap-6 text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>{plan.duration_days} days</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              <span>${plan.budget_per_day}/day</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              <span>{plan.destination_city}, {plan.destination_country}</span>
            </div>
          </div>
        </div>

        {/* Constraints Badges */}
        {plan.constraints && (
          <div className="flex flex-wrap gap-2 justify-center mb-12">
            {plan.constraints.accessibility?.map((item: string) => (
              <span key={item} className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm">
                ♿ {item}
              </span>
            ))}
            {plan.constraints.dietary?.map((item: string) => (
              <span key={item} className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm">
                🌱 {item}
              </span>
            ))}
          </div>
        )}

        {/* Check if we have activities */}
        {days.length === 0 || !days.some((day: any) => day.activities?.length > 0) ? (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Google Maps API Issue
            </h2>
            <p className="text-gray-700 mb-4">
              No venues were found for your destination. This is likely due to:
            </p>
            <ul className="text-left max-w-lg mx-auto space-y-2 text-gray-700">
              <li>• Google Maps API not properly configured</li>
              <li>• Places API not enabled in Google Cloud Console</li>
              <li>• API key restrictions blocking requests</li>
            </ul>
            <div className="mt-6">
              <a
                href="https://console.cloud.google.com/apis/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition mr-4"
              >
                Fix Google Maps API
              </a>
              <a
                href="/planner"
                className="inline-block bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition"
              >
                Try Again
              </a>
            </div>
          </div>
        ) : (
          /* Day-by-Day Itinerary */
          <div className="space-y-8">
            {days.map((day: any) => (
              <div key={day.day} className="bg-white rounded-3xl shadow-xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">
                      Day {day.day}
                    </h2>
                    <p className="text-gray-600">{day.date} • {day.neighborhood}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-500">
                      ${day.day_summary.total_cost}
                    </div>
                    <div className="text-sm text-gray-600">
                      {day.activities.length} activities
                    </div>
                  </div>
                </div>

                {/* Activities */}
                <div className="space-y-6">
                  {day.activities.map((activity: any, idx: number) => (
                    <div key={idx} className="flex gap-4 border-l-4 border-orange-500 pl-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                          {activity.type === 'meal' ? (
                            <Utensils className="w-6 h-6 text-orange-600" />
                          ) : (
                            <MapPin className="w-6 h-6 text-orange-600" />
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">
                              {activity.activity.name}
                            </h3>
                            <p className="text-gray-600">{activity.time}</p>
                          </div>
                          {activity.activity.cost > 0 && (
                            <span className="text-lg font-semibold text-gray-900">
                              ${activity.activity.cost}
                            </span>
                          )}
                        </div>

                        <p className="text-gray-700 mb-2">
                          {activity.activity.description}
                        </p>

                        {activity.activity.accessibility_notes && (
                          <div className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm mr-2">
                            ♿ {activity.activity.accessibility_notes}
                          </div>
                        )}

                        {activity.activity.vegan_details && (
                          <div className="inline-block bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm">
                            🌱 {activity.activity.vegan_details}
                          </div>
                        )}

                        {activity.activity.reddit_quote && (
                          <div className="mt-3 bg-gray-50 border-l-4 border-gray-300 pl-4 py-2 italic text-gray-600">
                            "{activity.activity.reddit_quote}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Day Summary */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        ${day.day_summary.total_cost}
                      </div>
                      <div className="text-sm text-gray-600">Total Cost</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {day.day_summary.total_walking_km} km
                      </div>
                      <div className="text-sm text-gray-600">Walking</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {day.day_summary.activities_count}
                      </div>
                      <div className="text-sm text-gray-600">Activities</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-12 text-center space-x-4">
          <a
            href="/planner"
            className="inline-block bg-orange-500 text-white px-8 py-3 rounded-lg hover:bg-orange-600 transition font-semibold"
          >
            Create Another Trip
          </a>
        </div>
      </div>
    </div>
  );
}
