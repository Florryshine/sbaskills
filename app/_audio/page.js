'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AudioPage() {
  const [audios, setAudios] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => { fetchAudios() }, [])

  async function fetchAudios() {
    const { data } = await supabase.from('audio_library').select('*').order('created_at', { ascending: false })
    setAudios(data || [])
  }

  async function uploadAudio(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const fileName = `${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('audio').upload(fileName, file)
    if (error) alert('Upload failed')
    else {
      const { data: audioUrl } = supabase.storage.from('audio').getPublicUrl(fileName)
      await supabase.from('audio_library').insert({
        title: file.name.replace(/\.[^/.]+$/, ''),
        audio_url: audioUrl.publicUrl,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id
      })
      fetchAudios()
    }
    setUploading(false)
  }

  async function incrementPlays(id, currentPlays) {
    await supabase.from('audio_library').update({ plays: currentPlays + 1 }).eq('id', id)
    fetchAudios()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Audio Library</h1>
      <div className="mb-8 p-4 border-2 border-dashed rounded-lg">
        <input type="file" accept="audio/*" onChange={uploadAudio} disabled={uploading} />
        {uploading && <p>Uploading...</p>}
      </div>
      <div className="space-y-4">
        {audios.map((audio) => (
          <div key={audio.id} className="border rounded-lg p-4">
            <h3 className="font-semibold">{audio.title}</h3>
            <audio controls className="w-full mt-2" onPlay={() => incrementPlays(audio.id, audio.plays)}>
              <source src={audio.audio_url} type="audio/mpeg" />
            </audio>
            <p className="text-sm text-gray-500 mt-2">Plays: {audio.plays}</p>
          </div>
        ))}
      </div>
    </div>
  )
}