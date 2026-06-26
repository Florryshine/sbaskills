'use client';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';

export default function AudioPage() {
  const [audios, setAudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchAudio() {
      const { data } = await supabase
        .from('audio_library')
        .select('*')
        .order('created_at', { ascending: false });
      setAudios(data || []);
      setLoading(false);
    }
    fetchAudio();
  }, []);

  async function handlePlay(id, currentPlays) {
    await supabase
      .from('audio_library')
      .update({ plays: (currentPlays || 0) + 1 })
      .eq('id', id);
  }

<MarkDoneButton activityType="audio" activityId={audio.id} points={10} label="✅ Mark as Listened" />

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <section className="bg-brand-blue py-16 text-center text-white">
          <h1 className="text-4xl font-extrabold mb-3">🎵 Audio Library</h1>
          <p className="text-blue-100 text-lg">
            Listen to study guides, motivational talks and exam tips
          </p>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-12">
          {loading ? (
            <div className="text-center py-20">
              <p className="text-gray-500">Loading audio files...</p>
            </div>
          ) : audios.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">🎙️</p>
              <h2 className="text-2xl font-bold text-gray-700 mb-2">No audio yet</h2>
              <p className="text-gray-500">Audio lessons are coming soon!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {audios.map((audio) => (
                <div key={audio.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">{audio.title}</h2>
                      {audio.description && (
                        <p className="text-sm text-gray-500 mt-1">
<ShareButtons 
  title={`Check out this course: ${course.title}`}
  url={`/courses/${course.id}`}
  targetType="course"
  targetId={course.id}
  description={course.description}
/>

{audio.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                      🎧 {audio.plays || 0} plays
                    </span>
                  </div>
                  <audio
                    controls
                    className="w-full mt-2"
                    onPlay={() => handlePlay(audio.id, audio.plays)}
                  >
                    <source src={audio.audio_url} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}