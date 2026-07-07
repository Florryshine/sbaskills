'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function GenerationJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const supabase = createBrowserClient();

  useEffect(() => { loadJobs(); }, []);

  const loadJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('generation_jobs')
      .select(`
        *,
        generation_job_items (*)
      `)
      .order('started_at', { ascending: false });
    if (!error) setJobs(data || []);
    setLoading(false);
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-gray-200 text-gray-700',
      running: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      skipped: 'bg-gray-100 text-gray-400',
    };
    return `px-2 py-1 rounded-full text-xs font-bold ${colors[status] || 'bg-gray-200'}`;
  };

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-brand-blue mb-6">⚡ Generation Jobs</h1>
      {loading ? <div className="text-center py-8">Loading...</div> : jobs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No generation jobs found.</div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <div key={job.id} className="bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">{job.keyword}</h3>
                  <p className="text-sm text-gray-500">
                    Status: <span className={`font-semibold ${job.overall_status === 'completed' ? 'text-green-600' : job.overall_status === 'running' ? 'text-blue-600' : 'text-red-600'}`}>{job.overall_status}</span>
                    • Started: {new Date(job.started_at).toLocaleString()}
                    {job.finished_at && ` • Finished: ${new Date(job.finished_at).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleExpand(job.id)} className="text-brand-blue px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50">
                    {expandedId === job.id ? 'Hide Details' : 'View Details'}
                  </button>
                </div>
              </div>
              {expandedId === job.id && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Engine Statuses:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {job.generation_job_items?.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl">
                        <span className="text-sm font-medium capitalize">{item.engine}</span>
                        <span className={getStatusBadge(item.status)}>{item.status}</span>
                        {item.error && <span className="text-xs text-red-500">⚠️</span>}
                      </div>
                    ))}
                  </div>
                  {job.generation_job_items?.some(i => i.error) && (
                    <div className="mt-3 bg-red-50 p-3 rounded-xl text-sm text-red-600">
                      <strong>Errors:</strong>
                      {job.generation_job_items.filter(i => i.error).map(i => (
                        <div key={i.id}>{i.engine}: {i.error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}