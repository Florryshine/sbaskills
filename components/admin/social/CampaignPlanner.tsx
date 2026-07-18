'use client';
import React, { useEffect, useState } from "react";
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, AlertCircle, 
  MapPin, CheckCircle, RefreshCw, CalendarDays
} from "lucide-react";
import { SocialPost } from "../types";

interface CampaignPlannerProps {
  plannerUpdatedTrigger: number;
  onPostRescheduled: () => void;
}

export function CampaignPlanner({ plannerUpdatedTrigger, onPostRescheduled }: CampaignPlannerProps) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(6); // 0-indexed, so 6 is July

  // Dialog state for rescheduling
  const [activeReschedulePost, setActiveReschedulePost] = useState(null);
  const [newDate, setNewDate] = useState("");

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  useEffect(() => {
    fetchScheduledPosts();
  }, [plannerUpdatedTrigger]);

  const fetchScheduledPosts = async () => {
    try {
      const res = await fetch("/api/social/calendar");
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error("Failed to load calendar", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReschedulePost || !newDate) return;

    try {
      const res = await fetch("/api/social/schedule/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: activeReschedulePost.id,
          newScheduledTime: newDate,
        }),
      });

      if (res.ok) {
        setActiveReschedulePost(null);
        fetchScheduledPosts();
        onPostRescheduled();
      }
    } catch (err) {
      console.error("Failed to update post schedule", err);
    }
  };

  // Generate calendar days for July 2026 (July has 31 days. July 1st 2026 is a Wednesday)
  const daysInMonth = 31;
  const startOffset = 3; // July 1, 2026 is Wednesday, so Sunday=0, Mon=1, Tue=2, Wed=3.

  const calendarDays = [];
  // Empty offset days
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push(null);
  }
  // Month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  const getPostsOnDay = (day: number) => {
    return posts.filter(p => {
      if (!p.scheduledTime) return false;
      const pDate = new Date(p.scheduledTime);
      return pDate.getFullYear() === currentYear && 
             pDate.getMonth() === currentMonth && 
             pDate.getDate() === day;
    });
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Month Navigation Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-bold text-slate-100 flex items-center gap-2 text-base">
            <CalendarDays size={18} className="text-violet-400" />
            <span>Interactive Multi-Platform Planner</span>
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">Drag-and-drop scheduling visualizer for synchronized learning campaigns.</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 border border-slate-850 rounded-xl">
          <button onClick={prevMonth} className="text-slate-400 hover:text-slate-100 transition-all">
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wide w-28 text-center select-none">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button onClick={nextMonth} className="text-slate-400 hover:text-slate-100 transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 2. Calendar Grid */}
      {loading ? (
        <div className="py-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Day Names Grid Header */}
          <div className="grid grid-cols-7 border-b border-slate-800 text-center font-mono text-[10px] font-bold text-slate-400 bg-slate-950 py-3 uppercase tracking-wider">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Days Grid cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-850">
            {calendarDays.map((day, index) => {
              const postsOnDay = day ? getPostsOnDay(day) : [];

              return (
                <div 
                  key={index} 
                  className={`min-h-36 p-2 space-y-1.5 transition-all flex flex-col justify-between ${
                    day ? "bg-slate-900/30 hover:bg-slate-900/60" : "bg-slate-950/40"
                  }`}
                >
                  {day ? (
                    <>
                      <span className="text-[11px] font-bold font-mono text-slate-400 block p-1 bg-slate-950 w-6 h-6 rounded-md flex items-center justify-center border border-slate-850">
                        {day}
                      </span>

                      {/* Display Post badges scheduled for this day */}
                      <div className="space-y-1.5 flex-1 overflow-y-auto mt-2 pb-2">
                        {postsOnDay.map((post) => (
                          <div
                            key={post.id}
                            onClick={() => {
                              setActiveReschedulePost(post);
                              setNewDate(post.scheduledTime ? post.scheduledTime.substring(0, 16) : "");
                            }}
                            className="bg-indigo-950/40 hover:bg-indigo-950/80 border border-indigo-900/60 hover:border-indigo-500 p-1.5 rounded-lg text-left cursor-pointer transition-all space-y-1 group"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] font-mono font-extrabold uppercase text-indigo-400 bg-indigo-950 px-1 py-0.25 rounded border border-indigo-900">
                                {post.platform}
                              </span>
                              <span className="text-[8px] text-slate-500 font-mono group-hover:text-indigo-300">
                                {post.scheduledTime ? new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-300 line-clamp-1 group-hover:text-slate-100">
                              {post.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Reschedule Modal Dialog */}
      {activeReschedulePost && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-scaleUp">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Clock size={16} className="text-violet-400" />
                <span>Reschedule Post Position</span>
              </h4>
              <button 
                onClick={() => setActiveReschedulePost(null)}
                className="text-slate-400 hover:text-slate-200 font-mono text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="p-6 space-y-5">
              <div className="space-y-1 bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                <span className="text-[9px] font-mono font-bold uppercase text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/60 inline-block">
                  {activeReschedulePost.platform}
                </span>
                <p className="text-xs text-slate-300 line-clamp-3 mt-1.5 leading-relaxed">
                  {activeReschedulePost.content}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono block">New Scheduled Release Timestamp</label>
                <input
                  type="datetime-local"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveReschedulePost(null)}
                  className="flex-1 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs py-2.5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2.5 rounded-xl font-medium transition-all"
                >
                  Apply Rescheduling
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}





